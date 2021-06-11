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

import getStream from 'get-stream';
import intoStream from 'into-stream';

import {v1 as SecretManagerV1} from '@google-cloud/secret-manager';
import {v2 as CloudTasksV2} from '@google-cloud/tasks';
import {Storage} from '@google-cloud/storage';
import * as express from 'express';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {config as ConfigPlugin} from '@probot/octokit-plugin-config';
import {buildTriggerInfo} from './logging/trigger-info-builder';
import {GCFLogger} from './logging/gcf-logger';
import {v4} from 'uuid';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const LoggingOctokitPlugin = require('../src/logging/logging-octokit-plugin.js');

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

export interface WrapOptions {
  background: boolean;
  logging: boolean;
}

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
 * It creates a comment string used for `addOrUpdateissuecomment`.
 */
export const getCommentMark = (installationId: number): string => {
  return `<!-- probot comment [${installationId}]-->`;
};

/**
 * It creates a comment, or if the bot already created a comment, it
 * updates the same comment.
 *
 * @param {Octokit} github - The Octokit instance.
 * @param {string} owner - The owner of the issue.
 * @param {string} repo - The name of the repository.
 * @param {number} issueNumber - The number of the issue.
 * @param {number} installationId - A unique number for identifying the issue
 *   comment
 * @param {string} commentBody - The body of the comment.
 * @param {boolean} onlyUpdate - If set to true, it will only update the
 *   existing issue comment.
 */
export const addOrUpdateIssueComment = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  installationId: number,
  commentBody: string,
  onlyUpdate = false
) => {
  const commentMark = getCommentMark(installationId);
  const listCommentsResponse = await octokit.issues.listComments({
    owner: owner,
    repo: repo,
    per_page: 50, // I think 50 is enough, but I may be wrong.
    issue_number: issueNumber,
  });
  let found = false;
  for (const comment of listCommentsResponse.data) {
    if (comment.body?.includes(commentMark)) {
      // We found the existing comment, so updating it
      await octokit.issues.updateComment({
        owner: owner,
        repo: repo,
        comment_id: comment.id,
        body: `${commentMark}\n${commentBody}`,
      });
      found = true;
    }
  }
  if (!found && !onlyUpdate) {
    await octokit.issues.createComment({
      owner: owner,
      repo: repo,
      issue_number: issueNumber,
      body: `${commentMark}\n${commentBody}`,
    });
  }
};

export class GCFBootstrapper {
  probot?: Probot;

  secretsClient: SecretManagerV1.SecretManagerServiceClient;
  cloudTasksClient: CloudTasksV2.CloudTasksClient;
  storage: Storage;

  constructor(secretsClient?: SecretManagerV1.SecretManagerServiceClient) {
    this.secretsClient =
      secretsClient || new SecretManagerV1.SecretManagerServiceClient();
    this.cloudTasksClient = new CloudTasksV2.CloudTasksClient();
    this.storage = new Storage();
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

    if (Object.prototype.hasOwnProperty.call(config, 'cert')) {
      config.privateKey = config.cert;
      delete config.cert;
    }
    if (Object.prototype.hasOwnProperty.call(config, 'id')) {
      config.appId = config.id;
      delete config.id;
    }
    if (logging) {
      logger.info('custom logging instance enabled');
      const LoggingOctokit = Octokit.plugin(LoggingOctokitPlugin)
        .plugin(ConfigPlugin)
        .defaults({authStrategy: createProbotAuth});
      return {...config, Octokit: LoggingOctokit} as Options;
    } else {
      logger.info('custom logging instance not enabled');
      const DefaultOctokit = Octokit.plugin(ConfigPlugin).defaults({
        authStrategy: createProbotAuth,
      });
      return {
        ...config,
        Octokit: DefaultOctokit,
      } as Options;
    }
  }

