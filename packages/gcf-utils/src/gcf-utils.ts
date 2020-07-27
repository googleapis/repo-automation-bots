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
import {createProbot, Probot, ApplicationFunction, Options} from 'probot';
import {CloudTasksClient} from '@google-cloud/tasks';
import {v1} from '@google-cloud/secret-manager';
import * as express from 'express';
import pino from 'pino';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import SonicBoom from 'sonic-boom';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const LoggingOctokitPlugin = require('../src/logging-octokit-plugin.js');

const client = new CloudTasksClient();

interface Repos {
  repos: [
    {
      language: string;
      repo: string;
    }
  ];
}

interface Scheduled {
  repo?: string;
  installation: {
    id: number;
  };
  message?: {[key: string]: string};
}

interface EnqueueTaskParams {
  body: string;
  signature: string;
  id: string;
  name: string;
}

interface LogFn {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (msg: string, ...args: any[]): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (obj: object, msg?: string, ...args: any[]): void;
}

/**
 * A logger standardized logger for Google Cloud Functions
 */
export interface GCFLogger {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  metric: LogFn;
  flushSync: {(): void};
}

export interface WrapOptions {
  background: boolean;
  logging: boolean;
}

export const logger: GCFLogger = initLogger();

export function initLogger(
  dest?: NodeJS.WritableStream | SonicBoom
): GCFLogger {
  const DEFAULT_LOG_LEVEL = 'trace';
  const defaultOptions: pino.LoggerOptions = {
    formatters: {
      level: pinoLevelToCloudLoggingSeverity,
    },
    customLevels: {
      metric: 30,
    },
    base: null,
    messageKey: 'message',
    timestamp: false,
    level: DEFAULT_LOG_LEVEL,
  };

  dest = dest || pino.destination({sync: true});
  const logger = pino(defaultOptions, dest);
  Object.keys(logger).map(prop => {
    if (logger[prop] instanceof Function) {
      logger[prop] = logger[prop].bind(logger);
    }
  });

  const flushSync = () => {
    // flushSync is only available for SonicBoom,
    // which is the default destination wrapper for GCFLogger
    if (dest instanceof SonicBoom) {
      dest.flushSync();
    }
  };

  return {
    ...logger,
    metric: logger.metric.bind(logger),
    flushSync: flushSync,
  };
}

/**
 * Maps Pino's number-based levels to Google Cloud Logging's string-based severity.
 * This allows Pino logs to show up with the correct severity in Logs Viewer.
 * Also preserves the original Pino level
 * @param label the label used by Pino for the level property
 * @param level the numbered level from Pino
 */
function pinoLevelToCloudLoggingSeverity(
  label: string,
  level: number
): {[label: string]: number | string} {
  const severityMap: {[level: number]: string} = {
    10: 'DEBUG',
    20: 'DEBUG',
    30: 'INFO',
    40: 'WARNING',
    50: 'ERROR',
  };
  const UNKNOWN_SEVERITY = 'DEFAULT';
  return {severity: severityMap[level] || UNKNOWN_SEVERITY, level: level};
}

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

/**
 * Type of function execution trigger
 */
export enum TriggerType {
  GITHUB = 'GitHub Webhook',
  SCHEDULER = 'Cloud Scheduler',
  TASK = 'Cloud Task',
  PUBSUB = 'Pub/Sub',
  UNKNOWN = 'Unknown',
}

/**
 * Function trigger information
 */
export interface TriggerInfo {
  trigger: {
    trigger_type: TriggerType;
    trigger_sender?: string;
    github_delivery_guid?: string;
    trigger_source_repo?: {
      owner: string;
      owner_type: string;
      repo_name: string;
    };
    message: string;
  };
}

export class GCFBootstrapper {
  probot?: Probot;

  secretsClient: v1.SecretManagerServiceClient;

  constructor(secretsClient?: v1.SecretManagerServiceClient) {
    this.secretsClient = secretsClient || new v1.SecretManagerServiceClient();
  }

  async loadProbot(
    appFn: ApplicationFunction,
    logging?: boolean
  ): Promise<Probot> {
    if (!this.probot) {
      const cfg = await this.getProbotConfig(logging);
      this.probot = createProbot(cfg);
    }

    this.probot.load(appFn);

    return this.probot;
  }

  getSecretName(): string {
    const projectId = process.env.PROJECT_ID || '';
    const functionName = process.env.GCF_SHORT_FUNCTION_NAME || '';
    return `projects/${projectId}/secrets/${functionName}`;
  }

  getLatestSecretVersionName(): string {
    const secretName = this.getSecretName();
    return `${secretName}/versions/latest`;
  }

