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
  flushSync: Function;
}

export const logger: GCFLogger = initLogger();

export function initLogger(
  dest?: NodeJS.WritableStream | SonicBoom
): GCFLogger {
  const defaultOptions: pino.LoggerOptions = {
    customLevels: {
      metric: 30,
    },
    level: 'trace',
  };

  dest = dest || pino.destination({sync: true});
  const logger = pino(defaultOptions, dest);
  Object.keys(logger).map(prop => {
    if (logger[prop] instanceof Function) {
      logger[prop] = logger[prop].bind(logger);
    }
  });

  const flushSync = () => {
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

export enum TriggerType {
  GITHUB = 'GITHUB_WEBHOOK',
  SCHEDULER = 'SCHEDULER',
  TASK = 'TASK',
  UNKNOWN = 'UNKNOWN',
}

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
  };
}

export class GCFBootstrapper {
  probot?: Probot;

  secretsClient: v1.SecretManagerServiceClient;

  constructor(secretsClient?: v1.SecretManagerServiceClient) {
    this.secretsClient = secretsClient || new v1.SecretManagerServiceClient();
  }

  async loadProbot(appFn: ApplicationFunction): Promise<Probot> {
    if (!this.probot) {
      const cfg = await this.getProbotConfig();
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

  async getProbotConfig(): Promise<Options> {
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
    return config as Options;
  }

  parseRequestHeaders(
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

  parseTriggerType(name: string, taskId: string): TriggerType {
    if (
      !taskId &&
      (name === 'schedule.repository' || name === 'pubsub.message')
    ) {
      return TriggerType.SCHEDULER;
    } else if (!taskId && name) {
      return TriggerType.GITHUB;
    } else if (name) {
      return TriggerType.TASK;
    }
    return TriggerType.UNKNOWN;
  }

  buildTriggerInfo(
    triggerType: TriggerType,
    github_delivery_guid: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    requestBody: {[key: string]: any}
  ): TriggerInfo {
    const triggerInfo: TriggerInfo = {
      trigger: {
        trigger_type: triggerType,
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
    appFn: ApplicationFunction
  ): (request: express.Request, response: express.Response) => Promise<void> {
    return async (request: express.Request, response: express.Response) => {
      // Otherwise let's listen handle the payload
      this.probot = this.probot || (await this.loadProbot(appFn));
      const {name, id, signature, taskId} = this.parseRequestHeaders(request);
      const triggerType: TriggerType = this.parseTriggerType(name, taskId);

      logger.metric(this.buildTriggerInfo(triggerType, id, request.body));

      if (triggerType === TriggerType.SCHEDULER) {
        // TODO: currently we assume that scheduled events walk all repos
        // managed by the client libraries team, it would be good to get more
        // clever and instead pull up a list of repos we're installed on by
        // installation ID:
        try {
          await this.handleScheduled(id, request, name, signature);
        } catch (err) {
          response.status(500).send({
            body: JSON.stringify({message: err}),
          });
          return;
        }
        response.send({
          statusCode: 200,
          body: JSON.stringify({message: 'Executed'}),
        });
      } else if (triggerType === TriggerType.GITHUB) {
        try {
          await this.enqueueTask({
            id,
            name,
            signature,
            body: JSON.stringify(request.body),
          });
        } catch (err) {
          response.status(500).send({
            body: JSON.stringify({message: err}),
          });
          return;
        }
        response.send({
          statusCode: 200,
          body: JSON.stringify({message: 'Executed'}),
        });
        return;
      } else if (triggerType === TriggerType.TASK) {
        try {
          await this.probot.receive({
            name,
            id,
            payload: request.body,
          });
        } catch (err) {
          response.status(500).send({
            statusCode: 500,
            body: JSON.stringify({message: err.message}),
          });
          return;
        }
        response.send({
          statusCode: 200,
          body: JSON.stringify({message: 'Executed'}),
        });
      } else {
        response.sendStatus(400);
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
    let body = (Buffer.isBuffer(req.body)
      ? JSON.parse(req.body.toString('utf8'))
      : req.body) as Scheduled;
    // PubSub messages have their payload encoded in body.message.data
    // as a base64 blob.
    if (body.message && body.message.data) {
      body = JSON.parse(Buffer.from(body.message.data, 'base64').toString());
    }

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
    const [orgName, repoName] = repoFullName.split('/');
    const payload = Object.assign({}, body, {
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
    });
    try {
      await this.enqueueTask({
        id,
        name: eventName,
        signature,
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.warn(err.message);
    }
  }

  async enqueueTask(params: EnqueueTaskParams) {
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
    console.info(`scheduling task in queue ${queueName}`);
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
