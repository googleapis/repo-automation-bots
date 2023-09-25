// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Request, Response} from 'express';
import {Webhooks} from '@octokit/webhooks';
import {SecretLoader, BotSecrets} from './secrets/secret-loader';
import {GoogleSecretLoader} from './secrets/google-secret-loader';
import {parseBotRequest, BotRequest, TriggerType} from './bot-request';
import {GCFLogger} from './logging/gcf-logger';
import {buildTriggerInfo} from './logging/trigger-info-builder';
import {logErrors} from './logging/error-logging';
import {TaskEnqueuer} from './background/task-enqueuer';
import {CloudTasksEnqueuer} from './background/cloud-tasks-enqueuer';
import {
  parseScheduledRequest,
  ScheduledRequest,
  scheduledRequestWithInstallation,
  scheduledRequestWithRepository,
  scheduledRequestWithInstalledRepository,
} from './background/scheduled-request';
import {
  SCHEDULER_GLOBAL_EVENT_NAME,
  SCHEDULER_INSTALLATION_EVENT_NAME,
  SCHEDULER_REPOSITORY_EVENT_NAME,
} from './custom-events';
import * as http from 'http';
import {getServer} from './server';
import {InstallationHandler, OctokitInstallationHandler} from './installations';
import {OctokitFactory} from './octokit';
import {PayloadCache, NoopPayloadCache} from './background/payload-cache';
import {CloudStoragePayloadCache} from './background/cloud-storage-payload-cache';
import {
  parseRateLimitError,
  eachError,
  parseServiceUnavailableError,
} from './errors';

const DEFAULT_MAX_RETRIES = 10;
const DEFAULT_MAX_CRON_RETRIES = 0;
const DEFAULT_MAX_PUBSUB_RETRIES = 0;

// Adding 30 second delay for each batch with 30 tasks
const DEFAULT_FLOW_CONTROL_DELAY_IN_SECOND = 30;

export interface HandlerRequest extends Request {
  rawBody: Buffer;
}

export type HandlerResponse = Response;

interface BootstrapperBaseOptions {
  taskEnqueuer?: TaskEnqueuer;
  skipVerification?: boolean;
  maxRetries?: number;
  maxCronRetries?: number;
  maxPubSubRetries?: number;
  taskTargetEnvironment?: BotEnvironment;
  taskTargetName?: string;
  flowControlDelayInSeconds?: number;
  payloadBucket?: string;
  installationHandler?: InstallationHandler;
}

export interface BootstrapperLoadOptions extends BootstrapperBaseOptions {
  projectId?: string;
  botName?: string;
  secretLoader?: SecretLoader;
  location?: string;
}

interface BootstrapperOptions extends BootstrapperBaseOptions {
  projectId: string;
  botName: string;
  botSecrets: BotSecrets;
  location: string;
}

export type HandlerFunction = (
  request: HandlerRequest,
  response: HandlerResponse
) => Promise<void>;

type ApplicationFunction = (app: Webhooks) => void;

export type BotEnvironment = 'functions' | 'run';

interface EnqueueTaskParams {
  id: string;
  eventName: string;
  body: string;
  delayInSeconds?: number;
}

export interface BootstrapperFactory {
  build(options: BootstrapperLoadOptions): Promise<Bootstrapper>;
}

export class Bootstrapper {
  private taskEnqueuer: TaskEnqueuer;
  private projectId: string;
  private botName: string;
  private botSecrets: BotSecrets;
  private skipVerification: boolean;
  private maxRetries: number;
  private maxCronRetries: number;
  private maxPubSubRetries: number;
  private webhooks: Webhooks;
  private taskTargetEnvironment: BotEnvironment;
  private taskTargetName: string;
  private location: string;
  private installationHandler: InstallationHandler;
  private octokitFactory: OctokitFactory;
  private flowControlDelayInSeconds: number;
  private taskCaller: string;
  private payloadCache: PayloadCache;