  async getProbotConfig(logging?: boolean): Promise<Options> {
    const name = this.getLatestSecretVersionName();
    const [version] = await this.secretsClient.accessSecretVersion({
      name: name,
    });
    // Extract the payload as a string.
    const payload = version?.payload?.data?.toString() || '';
    if (payload === '') {
      throw Error('did not retrieve a payload from SecretManager.');
    }
    const config = JSON.parse(payload);
    if (logging) {
      logger.info('custom logging instance enabled');
      const LoggingOctokit = Octokit.plugin(LoggingOctokitPlugin);
      return {...config, Octokit: LoggingOctokit} as Options;
    } else {
      logger.info('custom logging instance not enabled');
      return config as Options;
    }
  }

  /**
   * Parse the event name, delivery id, signature and task id from the request headers
   * @param request incoming trigger request
   */
  private static parseRequestHeaders(
    request: express.Request
  ): {name: string; id: string; signature: string; taskId: string} {
    const name =
      request.get('x-github-event') || request.get('X-GitHub-Event') || '';
    const id =
      request.get('x-github-delivery') ||
      request.get('X-GitHub-Delivery') ||
      '';
    // TODO: add test to validate this signature is used on the initial
    // webhook from GitHub:
    const signature =
      request.get('x-github-delivery') ||
      request.get('X-GitHub-Delivery') ||
      '';
    const taskId =
      request.get('X-CloudTasks-TaskName') ||
      request.get('x-cloudtasks-taskname') ||
      '';
    return {name, id, signature, taskId};
  }

  /**
   * Determine the type of trigger that started this execution
   * @param name event name from header
   * @param taskId task id from header
   */
  private static parseTriggerType(name: string, taskId: string): TriggerType {
    if (!taskId && name === 'schedule.repository') {
      return TriggerType.SCHEDULER;
    } else if (!taskId && name === 'pubsub.message') {
      return TriggerType.PUBSUB;
    } else if (!taskId && name) {
      return TriggerType.GITHUB;
    } else if (name) {
      return TriggerType.TASK;
    }
    return TriggerType.UNKNOWN;
  }

  /**
   * Build a TriggerInfo object for this execution
   * @param triggerType trigger type for this exeuction
   * @param github_delivery_guid github delivery id for this exeuction
   * @param requestBody body of the incoming trigger request
   */
  private static buildTriggerInfo(
    triggerType: TriggerType,
    github_delivery_guid: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requestBody: {[key: string]: any}
  ): TriggerInfo {
    const triggerInfo: TriggerInfo = {
      trigger: {
        trigger_type: triggerType,
        message: `Execution started by ${triggerType}`,
      },
    };

    if (
      triggerType === TriggerType.GITHUB ||
      triggerType === TriggerType.TASK
    ) {
      triggerInfo.trigger.github_delivery_guid = github_delivery_guid;
    }

    if (triggerType === TriggerType.GITHUB) {
      const sourceRepo = requestBody['repository'] || {};
      const repoName: string = sourceRepo['name'] || 'UNKNOWN';
      const repoOwner = sourceRepo['owner'] || {};
      const ownerName: string = repoOwner['login'] || 'UNKNOWN';
      const ownerType: string = repoOwner['type'] || 'UNKNOWN';
      const sender = requestBody['sender'] || {};
      const senderLogin: string = sender['login'] || 'UNKNOWN';

      const webhookProperties = {
        trigger_source_repo: {
          repo_name: repoName,
          owner: ownerName,
          owner_type: ownerType,
        },
        trigger_sender: senderLogin,
      };

      triggerInfo.trigger = {...webhookProperties, ...triggerInfo.trigger};
    }

    return triggerInfo;
  }