  /**
   * Parse the event name, delivery id, signature and task id from the request headers
   * @param request incoming trigger request
   */
  private static parseRequestHeaders(request: express.Request): {
    name: string;
    id: string;
    signature: string;
    taskId: string;
  } {
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

  gcf(
    appFn: ApplicationFunction,
    wrapOptions?: WrapOptions
  ): (request: express.Request, response: express.Response) => Promise<void> {
    return async (request: express.Request, response: express.Response) => {
      wrapOptions = wrapOptions ?? {background: true, logging: false};

      this.probot =
        this.probot || (await this.loadProbot(appFn, wrapOptions?.logging));

      const {name, id, signature, taskId} =
        GCFBootstrapper.parseRequestHeaders(request);

      const triggerType: TriggerType = GCFBootstrapper.parseTriggerType(
        name,
        taskId
      );

      /**
       * Note: any logs written before resetting bindings may contain
       * bindings from previous executions
       */
      logger.resetBindings();
      logger.addBindings(buildTriggerInfo(triggerType, id, name, request.body));
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
            logger.info(`${id}: skipping Cloud Tasks`);
          }
          let payload = request.body;
          if (
            triggerType === TriggerType.PUBSUB ||
            triggerType === TriggerType.SCHEDULER
          ) {
            // TODO(sofisl): investigate why TriggerType.SCHEDULER sometimes has a Buffer
            // for its payload, and other times has an already parsed object.
            //
            // TODO: add unit tests for both forms of payload.
            payload = this.parsePubSubPayload(request);
          }
          // If the payload contains `tmpUrl` this indicates that the original
          // payload has been written to Cloud Storage; download it.
          const body = await this.maybeDownloadOriginalBody(payload);

          // TODO: find out the best way to get this type, and whether we can
          // keep using a custom event name.
          await this.probot.receive({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            name: name as any,
            id,
            payload: body,
          });
        } else if (triggerType === TriggerType.SCHEDULER) {
          // TODO: currently we assume that scheduled events walk all repos
          // managed by the client libraries team, it would be good to get more
          // clever and instead pull up a list of repos we're installed on by
          // installation ID:
          await this.handleScheduled(id, request, name, signature, wrapOptions);
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
        logger.error(err);
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
    signature: string,
    wrapOptions: WrapOptions | undefined
  ) {
    const body: Scheduled = this.parseRequestBody(req);
    if (body.repo) {
      // Job was scheduled for a single repository:
      await this.scheduledToTask(body.repo, id, body, eventName, signature);
    } else {
      const octokit = await this.getAuthenticatedOctokit(
        body.installation.id,
        wrapOptions
      );
      // Installations API documented here: https://developer.github.com/v3/apps/installations/
      const installationsPaginated = octokit.paginate.iterator(
        octokit.apps.listReposAccessibleToInstallation,
        {
          mediaType: {
            previews: ['machine-man'],
          },
        }
      );
      const promises: Array<Promise<void>> = new Array<Promise<void>>();
      const batchNum = 30;
      for await (const response of installationsPaginated) {
        for (const repo of response.data) {
          if (repo.archived === true || repo.disabled === true) {
            continue;
          }
          promises.push(
            this.scheduledToTask(repo.full_name, id, body, eventName, signature)
          );
          if (promises.length >= batchNum) {
            await Promise.all(promises);
            promises.splice(0, promises.length);
          }
        }
      }
      // Wait for the rest.
      if (promises.length > 0) {
        await Promise.all(promises);
        promises.splice(0, promises.length);
      }
    }
  }

  // TODO: How do we still get access to this installation token?
  async getAuthenticatedOctokit(
    installationId: number,
    wrapOptions?: WrapOptions
  ): Promise<Octokit> {
    const cfg = await this.getProbotConfig(wrapOptions?.logging);
    const opts = {
      appId: cfg.appId,
      privateKey: cfg.privateKey,
      installationId,
    };
    if (wrapOptions?.logging) {
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
      logger.error(err);
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
    const queuePath = this.cloudTasksClient.queuePath(
      projectId,
      location,
      queueName
    );
    // https://us-central1-repo-automation-bots.cloudfunctions.net/merge_on_green:
    const url = `https://${location}-${projectId}.cloudfunctions.net/${process.env.GCF_SHORT_FUNCTION_NAME}`;
    logger.info(`scheduling task in queue ${queueName}`);
    if (params.body) {
      // Payload conists of either the original params.body or, if Cloud
      // Storage has been configured, a tmp file in a bucket:
      const payload = await this.maybeWriteBodyToTmp(params.body);
      await this.cloudTasksClient.createTask({
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
            body: Buffer.from(payload),
          },
        },
      });
    } else {
      await this.cloudTasksClient.createTask({
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

  /*
   * Setting the process.env.WEBHOOK_TMP environemtn variable indicates
   * that the webhook payload should be written to a tmp file in Cloud
   * Storage. This allows us to circumvent the 100kb limit on Cloud Tasks.
   *
   * @param body
   */
  private async maybeWriteBodyToTmp(body: string): Promise<string> {
    if (process.env.WEBHOOK_TMP) {
      const tmp = `${Date.now()}-${v4()}.txt`;
      const bucket = this.storage.bucket(process.env.WEBHOOK_TMP);
      const writeable = bucket.file(tmp).createWriteStream({
        validation: process.env.NODE_ENV !== 'test',
      });
      logger.info(`uploading payload to ${tmp}`);
      intoStream(body).pipe(writeable);
      await new Promise((resolve, reject) => {
        writeable.on('error', reject);
        writeable.on('finish', resolve);
      });
      return JSON.stringify({
        tmpUrl: tmp,
      });
    } else {
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
  }): Promise<object> {
    if (payload.tmpUrl) {
      if (!process.env.WEBHOOK_TMP) {
        throw Error('no tmp directory configured');
      }
      const bucket = this.storage.bucket(process.env.WEBHOOK_TMP);
      const file = bucket.file(payload.tmpUrl);
      const readable = file.createReadStream({
        validation: process.env.NODE_ENV !== 'test',
      });
      const content = await getStream(readable);
      console.info(`downloaded payload from ${payload.tmpUrl}`);
      return JSON.parse(content);
    } else {
      return payload;
    }
  }
}