  constructor(options: BootstrapperOptions) {
    this.projectId = options.projectId;
    this.botName = options.botName;
    this.botSecrets = options.botSecrets;
    this.location = options.location;
    this.webhooks = new Webhooks({secret: this.botSecrets.webhookSecret});
    this.taskCaller = 'FIXME@gserviceaccount.com';
    this.taskEnqueuer =
      options.taskEnqueuer ??
      new CloudTasksEnqueuer(
        this.projectId,
        this.botName,
        this.location,
        this.taskCaller,
        this.webhooks.sign
      );
    this.skipVerification = options.skipVerification ?? false;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.maxCronRetries = options.maxCronRetries ?? DEFAULT_MAX_CRON_RETRIES;
    this.maxPubSubRetries =
      options.maxPubSubRetries ?? DEFAULT_MAX_PUBSUB_RETRIES;
    this.taskTargetEnvironment = options.taskTargetEnvironment ?? 'functions';
    this.taskTargetName = options.taskTargetName ?? this.botName;
    this.octokitFactory = new OctokitFactory(this.botSecrets);
    this.installationHandler =
      options.installationHandler ??
      new OctokitInstallationHandler(this.octokitFactory);
    this.flowControlDelayInSeconds =
      options.flowControlDelayInSeconds ?? DEFAULT_FLOW_CONTROL_DELAY_IN_SECOND;
    this.payloadCache = options.payloadBucket
      ? new CloudStoragePayloadCache(options.payloadBucket)
      : new NoopPayloadCache();
  }

  static async load(
    options: BootstrapperLoadOptions = {}
  ): Promise<Bootstrapper> {
    const projectId = options.projectId ?? process.env.PROJECT_ID;
    if (!projectId) {
      throw new Error(
        'Need to specify a project ID explicitly or via PROJECT_ID env variable'
      );
    }
    const botName = options.botName ?? process.env.GCF_SHORT_FUNCTION_NAME;
    if (!botName) {
      throw new Error(
        'Need to specify a bot name explicitly or via GCF_SHORT_FUNCTION_NAME env variable'
      );
    }
    const location = options.location ?? process.env.GCF_LOCATION;
    if (!location) {
      throw new Error(
        'Missing required `location`. Please provide as a constructor argument or set the GCF_LOCATION env variable.'
      );
    }
    const payloadBucket = options.payloadBucket ?? process.env.WEBHOOK_TMP;
    const secretLoader =
      options.secretLoader ?? new GoogleSecretLoader(projectId);
    const botSecrets = await secretLoader.load(botName);
    return new Bootstrapper({
      ...options,
      projectId,
      botSecrets,
      botName,
      location,
      payloadBucket,
    });
  }

  server(appFn: ApplicationFunction): http.Server {
    return getServer(this.handler(appFn));
  }

  handler(appFn: ApplicationFunction): HandlerFunction {
    // load handlers onto webhooks
    appFn(this.webhooks);

    return async (request: HandlerRequest, response: HandlerResponse) => {
      const botRequest = parseBotRequest(request);
      const requestLogger = new GCFLogger();
      requestLogger.addBindings(
        this.buildRequestLoggerBindings(botRequest, request.body)
      );

      if (!(await this.verifySignature(botRequest, requestLogger))) {
        requestLogger.warn('Invalid signature');
        response.status(400).json({message: 'Invalid signature'});
        return;
      }

      try {
        switch (botRequest.triggerType) {
          case TriggerType.TASK:
            await this.handleTask(botRequest, response, requestLogger);
            break;
          case TriggerType.SCHEDULER:
            await this.handleScheduled(botRequest, response, requestLogger);
            break;
          case TriggerType.PUBSUB:
            await this.handlePubSub(botRequest, response, requestLogger);
            break;
          case TriggerType.GITHUB:
            await this.handleWebhook(botRequest, response, requestLogger);
            break;
          case TriggerType.UNKNOWN:
          default:
            await this.handleUnknown(botRequest, response, requestLogger);
            break;
        }
      } catch (err) {
        // only report to error reporting if it's the final attempt
        const maxRetries = this.getRetryLimit(botRequest.eventName);
        const shouldReportErrors = botRequest.taskRetryCount >= maxRetries;
        logErrors(requestLogger, err as Error, shouldReportErrors);
        response.status(500).json({message: (err as Error).message});
      } finally {
        requestLogger.flushSync();
      }
    };
  }

  private async handleScheduled(
    botRequest: BotRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    const scheduledRequest = parseScheduledRequest(botRequest);
    switch (scheduledRequest.cron_type) {
      case 'global':
        await this.handleScheduledGlobal(
          botRequest,
          scheduledRequest,
          response,
          logger
        );
        break;
      case 'installation':
        await this.handleScheduledInstallation(
          botRequest,
          scheduledRequest,
          response,
          logger
        );
        break;
      case 'repository':
      default:
        await this.handleScheduledRepository(
          botRequest,
          scheduledRequest,
          response,
          logger
        );
        break;
    }
    response.status(200).json({message: 'Executed'});
  }