  gcf(
    appFn: ApplicationFunction,
    wrapOptions?: WrapOptions
  ): (request: express.Request, response: express.Response) => Promise<void> {
    return async (request: express.Request, response: express.Response) => {
      wrapOptions = wrapOptions ?? {background: true, logging: false};

      this.probot =
        this.probot || (await this.loadProbot(appFn, wrapOptions?.logging));

      const {name, id, signature, taskId} = GCFBootstrapper.parseRequestHeaders(
        request
      );

      const triggerType: TriggerType = GCFBootstrapper.parseTriggerType(
        name,
        taskId
      );

      logger.metric(
        GCFBootstrapper.buildTriggerInfo(triggerType, id, request.body)
      );

      try {
        if (triggerType === TriggerType.UNKNOWN) {
          response.sendStatus(400);
          return;
        } else if (
          triggerType === TriggerType.TASK ||
          triggerType === TriggerType.PUBSUB ||
          !wrapOptions?.background
        ) {
          if (!wrapOptions?.background) {
            // a bot can opt out of running through tasks, some bots do this
            // due to large payload sizes:
            logger.info(`${id}: skipping cloud tasks`);
          }
          let payload = request.body;
          if (triggerType === TriggerType.PUBSUB) {
            payload = this.parsePubSubPayload(request);
          }
          await this.probot.receive({
            name,
            id,
            payload: payload,
          });
        } else if (triggerType === TriggerType.SCHEDULER) {
          // TODO: currently we assume that scheduled events walk all repos
          // managed by the client libraries team, it would be good to get more
          // clever and instead pull up a list of repos we're installed on by
          // installation ID:
          await this.handleScheduled(id, request, name, signature);
        } else if (triggerType === TriggerType.GITHUB) {
          await this.enqueueTask({
            id,
            name,
            signature,
            body: JSON.stringify(request.body),
          });
        }

        response.send({
          statusCode: 200,
          body: JSON.stringify({message: 'Executed'}),
        });
      } catch (err) {
        response.status(500).send({
          statusCode: 500,
          body: JSON.stringify({message: err.message}),
        });
        return;
      }

      logger.flushSync();
    };
  }

  private async handleScheduled(
    id: string,
    req: express.Request,
    eventName: string,
    signature: string
  ) {
    const body: Scheduled = this.parseRequestBody(req);
    if (body.repo) {
      // Job was scheduled for a single repository:
      await this.scheduledToTask(body.repo, id, body, eventName, signature);
    } else {
      const octokit = new Octokit({
        auth: await this.getInstallationToken(body.installation.id),
      });
      // Installations API documented here: https://developer.github.com/v3/apps/installations/
      const installationsPaginated = octokit.paginate.iterator({
        url: '/installation/repositories',
        method: 'GET',
        headers: {
          Accept: 'application/vnd.github.machine-man-preview+json',
        },
      });
      for await (const response of installationsPaginated) {
        for (const repo of response.data) {
          await this.scheduledToTask(
            repo.full_name,
            id,
            body,
            eventName,
            signature
          );
        }
      }
    }
  }

  async getInstallationToken(installationId: number) {
    return await this.probot!.app!.getInstallationAccessToken({
      installationId,
    });
  }

  private async scheduledToTask(
    repoFullName: string,
    id: string,
    body: object,
    eventName: string,
    signature: string
  ) {
    // The payload from the scheduler is updated with additional information
    // providing context about the organization/repo that the event is
    // firing for.
    const payload = {
      ...body,
      ...this.buildRepositoryDetails(repoFullName),
    };
    try {
      await this.enqueueTask({
        id,
        name: eventName,
        signature,
        body: JSON.stringify(payload),
      });
    } catch (err) {
      logger.warn(err.message);
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
    let body = (Buffer.isBuffer(req.body)
      ? JSON.parse(req.body.toString('utf8'))
      : req.body) as Scheduled;
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

  async enqueueTask(params: EnqueueTaskParams) {
    logger.info('scheduling cloud task');
    // Make a task here and return 200 as this is coming from GitHub
    const projectId = process.env.PROJECT_ID || '';
    const location = process.env.GCF_LOCATION || '';
    // queue name can contain only letters ([A-Za-z]), numbers ([0-9]), or hyphens (-):
    const queueName = (process.env.GCF_SHORT_FUNCTION_NAME || '').replace(
      /_/g,
      '-'
    );
    const queuePath = client.queuePath(projectId, location, queueName);
    // https://us-central1-repo-automation-bots.cloudfunctions.net/merge_on_green:
    const url = `https://${location}-${projectId}.cloudfunctions.net/${process.env.GCF_SHORT_FUNCTION_NAME}`;
    logger.info(`scheduling task in queue ${queueName}`);
    if (params.body) {
      await client.createTask({
        parent: queuePath,
        task: {
          httpRequest: {
            httpMethod: 'POST',
            headers: {
              'X-GitHub-Event': params.name || '',
              'X-GitHub-Delivery': params.id || '',
              'X-Hub-Signature': params.signature || '',
              'Content-Type': 'application/json',
            },
            url,
            body: Buffer.from(params.body),
          },
        },
      });
    } else {
      await client.createTask({
        parent: queuePath,
        task: {
          httpRequest: {
            httpMethod: 'POST',
            headers: {
              'X-GitHub-Event': params.name || '',
              'X-GitHub-Delivery': params.id || '',
              'X-Hub-Signature': params.signature || '',
              'Content-Type': 'application/json',
            },
            url,
          },
        },
      });
    }
  }
}
