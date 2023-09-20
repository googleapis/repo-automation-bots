import {Request, Response} from 'express';
import {Webhooks} from '@octokit/webhooks';
import {SecretLoader, BotSecrets} from './secrets/secret-loader';
import {GoogleSecretLoader} from './secrets/google-secret-loader';
import {parseBotRequest, BotRequest, TriggerType} from './bot-request';
import {GCFLogger} from './logging/gcf-logger';
import {buildTriggerInfo} from './logging/trigger-info-builder';
import {logErrors} from './logging/error-logging';
import {TaskEnqueuer} from './background/task-enqueuer';
import {GoogleTaskEnqueuer} from './background/google-task-enqueuer';
import {
  parseScheduledRequest,
  ScheduledRequest,
} from './background/scheduled-request';
import {SCHEDULER_GLOBAL_EVENT_NAME} from './custom-events';
import * as http from 'http';
import {getServer} from './server';

const DEFAULT_MAX_RETRIES = 10;
const DEFAULT_MAX_CRON_RETRIES = 0;
const DEFAULT_MAX_PUBSUB_RETRIES = 0;

export interface HandlerRequest extends Request {
  rawBody: Buffer;
}

export interface HandlerResponse extends Response {}

interface HandlerBaseOptions {
  taskEnqueuer?: TaskEnqueuer;
  skipVerification?: boolean;
  maxRetries?: number;
  maxCronRetries?: number;
  maxPubSubRetries?: number;
  taskTargetEnvironment?: BotEnvironment;
  taskTargetName?: string;
}

interface WebhookHandlerLoadOptions extends HandlerBaseOptions {
  projectId?: string;
  botName?: string;
  secretLoader?: SecretLoader;
  location?: string;
}

interface WebhookHandlerOptions extends HandlerBaseOptions {
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

export class WebhookHandler {
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

  constructor(options: WebhookHandlerOptions) {
    this.projectId = options.projectId;
    this.botName = options.botName;
    this.botSecrets = options.botSecrets;
    this.location = options.location;
    this.taskEnqueuer =
      options.taskEnqueuer ??
      new GoogleTaskEnqueuer(this.projectId, this.botName, this.location);
    this.skipVerification = options.skipVerification ?? false;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.maxCronRetries = options.maxCronRetries ?? DEFAULT_MAX_CRON_RETRIES;
    this.maxPubSubRetries =
      options.maxPubSubRetries ?? DEFAULT_MAX_PUBSUB_RETRIES;
    this.webhooks = new Webhooks({secret: this.botSecrets.webhookSecret});
    this.taskTargetEnvironment = options.taskTargetEnvironment ?? 'functions';
    this.taskTargetName = options.taskTargetName ?? this.botName;
  }

  static async load(
    options: WebhookHandlerLoadOptions = {}
  ): Promise<WebhookHandler> {
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
    const secretLoader =
      options.secretLoader ?? new GoogleSecretLoader(projectId);
    const botSecrets = await secretLoader.load(botName);
    return new WebhookHandler({
      ...options,
      projectId,
      botSecrets,
      botName,
      location,
    });
  }

  server(appFn: ApplicationFunction): http.Server {
    return getServer(this.gcf(appFn));
  }

  gcf(appFn: ApplicationFunction): HandlerFunction {
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
    request: BotRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    const scheduledRequest = parseScheduledRequest(request);
    switch (scheduledRequest.cron_type) {
      case 'global':
        await this.handleScheduledGlobal(scheduledRequest, response, logger);
        break;
      case 'installation':
        await this.handleScheduledInstallation(
          scheduledRequest,
          response,
          logger
        );
        break;
      case 'repository':
      default:
        await this.handleScheduledRepository(
          scheduledRequest,
          response,
          logger
        );
        break;
    }
    response.status(200).json({message: 'Executed'});
  }

  private async handleScheduledGlobal(
    scheduledRequest: ScheduledRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    logger.debug('Enqueuing global scheduled task');
    await this.taskEnqueuer.enqueueTask(
      {
        id: '',
        eventName: SCHEDULER_GLOBAL_EVENT_NAME,
        body: JSON.stringify(scheduledRequest),
        targetEnvironment: this.taskTargetEnvironment,
        targetName: this.taskTargetName,
      },
      logger
    );
  }

  private async handleScheduledInstallation(
    scheduledRequest: ScheduledRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    logger.debug('Enqueuing per-installation scheduled tasks');
    await this.taskEnqueuer.enqueueTask(
      {
        id: '',
        eventName: SCHEDULER_GLOBAL_EVENT_NAME,
        body: JSON.stringify(scheduledRequest),
        targetEnvironment: this.taskTargetEnvironment,
        targetName: this.taskTargetName,
      },
      logger
    );
  }

  private async handleScheduledRepository(
    scheduledRequest: ScheduledRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    logger.debug('Enqueuing per-repository scheduled task');
    await this.taskEnqueuer.enqueueTask(
      {
        id: '',
        eventName: SCHEDULER_GLOBAL_EVENT_NAME,
        body: JSON.stringify(scheduledRequest),
        targetEnvironment: this.taskTargetEnvironment,
        targetName: this.taskTargetName,
      },
      logger
    );
  }
  private async handlePubSub(
    request: BotRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    response.status(400).json({message: 'FIXME'});
  }

  private async handleTask(
    request: BotRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    this.webhooks.receive({
      id: request.githubDeliveryId,
      name: request.eventName as any,
      payload: request.payload as any,
    });

    response.status(200).json({message: 'Executed'});
  }

  private async handleWebhook(
    request: BotRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    await this.taskEnqueuer.enqueueTask(
      {
        id: request.githubDeliveryId,
        eventName: request.eventName,
        body: JSON.stringify(request.payload),
        targetEnvironment: this.taskTargetEnvironment,
        targetName: this.taskTargetName,
      },
      logger
    );
    response.status(200).json({message: 'Enqueued task'});
  }

  private async handleUnknown(
    request: BotRequest,
    response: HandlerResponse,
    logger: GCFLogger
  ) {
    logger.warn(`Unknown trigger type: ${request.triggerType}`);
    response.status(400).json({message: 'FIXME'});
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