  private async handleScheduledGlobal(
    botRequest: BotRequest,
    scheduledRequest: ScheduledRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    logger.debug('Enqueuing global scheduled task');
    await this.enqueueTask(
      {
        id: botRequest.githubDeliveryId,
        eventName: SCHEDULER_GLOBAL_EVENT_NAME,
        body: JSON.stringify(scheduledRequest),
      },
      logger
    );
    response.status(200).json({message: 'Enqueued global cron task'});
  }

  private async handleScheduledInstallation(
    botRequest: BotRequest,
    scheduledRequest: ScheduledRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    logger.debug('Enqueuing per-installation scheduled tasks');
    if (scheduledRequest.installation) {
      await this.enqueueTask(
        {
          id: botRequest.githubDeliveryId,
          eventName: SCHEDULER_INSTALLATION_EVENT_NAME,
          body: JSON.stringify(scheduledRequest),
        },
        logger
      );
      response
        .status(200)
        .json({message: 'Enqueued single installation cron task'});
    } else {
      const generator = this.installationHandler.eachInstallation();
      for await (const installation of generator) {
        const payload = scheduledRequestWithInstallation(
          scheduledRequest,
          installation
        );
        await this.enqueueTask(
          {
            id: botRequest.githubDeliveryId,
            eventName: SCHEDULER_INSTALLATION_EVENT_NAME,
            body: JSON.stringify(payload),
          },
          logger
        );
      }
    }
    response.status(200).json({message: 'Enqueued global cron task'});
  }

  private async enqueueTask(
    enqueueParams: EnqueueTaskParams,
    logger: GCFLogger
  ) {
    await this.taskEnqueuer.enqueueTask(
      {
        ...enqueueParams,
        targetEnvironment: this.taskTargetEnvironment,
        targetName: this.taskTargetName,
      },
      logger
    );
  }

  private async handleScheduledRepository(
    botRequest: BotRequest,
    scheduledRequest: ScheduledRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    logger.debug('Enqueuing per-repository scheduled task');
    if (scheduledRequest.repo) {
      await this.enqueueTask(
        {
          id: botRequest.githubDeliveryId,
          eventName: SCHEDULER_REPOSITORY_EVENT_NAME,
          body: JSON.stringify(scheduledRequest),
        },
        logger
      );
    } else if (scheduledRequest.installation) {
      const generator = this.installationHandler.eachInstalledRepository(
        scheduledRequest.installation.id
      );

      const promises: Array<Promise<void>> = new Array<Promise<void>>();
      const batchSize = 30;
      let delayInSeconds = 0; // initial delay for the tasks
      for await (const repo of generator) {
        const payload = scheduledRequestWithInstalledRepository(
          scheduledRequest,
          repo
        );
        promises.push(
          this.enqueueTask(
            {
              id: botRequest.githubDeliveryId,
              eventName: SCHEDULER_REPOSITORY_EVENT_NAME,
              body: JSON.stringify(payload),
              delayInSeconds,
            },
            logger
          )
        );
        if (promises.length >= batchSize) {
          await Promise.all(promises);
          promises.splice(0, promises.length);
          // add delay for flow control
          delayInSeconds += this.flowControlDelayInSeconds;
        }
      }
      // Wait for the rest.
      if (promises.length > 0) {
        await Promise.all(promises);
        promises.splice(0, promises.length);
      }
    } else {
      const installationGenerator = this.installationHandler.eachInstallation();
      const promises: Array<Promise<void>> = new Array<Promise<void>>();
      const batchSize = 30;
      let delayInSeconds = 0; // initial delay for the tasks
      for await (const installation of installationGenerator) {
        if (scheduledRequest.allowed_organizations !== undefined) {
          const org = installation.login?.toLowerCase();
          if (org && !scheduledRequest.allowed_organizations.includes(org)) {
            logger.info(
              `${org} is not allowed for this scheduler job, skipping`
            );
            continue;
          }
        }
        const payload = scheduledRequestWithInstallation(
          scheduledRequest,
          installation
        );
        const generator = this.installationHandler.eachInstalledRepository(
          installation.id
        );
        for await (const repo of generator) {
          if (repo.archived === true || repo.disabled === true) {
            continue;
          }
          promises.push(
            this.enqueueTask(
              {
                id: botRequest.githubDeliveryId,
                eventName: SCHEDULER_REPOSITORY_EVENT_NAME,
                body: JSON.stringify(payload),
                delayInSeconds,
              },
              logger
            )
          );
          if (promises.length >= batchSize) {
            await Promise.all(promises);
            promises.splice(0, promises.length);
            // add delay for flow control
            delayInSeconds += this.flowControlDelayInSeconds;
          }
        }
        // Wait for the rest.
        if (promises.length > 0) {
          await Promise.all(promises);
          promises.splice(0, promises.length);
        }
      }
    }
  }
  private async handlePubSub(
    botRequest: BotRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    const body = botRequest.payload as ScheduledRequest;
    let payload: ScheduledRequest = body.message?.data
      ? JSON.parse(Buffer.from(body.message.data, 'base64').toString())
      : body;
    if (payload.repo) {
      payload = scheduledRequestWithRepository(payload, payload.repo);
    }
    await this.enqueueTask(
      {
        id: botRequest.githubDeliveryId,
        eventName: botRequest.eventName,
        body: JSON.stringify(payload),
      },
      logger
    );
    response.status(200).json({message: 'Enqueue pubsub task'});
  }

