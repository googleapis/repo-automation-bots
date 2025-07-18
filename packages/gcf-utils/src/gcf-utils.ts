// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
import {createProbot, Probot, Options} from 'probot';
import {ApplicationFunction} from 'probot/lib/types';
import {createProbotAuth} from 'octokit-auth-probot';
// eslint-disable-next-line node/no-extraneous-import
import AggregateError from 'aggregate-error';

import getStream from 'get-stream';
import intoStream from 'into-stream';
import * as http from 'http';

import {v1 as SecretManagerV1} from '@google-cloud/secret-manager';
import {v2 as CloudTasksV2} from '@google-cloud/tasks';
import {Storage} from '@google-cloud/storage';
import * as express from 'express';
import {createAppAuth} from '@octokit/auth-app';
import {Octokit} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import {RequestError} from '@octokit/request-error';
// eslint-disable-next-line node/no-extraneous-import
import {GraphqlResponseError} from '@octokit/graphql';
import {config as ConfigPlugin} from '@probot/octokit-plugin-config';
import {buildTriggerInfo} from './logging/trigger-info-builder';
import {GCFLogger, buildRequestLogger} from './logging/gcf-logger';
import {v4} from 'uuid';
import {getServer} from './server/server';
import {v2 as CloudRunV2} from '@google-cloud/run';
import {TriggerType, parseBotRequest, BotRequest} from './bot-request';
import {
  SCHEDULER_GLOBAL_EVENT_NAME,
  SCHEDULER_INSTALLATION_EVENT_NAME,
  SCHEDULER_REPOSITORY_EVENT_NAME,
} from './custom-events';
import {
  RUNNING_IN_TEST,
  DEFAULT_FLOW_CONTROL_DELAY_IN_SECOND,
  DEFAULT_WRAP_CONFIG,
  WrapConfig,
} from './configuration';
import {
  eachInstallation,
  eachInstalledRepository,
  InstallationHandler,
  parseInstallationId,
} from './installations';
export {TriggerType} from './bot-request';
export {GCFLogger} from './logging/gcf-logger';
export {DEFAULT_FLOW_CONTROL_DELAY_IN_SECOND} from './configuration';

// A maximum body size in bytes for Cloud Task
export const MAX_BODY_SIZE_FOR_CLOUD_TASK = 665600; // 650KB
export const ERROR_REPORTING_TYPE_NAME =
  'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent';

// On Cloud Functions, rawBody is automatically added.
// It's not guaranteed on other platform.
export interface RequestWithRawBody extends express.Request {
  rawBody?: Buffer;
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const LoggingOctokitPlugin = require('../src/logging/logging-octokit-plugin.js');

export type HandlerFunction = (
  request: RequestWithRawBody,
  response: express.Response
) => Promise<void>;

type CronType = 'repository' | 'installation' | 'global';
const DEFAULT_CRON_TYPE: CronType = 'repository';
const DEFAULT_TASK_CALLER =
  'task-caller@repo-automation-bots.iam.gserviceaccount.com';

type BotEnvironment = 'functions' | 'run';

interface Scheduled {
  repo?: string;
  installation: {
    id: number;
  };
  message?: {[key: string]: string};
  cron_type?: CronType;
  cron_org?: string;
  allowed_organizations?: string[];
}

interface EnqueueTaskParams {
  body: string;
  id: string;
  name: string;
}

/**
 * Bot can throw this error to indicate it experienced some form of
 * resource limitation.  GCFBootstrapper will catch this and return
 * HTTP 503 to suggest Cloud Task adds backoff for the next attempt.
 */
export class ServiceUnavailable extends Error {
  readonly originalError: Error;
  constructor(message: string, err: Error = undefined) {
    super(message);
    this.originalError = err;
  }
}

export interface WrapOptions {
  // Whether or not to enqueue direct GitHub webhooks in a Cloud Task
  // queue which provides a retry mechanism. Defaults to `true`.
  // Deprecated. Please use `maxRetries` and `maxCronRetries` instead.
  background?: boolean;

  // Whether or not to automatically log Octokit requests. Defaults to
  // `false`.
  logging?: boolean;

  // Whether or not to skip verification of request payloads. Defaults
  // to `true` in test mode, otherwise `false`.
  skipVerification?: boolean;

  // Maximum number of attempts for webhook handlers. Defaults to `10`.
  maxRetries?: number;

  // Maximum number of attempts for cron handlers. Defaults to `0`.
  maxCronRetries?: number;

  // Maximum number of attempts for pubsub handlers. Defaults to `0`.
  maxPubSubRetries?: number;

  // Delay in task scheduling flow control
  flowControlDelayInSeconds?: number;

  // Whether or not to throttle on rate limiting. Defaults to `true`.
  throttleOnRateLimits?: boolean;
}

// Default logger, in general, you will want to configure a local logger that
// manages its own context.
export const logger = new GCFLogger();

export interface CronPayload {
  repository: {
    name: string;
    full_name: string;
    owner: {
      login: string;
      name: string;
    };
  };
  organization: {
    login: string;
  };
  cron_org: string;
}

export interface BotSecrets {
  privateKey: string;
  appId: string;
  webhookSecret: string;
}

interface BotSecretsOptions {
  projectId?: string;
  botName?: string;
  secretsClient?: SecretManagerV1.SecretManagerServiceClient;
}
/**
 * A helper for fetch secret from SecretManager.
 */
export async function getBotSecrets(
  options: BotSecretsOptions = {}
): Promise<BotSecrets> {
  const projectId = options.projectId ?? process.env.PROJECT_ID;
  const botName =
    options.botName ??
    process.env.GCF_SHORT_FUNCTION_NAME ??
    process.env.BOT_NAME;
  const secretsClient =
    options.secretsClient ??
    new SecretManagerV1.SecretManagerServiceClient({
      fallback: 'rest',
    });
  const [version] = await secretsClient.accessSecretVersion({
    name: `projects/${projectId}/secrets/${botName}/versions/latest`,
  });
  // Extract the payload as a string.
  const payload = version?.payload?.data?.toString() || '';
  if (payload === '') {
    throw Error('did not retrieve a payload from SecretManager.');
  }
  const secrets = JSON.parse(payload);

  const privateKey = secrets.privateKey ?? secrets.cert;
  const appId = secrets.appId ?? secrets.id;
  const webhookSecret = secrets.webhookSecret ?? secrets.secret;
  return {
    privateKey: privateKey,
    appId: appId,
    webhookSecret: webhookSecret,
  };
}

/**
 * A helper for getting an Octokit instance authenticated as an App.
 *
 * Note that it only provides an Octokit instance with a JWT token
 * when installationId is not provided. This Octokit only allows you
 * to call limited APIs including listing installations.
 *
 * Github Apps should provide installationId whenever possible.
 */
export async function getAuthenticatedOctokit(
  installationId: number | undefined
): Promise<Octokit> {
  const botSecrets = await getBotSecrets();
  if (installationId === undefined || installationId === null) {
    // Authenticate as a bot.
    return new Octokit({
      authStrategy: createAppAuth,
      auth: {
        appId: botSecrets.appId,
        privateKey: botSecrets.privateKey,
      },
    });
  }
  // Authenticate as an installation.
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: botSecrets.appId,
      privateKey: botSecrets.privateKey,
      installationId: installationId,
    },
  });
}

interface BootstrapperOptions {
  secretsClient?: SecretManagerV1.SecretManagerServiceClient;
  tasksClient?: CloudTasksV2.CloudTasksClient;
  cloudRunClient?: CloudRunV2.ServicesClient;
  projectId?: string;
  functionName?: string;
  location?: string;
  payloadBucket?: string;
  taskTargetEnvironment?: BotEnvironment;
  taskTargetName?: string;
  taskCaller?: string;
}

function defaultTaskEnvironment(): BotEnvironment {
  return process.env.BOT_RUNTIME === 'run' ? 'run' : 'functions';
}

function defaultTaskTarget(
  botEnvironment: BotEnvironment,
  botName: string
): string {
  if (botEnvironment === 'run') {
    // Cloud Run defaults to dasherized bot name + '-backend'
    return `${botName.replace(/_/g, '-')}-backend`;
  } else {
    // Cloud Functions defaults to underscored bot name
    return botName.replace(/-/g, '_');
  }
}

export class GCFBootstrapper {
  probot?: Probot;

  secretsClient: SecretManagerV1.SecretManagerServiceClient;
  cloudTasksClient: CloudTasksV2.CloudTasksClient;
  cloudRunClient: CloudRunV2.ServicesClient;
  storage: Storage;
  projectId: string;
  functionName: string;
  location: string;
  payloadBucket: string | undefined;
  taskTargetEnvironment: BotEnvironment;
  taskTargetName: string;
  taskCaller: string;
  flowControlDelayInSeconds: number;
  cloudRunURL: string | undefined;
  installationHandler: InstallationHandler;