  private async handleTask(
    botRequest: BotRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    // Abort task retries if we've hit the max number by
    // returning "success"
    const maxRetries = this.getRetryLimit(botRequest.eventName);
    if (botRequest.taskRetryCount > maxRetries) {
      logger.metric('too-many-retries');
      logger.info(
        `Too many retries: ${botRequest.taskRetryCount} > ${maxRetries}`
      );
      // return 200 so we don't retry the task again
      response.status(200).json({message: 'Too many retries'});
      return;
    }

    // Load payload from cache if cached
    const payload = await this.payloadCache.load(
      botRequest.payload as Record<string, any>,
      logger
    );

    // The payload does not exist, stop retrying on this task by letting
    // this request "succeed".
    if (!payload) {
      logger.metric('payload-expired');
      response.status(200).json({message: 'Payload expired'});
      return;
    }

    try {
      await this.webhooks.receive({
        id: botRequest.githubDeliveryId,
        name: botRequest.eventName as any,
        payload: payload as any,
      });

      response.status(200).json({message: 'Executed'});
    } catch (e) {
      for (const inner of eachError(e as Error)) {
        const rateLimits = parseRateLimitError(inner);
        if (rateLimits) {
          logger.warn('Rate limit exceeded', rateLimits);
          // On GitHub quota issues, return a 503 to throttle our task queues
          // https://cloud.google.com/tasks/docs/common-pitfalls#backoff_errors_and_enforced_rates
          response.status(503).json({
            ...rateLimits,
            message: 'Rate Limited',
          });
          return;
        }
        const serviceUnavailable = parseServiceUnavailableError(inner);
        if (serviceUnavailable) {
          logger.warn(
            'ServiceUnavailable',
            serviceUnavailable.message,
            serviceUnavailable.stack
          );
          response.status(503).json({
            message: serviceUnavailable.message,
          });
          return;
        }
      }
      throw e;
    }
  }

  private async handleWebhook(
    request: BotRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    await this.enqueueTask(
      {
        id: request.githubDeliveryId,
        eventName: request.eventName,
        body: JSON.stringify(request.payload),
      },
      logger
    );
    response.status(200).json({message: 'Enqueued webhook task'});
  }

  private async handleUnknown(
    request: BotRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    logger.warn(`Unknown trigger type: ${request.triggerType}`);
    response
      .status(400)
      .json({message: `Unknown trigger type: ${request.triggerType}`});
  }

  private async verifySignature(
    botRequest: BotRequest,
    logger: GCFLogger
  ): Promise<boolean> {
    if (this.skipVerification) {
      logger.info(
        'Skipping payload verification due to `skipVerification` configuration'
      );
      return true;
    }
    if (!botRequest.signature) {
      logger.info('Missing signature');
      return false;
    }
    if (!botRequest.rawBody) {
      logger.info('No raw body in request');
      return false;
    }
    try {
      return this.webhooks.verify(
        botRequest.rawBody.toString(),
        botRequest.signature
      );
    } catch (err) {
      logger.error(err as any);
      return false;
    }
  }

  private buildRequestLoggerBindings(
    botRequest: BotRequest,
    requestBody?: Record<string, any>
  ) {
    const extras: Record<string, string> = {};
    const triggerInfo = buildTriggerInfo(botRequest, requestBody);
    if (botRequest.traceId) {
      extras[
        'logging.googleapis.com/trace'
      ] = `projects/${this.projectId}/traces/${botRequest.traceId}`;
    }
    return {
      ...triggerInfo,
      ...extras,
    };
  }

  private getRetryLimit(eventName: string): number {
    if (eventName.startsWith('schedule.')) {
      return this.maxCronRetries;
    }
    if (eventName.startsWith('pubsub.')) {
      return this.maxPubSubRetries;
    }
    return this.maxRetries;
  }
}