  constructor(options?: BootstrapperOptions) {
    options = {
      ...{
        projectId: process.env.PROJECT_ID,
        functionName:
          process.env.GCF_SHORT_FUNCTION_NAME ?? process.env.BOT_NAME,
        location: process.env.GCF_LOCATION ?? process.env.BOT_LOCATION,
        payloadBucket: process.env.WEBHOOK_TMP,
        taskCaller: process.env.TASK_CALLER_SERVICE_ACCOUNT,
      },
      ...options,
    };

    this.secretsClient =
      options?.secretsClient ||
      new SecretManagerV1.SecretManagerServiceClient({fallback: 'rest'});
    this.cloudTasksClient =
      options?.tasksClient ||
      new CloudTasksV2.CloudTasksClient({fallback: 'rest'});
    this.cloudRunClient =
      options?.cloudRunClient ||
      new CloudRunV2.ServicesClient({fallback: 'rest'});
    this.storage = new Storage({retryOptions: {autoRetry: !RUNNING_IN_TEST}});
    this.taskTargetEnvironment =
      options.taskTargetEnvironment || defaultTaskEnvironment();
    if (!options.projectId) {
      throw new Error(
        'Missing required `projectId`. Please provide as a constructor argument or set the PROJECT_ID env variable.'
      );
    }
    this.projectId = options.projectId;
    if (!options.functionName) {
      throw new Error(
        'Missing required `functionName`. Please provide as a constructor argument or set the GCF_SHORT_FUNCTION_NAME or BOT_NAME env variable.'
      );
    }
    this.functionName = options.functionName;
    if (!options.location) {
      throw new Error(
        'Missing required `location`. Please provide as a constructor argument or set the GCF_LOCATION or BOT_LOCATION env variable.'
      );
    }
    this.location = options.location;
    this.payloadBucket = options.payloadBucket;
    this.taskTargetName =
      options.taskTargetName ||
      defaultTaskTarget(this.taskTargetEnvironment, this.functionName);
    this.taskCaller = options.taskCaller || DEFAULT_TASK_CALLER;
    this.flowControlDelayInSeconds = DEFAULT_FLOW_CONTROL_DELAY_IN_SECOND;
    this.cloudRunURL = undefined;
    const organizationAllowlist = process.env.ALLOWLISTED_ORGANIZATIONS
      ? new Set(process.env.ALLOWLISTED_ORGANIZATIONS.split(','))
      : undefined;
    const organizationBlocklist = process.env.BLOCKLISTED_ORGANIZATIONS
      ? new Set(process.env.BLOCKLISTED_ORGANIZATIONS.split(','))
      : undefined;
    this.installationHandler = new InstallationHandler({
      organizationAllowlist,
      organizationBlocklist,
    });
  }

  async loadProbot(
    appFn: ApplicationFunction,
    logging?: boolean
  ): Promise<Probot> {
    if (!this.probot) {
      const cfg = await this.getProbotConfig(logging);
      this.probot = createProbot({overrides: cfg});
    }

    await this.probot.load(appFn);

    return this.probot;
  }

  async getProbotConfig(logging?: boolean): Promise<Options> {
    const secrets = await getBotSecrets({
      projectId: this.projectId,
      botName: this.functionName,
      secretsClient: this.secretsClient,
    });

    if (logging) {
      logger.info('custom logging instance enabled');
      const LoggingOctokit = Octokit.plugin(LoggingOctokitPlugin)
        .plugin(ConfigPlugin)
        .defaults({authStrategy: createProbotAuth});
      return {
        appId: secrets.appId,
        privateKey: secrets.privateKey,
        secret: secrets.webhookSecret,
        Octokit: LoggingOctokit,
      };
    } else {
      logger.info('custom logging instance not enabled');
      const DefaultOctokit = Octokit.plugin(ConfigPlugin).defaults({
        authStrategy: createProbotAuth,
      });
      return {
        appId: secrets.appId,
        privateKey: secrets.privateKey,
        secret: secrets.webhookSecret,
        log: logger,
        Octokit: DefaultOctokit,
      } as unknown as Options;
    }
  }

  private parseWrapConfig(wrapOptions: WrapOptions | undefined): WrapConfig {
    const wrapConfig: WrapConfig = {
      ...DEFAULT_WRAP_CONFIG,
      ...wrapOptions,
    };

    if (wrapOptions?.background !== undefined) {
      logger.warn(
        '`background` option has been deprecated in favor of `maxRetries` and `maxCronRetries`'
      );
      if (wrapOptions.background === false) {
        wrapConfig.maxCronRetries = 0;
        wrapConfig.maxRetries = 0;
        wrapConfig.maxPubSubRetries = 0;
      }
    }
    return wrapConfig;
  }

  private getRetryLimit(wrapConfig: WrapConfig, eventName: string) {
    if (eventName.startsWith('schedule.')) {
      return wrapConfig.maxCronRetries;
    }
    if (eventName.startsWith('pubsub.')) {
      return wrapConfig.maxPubSubRetries;
    }
    return wrapConfig.maxRetries;
  }

  /**
   * Wrap an ApplicationFunction in a http.Server that can be started
   * directly.
   * @param appFn {ApplicationFunction} The probot handler function
   * @param wrapOptions {WrapOptions} Bot handler options
   */
  server(appFn: ApplicationFunction, wrapOptions?: WrapOptions): http.Server {
    return getServer(this.gcf(appFn, wrapOptions));
  }

  /**
   * Wrap an ApplicationFunction in so it can be started in a Google
   * Cloud Function.
   * @param appFn {ApplicationFunction} The probot handler function
   * @param wrapOptions {WrapOptions} Bot handler options
   */
  gcf(appFn: ApplicationFunction, wrapOptions?: WrapOptions): HandlerFunction {
    return async (request: RequestWithRawBody, response: express.Response) => {
      const wrapConfig = this.parseWrapConfig(wrapOptions);

      this.flowControlDelayInSeconds = wrapConfig.flowControlDelayInSeconds;

      this.probot =
        this.probot || (await this.loadProbot(appFn, wrapConfig.logging));

      // parse all common fields from a bot request
      const botRequest = parseBotRequest(request);

      // validate the signature
      if (
        !wrapConfig.skipVerification &&
        !(await this.probot.webhooks.verify(
          request.rawBody
            ? request.rawBody.toString()
            : request.body.toString(),
          botRequest.signature
        ))
      ) {
        response.status(400).send({
          statusCode: 400,
          body: JSON.stringify({message: 'Invalid signature'}),
        });
        return;
      }

      /**
       * Note: any logs written before resetting bindings may contain
       * bindings from previous executions
       */
      const loggerBindings = this.buildLoggerBindings(botRequest, request.body);
      logger.resetBindings();
      logger.addBindings(loggerBindings);
      let requestLogger = buildRequestLogger(logger, loggerBindings);
      try {
        if (botRequest.triggerType === TriggerType.UNKNOWN) {
          response.sendStatus(400);
          return;
        } else if (botRequest.triggerType === TriggerType.SCHEDULER) {
          // Cloud scheduler tasks (cron)
          await this.handleScheduled(
            botRequest.githubDeliveryId,
            request,
            wrapConfig,
            requestLogger
          );
        } else if (botRequest.triggerType === TriggerType.PUBSUB) {
          const payload = this.parsePubSubPayload(request);
          await this.enqueueTask(
            {
              id: botRequest.githubDeliveryId,
              name: botRequest.eventName,
              body: JSON.stringify(payload),
            },
            requestLogger
          );
        } else if (botRequest.triggerType === TriggerType.TASK) {
          // If the payload contains `tmpUrl` this indicates that the original
          // payload has been written to Cloud Storage; download it.
          const payload = await this.maybeDownloadOriginalBody(request.body);

          // Regenerate the logger bindings based on the downloaded payload
          const loggerBindings = this.buildLoggerBindings(
            botRequest,
            payload || {}
          );
          logger.resetBindings();
          logger.addBindings(loggerBindings);
          requestLogger = buildRequestLogger(logger, loggerBindings);

          const maxRetries = this.getRetryLimit(
            wrapConfig,
            botRequest.eventName
          );
          // Abort task retries if we've hit the max number by
          // returning "success"
          if (botRequest.taskRetryCount > maxRetries) {
            requestLogger.metric('too-many-retries');
            requestLogger.info(
              `Too many retries: ${botRequest.taskRetryCount} > ${maxRetries}`
            );
            // return 200 so we don't retry the task again
            response.send({
              statusCode: 200,
              body: JSON.stringify({message: 'Too many retries'}),
            });
            return;
          }

          // The payload does not exist, stop retrying on this task by letting
          // this request "succeed".
          if (!payload) {
            requestLogger.metric('payload-expired');
            response.send({
              statusCode: 200,
              body: JSON.stringify({message: 'Payload expired'}),
            });
            return;
          }

          setContextLogger(payload, requestLogger);

          try {
            // TODO: find out the best way to get this type, and whether we can
            // keep using a custom event name.
            await this.probot.receive({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              name: botRequest.eventName as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              id: botRequest.githubDeliveryId as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              payload: payload as any,
            });
          } catch (e) {
            const rateLimits = parseRateLimitError(e);
            if (rateLimits) {
              requestLogger.warn('Rate limit exceeded', rateLimits);
              // On GitHub quota issues, return a 503 to throttle our task queues
              // https://cloud.google.com/tasks/docs/common-pitfalls#backoff_errors_and_enforced_rates
              const statusCode = wrapConfig.throttleOnRateLimits ? 503 : 500;
              response.status(statusCode).send({
                statusCode: statusCode,
                body: JSON.stringify({
                  ...rateLimits,
                  message: 'Rate Limited',
                }),
              });
              return;
            } else {
              // If a bot throws ServicceUnavailable, returns 503 for throttle task queue.
              let isServiceUnavailable = e instanceof ServiceUnavailable;
              let serviceUnavailableMessage =
                e instanceof ServiceUnavailable ? e.message : '';
              let serviceUnavailableStack =
                e instanceof ServiceUnavailable ? e.originalError.stack : '';
              if (e instanceof AggregateError) {
                for (const inner of e) {
                  if (inner instanceof ServiceUnavailable) {
                    isServiceUnavailable = true;
                    serviceUnavailableMessage = inner.message;
                    serviceUnavailableStack = inner.originalError.stack;
                  }
                }
              }
              if (isServiceUnavailable) {
                requestLogger.warn(
                  'ServiceUnavailable',
                  serviceUnavailableMessage,
                  serviceUnavailableStack
                );
                response.status(503).send({
                  statusCode: 503,
                  body: JSON.stringify({
                    message: serviceUnavailableMessage,
                  }),
                });
                return;
              } else {
                throw e;
              }
            }
          }
        } else if (botRequest.triggerType === TriggerType.GITHUB) {
          const installationId = parseInstallationId(request.body);
          if (
            !(await this.installationHandler.isOrganizationAllowed(
              installationId
            ))
          ) {
            requestLogger.warn(
              `Request disallowed for installation ${installationId} not in allowlist, skipping.`
            );
          } else {
            await this.enqueueTask(
              {
                id: botRequest.githubDeliveryId,
                name: botRequest.eventName,
                body: JSON.stringify(request.body),
              },
              requestLogger
            );
          }
        }

        response.send({
          statusCode: 200,
          body: JSON.stringify({message: 'Executed'}),
        });
      } catch (err) {
        // only report to error reporting if it's the final attempt
        const maxRetries = this.getRetryLimit(wrapConfig, botRequest.eventName);
        const shouldReportErrors = botRequest.taskRetryCount >= maxRetries;
        logErrors(requestLogger, err, shouldReportErrors);
        response.status(500).send({
          statusCode: 500,
          body: JSON.stringify({message: err.message}),
        });
        return;
      }

      requestLogger.flushSync();
      logger.flushSync();
    };
  }

  private buildLoggerBindings(
    botRequest: BotRequest,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requestBody: {[key: string]: any}
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

  /**
   * Entrypoint for handling all scheduled tasks.
   *
   * @param id {string} GitHub delivery GUID
   * @param body {Scheduled} Scheduler params. May contain additional request
   *   parameters besides the ones defined by the Scheduled type.
   * @param signature
   * @param wrapConfig
   */
  private async handleScheduled(
    id: string,
    req: express.Request,
    wrapConfig: WrapConfig,
    log: GCFLogger
  ) {
    const body: Scheduled = this.parseRequestBody(req);
    const cronType = body.cron_type ?? DEFAULT_CRON_TYPE;
    if (cronType === 'global') {
      await this.handleScheduledGlobal(id, body, log);
    } else if (cronType === 'installation') {
      await this.handleScheduledInstallation(id, body, wrapConfig, log);
    } else {
      await this.handleScheduledRepository(id, body, wrapConfig, log);
    }
  }

  /**
   * Handle a scheduled tasks that should run once. Queues up a Cloud Task
   * for the `schedule.global` event.
   *
   * @param id {string} GitHub delivery GUID
   * @param body {Scheduled} Scheduler params. May contain additional request
   *   parameters besides the ones defined by the Scheduled type.
   * @param signature
   */
  private async handleScheduledGlobal(
    id: string,
    body: Scheduled,
    log: GCFLogger
  ) {
    await this.enqueueTask(
      {
        id,
        name: SCHEDULER_GLOBAL_EVENT_NAME,
        body: JSON.stringify(body),
      },
      log
    );
  }

  /**
   * Handle a scheduled tasks that should run per-installation.
   *
   * If an installation is specified (via installation.id in the payload),
   * queue up a Cloud Task (`schedule.installation`) for that installation
   * only. Otherwise, list all installations of the app and queue up a
   * Cloud Task for each installation.
   *
   * @param id {string} GitHub delivery GUID
   * @param body {Scheduled} Scheduler params. May contain additional request
   *   parameters besides the ones defined by the Scheduled type.
   * @param wrapConfig
   */
  private async handleScheduledInstallation(
    id: string,
    body: Scheduled,
    wrapConfig: WrapConfig,
    log: GCFLogger
  ) {
    if (body.installation) {
      await this.enqueueTask(
        {
          id,
          name: SCHEDULER_INSTALLATION_EVENT_NAME,
          body: JSON.stringify(body),
        },
        log
      );
    } else {
      const generator = eachInstallation(wrapConfig);
      for await (const installation of generator) {
        const extraParams: Scheduled = {
          installation: {
            id: installation.id,
          },
        };
        if (installation.targetType === 'Organization' && installation.login) {
          extraParams.cron_org = installation.login;
        }
        const payload = {
          ...body,
          ...extraParams,
        };
        await this.enqueueTask(
          {
            id,
            name: SCHEDULER_INSTALLATION_EVENT_NAME,
            body: JSON.stringify(payload),
          },
          log
        );
      }
    }
  }

  /**
   * Handle a scheduled tasks that should run per-repository.
   *
   * If a repository is specified (via repo in the payload), queue up a
   * Cloud Task for that repository only. If an installation is specified
   * (via installation.id in the payload), list all repositories associated
   * with that installation and queue up a Cloud Task for each repository.
   * If neither is specified, list all installations and all repositories
   * for each installation, then queue up a Cloud Task for each repository.
   *
   * @param id {string} GitHub delivery GUID
   * @param body {Scheduled} Scheduler params. May contain additional request
   *   parameters besides the ones defined by the Scheduled type.
   * @param signature
   * @param wrapConfig
   */
  private async handleScheduledRepository(
    id: string,
    body: Scheduled,
    wrapConfig: WrapConfig,
    log: GCFLogger
  ) {
    if (body.repo) {
      // Job was scheduled for a single repository:
      await this.scheduledToTask(
        body.repo,
        id,
        body,
        SCHEDULER_REPOSITORY_EVENT_NAME,
        log
      );
    } else if (body.installation) {
      const generator = eachInstalledRepository(
        body.installation.id,
        wrapConfig
      );
      const promises: Array<Promise<void>> = new Array<Promise<void>>();
      const batchSize = 30;
      let delayInSeconds = 0; // initial delay for the tasks
      for await (const repo of generator) {
        if (repo.archived === true || repo.disabled === true) {
          continue;
        }
        promises.push(
          this.scheduledToTask(
            repo.fullName,
            id,
            body,
            SCHEDULER_REPOSITORY_EVENT_NAME,
            log,
            delayInSeconds
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
      const installationGenerator = eachInstallation(wrapConfig);
      const promises: Array<Promise<void>> = new Array<Promise<void>>();
      const batchSize = 30;
      let delayInSeconds = 0; // initial delay for the tasks
      for await (const installation of installationGenerator) {
        if (body.allowed_organizations !== undefined) {
          const org = installation.login?.toLowerCase();
          if (!body.allowed_organizations.includes(org)) {
            log.info(`${org} is not allowed for this scheduler job, skipping`);
            continue;
          }
        }
        log.info(
          `Installation: ${installation.login}(${installation.targetType},
           suspended:${installation.suspended})`
        );
        if (installation.suspended) {
          log.info("Skipping this installation because it's suspended");
          continue;
        }
        const generator = eachInstalledRepository(installation.id, wrapConfig);
        const extraParams: Scheduled = {
          installation: {
            id: installation.id,
          },
        };
        if (installation.targetType === 'Organization' && installation.login) {
          extraParams.cron_org = installation.login;
        }

        const payload = {
          ...body,
          ...extraParams,
        };
        for await (const repo of generator) {
          if (repo.archived === true || repo.disabled === true) {
            continue;
          }
          promises.push(
            this.scheduledToTask(
              repo.fullName,
              id,
              payload,
              SCHEDULER_REPOSITORY_EVENT_NAME,
              log,
              delayInSeconds
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

  /**
   * Build an app-based authenticated Octokit instance.
   *
   * @param installationId {number|undefined} The installation id to
   *   authenticate as. Required if you are trying to take action
   *   on an installed repository.
   * @param wrapConfig
   */
  async getAuthenticatedOctokit(
    installationId?: number,
    wrapConfig?: WrapConfig
  ): Promise<Octokit> {
    const cfg = await this.getProbotConfig(wrapConfig?.logging);
    let opts = {
      appId: cfg.appId,
      privateKey: cfg.privateKey,
    };
    if (installationId) {
      opts = {
        ...opts,
        ...{installationId},
      };
    }
    if (wrapConfig?.logging) {
      const LoggingOctokit = Octokit.plugin(LoggingOctokitPlugin)
        .plugin(ConfigPlugin)
        .defaults({authStrategy: createProbotAuth});
      return new LoggingOctokit({auth: opts});
    } else {
      const DefaultOctokit = Octokit.plugin(ConfigPlugin).defaults({
        authStrategy: createProbotAuth,
      });
      return new DefaultOctokit({auth: opts});
    }
  }

  private async scheduledToTask(
    repoFullName: string,
    id: string,
    body: object,
    eventName: string,
    log: GCFLogger,
    delayInSeconds = 0
  ) {
    // The payload from the scheduler is updated with additional information
    // providing context about the organization/repo that the event is
    // firing for.
    const payload = {
      ...body,
      ...this.buildRepositoryDetails(repoFullName),
    };
    try {
      await this.enqueueTask(
        {
          id,
          name: eventName,
          body: JSON.stringify(payload),
        },
        log,
        delayInSeconds
      );
    } catch (err) {
      log.error(err);
    }
  }

  private parsePubSubPayload(req: express.Request) {
    const body = this.parseRequestBody(req);
    return {
      ...body,
      ...(body.repo ? this.buildRepositoryDetails(body.repo) : {}),
    };
  }

  private parseRequestBody(req: express.Request): Scheduled {
    let body = (
      Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString('utf8'))
        : req.body
    ) as Scheduled;
    // PubSub messages have their payload encoded in body.message.data
    // as a base64 blob.
    if (body.message && body.message.data) {
      body = JSON.parse(Buffer.from(body.message.data, 'base64').toString());
    }
    return body;
  }

  private buildRepositoryDetails(repoFullName: string): {} {
    const [orgName, repoName] = repoFullName.split('/');
    return {
      repository: {
        name: repoName,
        full_name: repoFullName,
        owner: {
          login: orgName,
          name: orgName,
        },
      },
      organization: {
        login: orgName,
      },
    };
  }

  /**
   * Return the URL to reach a specified Cloud Run instance.
   * @param {string} projectId The project id running the Cloud Run instance
   * @param {string} location The location of the Cloud Run instance
   * @param {string} botName The name of the target bot
   * @returns {string} The URL of the Cloud Run instance
   */
  private async getCloudRunUrl(
    projectId: string,
    location: string,
    botName: string
  ): Promise<string | null> {
    // Cloud Run service names can only use dashes
    const serviceName = botName.replace(/_/g, '-');
    const name = `projects/${projectId}/locations/${location}/services/${serviceName}`;
    const [res] = await this.cloudRunClient.getService({
      name,
    });
    return res.uri;
  }

  private async getTaskTarget(
    projectId: string,
    location: string,
    botName: string
  ): Promise<string> {
    if (this.taskTargetEnvironment === 'functions') {
      // https://us-central1-repo-automation-bots.cloudfunctions.net/merge_on_green
      const functionName = botName.replace(/-/g, '_');
      return `https://${location}-${projectId}.cloudfunctions.net/${functionName}`;
    } else if (this.taskTargetEnvironment === 'run') {
      if (this.cloudRunURL) {
        return this.cloudRunURL;
      }
      const url = await this.getCloudRunUrl(projectId, location, botName);
      if (url) {
        this.cloudRunURL = url;
        return url;
      }
      throw new Error(`Unable to find url for Cloud Run service: ${botName}`);
    }
    // Shouldn't get here
    throw new Error(`Unknown task target: ${this.taskTargetEnvironment}`);
  }

  /**
   * Schedule a event trigger as a Cloud Task.
   * @param params {EnqueueTaskParams} Task parameters.
   */
  async enqueueTask(
    params: EnqueueTaskParams,
    log: GCFLogger = logger,
    delayInSeconds = 0
  ) {
    log.info(
      `scheduling cloud task targeting: ${this.taskTargetEnvironment}, service: ${this.taskTargetName}, oidc: ${this.taskCaller}`
    );
    // Make a task here and return 200 as this is coming from GitHub
    // queue name can contain only letters ([A-Za-z]), numbers ([0-9]), or hyphens (-):
    const queueName = this.functionName.replace(/_/g, '-');
    const queuePath = this.cloudTasksClient.queuePath(
      this.projectId,
      this.location,
      queueName
    );
    const url = await this.getTaskTarget(
      this.projectId,
      this.location,
      this.taskTargetName
    );
    log.info(`scheduling task in queue ${queueName}`);
    if (params.body) {
      // Payload conists of either the original params.body or, if
      // Cloud Storage has been configured and the size exceeds the
      // threshold, a tmp file in a bucket:
      const payload = await this.maybeWriteBodyToTmp(params.body, log);
      const signature = (await this.probot?.webhooks.sign(payload)) || '';
      await this.cloudTasksClient.createTask({
        parent: queuePath,
        task: {
          dispatchDeadline: {seconds: 60 * 30}, // 30 minutes.
          scheduleTime: {
            seconds: delayInSeconds + Date.now() / 1000,
          },
          httpRequest: {
            httpMethod: 'POST',
            headers: {
              'X-GitHub-Event': params.name || '',
              'X-GitHub-Delivery': params.id || '',
              'X-Hub-Signature': signature,
              'Content-Type': 'application/json',
            },
            url,
            body: Buffer.from(payload),
            oidcToken: {
              serviceAccountEmail: this.taskCaller,
            },
          },
        },
      });
    } else {
      const signature = (await this.probot?.webhooks.sign('')) || '';
      await this.cloudTasksClient.createTask({
        parent: queuePath,
        task: {
          scheduleTime: {
            seconds: delayInSeconds + Date.now() / 1000,
          },
          httpRequest: {
            httpMethod: 'POST',
            headers: {
              'X-GitHub-Event': params.name || '',
              'X-GitHub-Delivery': params.id || '',
              'X-Hub-Signature': signature,
              'Content-Type': 'application/json',
            },
            url,
            oidcToken: {
              serviceAccountEmail: this.taskCaller,
            },
          },
        },
      });
    }
  }

  /*
   * Setting the process.env.WEBHOOK_TMP environment variable indicates
   * that the webhook payload should be written to a tmp file in Cloud
   * Storage. This allows us to circumvent the 100kb limit on Cloud Tasks.
   *
   * @param body
   */
  private async maybeWriteBodyToTmp(
    body: string,
    log: GCFLogger
  ): Promise<string> {
    if (
      this.payloadBucket &&
      Buffer.byteLength(body) > MAX_BODY_SIZE_FOR_CLOUD_TASK
    ) {
      const tmp = `${Date.now()}-${v4()}.txt`;
      const bucket = this.storage.bucket(this.payloadBucket);
      const writeable = bucket.file(tmp).createWriteStream({
        validation: !RUNNING_IN_TEST,
      });
      log.info(`uploading payload to ${tmp}`);
      intoStream(body).pipe(writeable);
      await new Promise((resolve, reject) => {
        writeable.on('error', reject);
        writeable.on('finish', resolve);
      });
      return JSON.stringify({
        tmpUrl: tmp,
      });
    } else {
      log.info('uploading payload directly to Cloud Task');
      return body;
    }
  }

  /*
   * If body has the key tmpUrl, download the original body from a temporary
   * folder in Cloud Storage.
   *
   * @param body
   */
  private async maybeDownloadOriginalBody(payload: {
    [key: string]: string;
  }): Promise<object | null> {
    if (payload.tmpUrl) {
      if (!this.payloadBucket) {
        throw Error('no tmp directory configured');
      }
      const bucket = this.storage.bucket(this.payloadBucket);
      const file = bucket.file(payload.tmpUrl);
      const readable = file.createReadStream({
        validation: !RUNNING_IN_TEST,
      });
      try {
        const content = await getStream(readable);
        logger.info(`downloaded payload from ${payload.tmpUrl}`);
        return JSON.parse(content);
      } catch (e) {
        if (e.code === 404) {
          logger.info(`payload not found ${payload.tmpUrl}`);
          return null;
        }
        logger.error(`failed to download from ${payload.tmpUrl}`, e);
        throw e;
      }
    } else {
      return payload;
    }
  }
}

const loggerCache = new WeakMap<object, GCFLogger>();

// Helper to inject the request logger
function setContextLogger(payload, logger: GCFLogger) {
  loggerCache.set(payload, logger);
}

// Helper to extract the request logger from the request payload.
// If gcf-utils wrapper did not provide a logger, fall back to the
// default logger.
export function getContextLogger(context): GCFLogger {
  const requestLogger = loggerCache.get(context?.payload);
  if (!requestLogger) {
    logger.warn('Failed to find a context logger');
    return logger;
  }
  return requestLogger;
}

interface RateLimits {
  userId?: number;
  remaining?: number;
  reset?: number;
  limit?: number;
  resource?: string;
}
const RATE_LIMIT_MESSAGE = 'API rate limit exceeded';
const RATE_LIMIT_REGEX = new RegExp('API rate limit exceeded for user ID (d+)');
const SECONDARY_RATE_LIMIT_MESSAGE = 'exceeded a secondary rate limit';
function parseRateLimitError(e: Error): RateLimits | undefined {
  // If any of the aggregated errors are rate limit errors, then
  // this should be considered a rate limit error
  if (e instanceof AggregateError) {
    for (const inner of e) {
      const rateLimits = parseRateLimitError(inner);
      if (rateLimits) {
        return rateLimits;
      }
    }
    return undefined;
  } else if (e instanceof RequestError) {
    if (e.status !== 403) {
      return undefined;
    }

    if (
      !!e.message.match(RATE_LIMIT_MESSAGE) ||
      e.response.headers['x-ratelimit-remaining'] === '0'
    ) {
      const messageMatch = e.message.match(RATE_LIMIT_REGEX);
      return {
        userId: messageMatch ? parseInt(messageMatch[1]) : undefined,
        remaining: parseInt(e.response.headers['x-ratelimit-remaining']),
        reset: parseInt(e.response.headers['x-ratelimit-reset']),
        limit: parseInt(e.response.headers['x-ratelimit-limit']),
        resource:
          (e.response.headers['x-ratelimit-resource'] as string) || undefined,
      };
    } else if (e.message.includes(SECONDARY_RATE_LIMIT_MESSAGE)) {
      // Secondary rate limit errors do not return remaining quotas
      return {
        resource: 'secondary',
      };
    }
  } else if (e instanceof GraphqlResponseError) {
    if (e.headers['x-ratelimit-remaining'] === '0') {
      return {
        remaining: parseInt(e.headers['x-ratelimit-remaining']),
        reset: parseInt(e.headers['x-ratelimit-reset']),
        limit: parseInt(e.headers['x-ratelimit-limit']),
        resource: (e.headers['x-ratelimit-resource'] as string) || undefined,
      };
    }
    return undefined;
  }

  // other non-RequestErrors are not considered rate limit errors
  return undefined;
}

/**
 * Log errors for Error Reporting. If the handled error is an
 * AggregateError, log each of its contained errors individually.
 * @param {GCFLogger} logger The logger to log to
 * @param {Error} e The error to log
 */
export function logErrors(
  logger: GCFLogger,
  e: Error,
  shouldReportErrors = true
) {
  // Add "@type" bindings so that Cloud Error Reporting will capture these logs.
  const bindings = logger.getBindings();
  if (shouldReportErrors && bindings['@type'] !== ERROR_REPORTING_TYPE_NAME) {
    logger = logger.child({
      '@type': ERROR_REPORTING_TYPE_NAME,
      ...bindings,
    });
  }
  if (e instanceof AggregateError) {
    for (const inner of e) {
      // AggregateError should not contain an AggregateError, but
      // we can run this recursively anyways.
      logErrors(logger, inner, shouldReportErrors);
    }
  } else {
    logger.error(e);
  }
}
