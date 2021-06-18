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

type CronType = 'repository' | 'installation' | 'global';
const DEFAULT_CRON_TYPE: CronType = 'repository';
const SCHEDULER_GLOBAL_EVENT_NAME = 'schedule.global';
const SCHEDULER_INSTALLATION_EVENT_NAME = 'schedule.installation';
const SCHEDULER_REPOSITORY_EVENT_NAME = 'schedule.repository';
const SCHEDULER_EVENT_NAMES = [
  SCHEDULER_GLOBAL_EVENT_NAME,
  SCHEDULER_INSTALLATION_EVENT_NAME,
  SCHEDULER_REPOSITORY_EVENT_NAME,
];
const RUNNING_IN_TEST = process.env.NODE_ENV === 'test';

interface Scheduled {
  repo?: string;
  installation: {
    id: number;
  };
  message?: {[key: string]: string};
  cron_type?: CronType;
  cron_org?: string;
}

interface EnqueueTaskParams {
  body: string;
  id: string;
  name: string;
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
}

interface WrapConfig {
  logging: boolean;
  skipVerification: boolean;
  maxCronRetries: number;
  maxRetries: number;
  maxPubSubRetries: number;
}

const DEFAULT_WRAP_CONFIG: WrapConfig = {
  logging: false,
  skipVerification: RUNNING_IN_TEST,
  maxCronRetries: 0,
  maxRetries: 10,
  maxPubSubRetries: 0,
};

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
 * @param {Octokit} octokit - The Octokit instance.
 * @param {string} owner - The owner of the issue.
 * @param {string} repo - The name of the repository.
 * @param {number} issueNumber - The number of the issue.
 * @param {number} installationId - A unique number for identifying the issue
 *   comment.
 * @param {string} commentBody - The body of the comment.
 * @param {boolean} onlyUpdate - If set to true, it will only update an
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
    this.storage = new Storage({autoRetry: !RUNNING_IN_TEST});
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
   * Parse the signature from the request headers.
   *
   * If the expected header is not set, returns `unset` because the verification
   * function throws an exception on empty string when we would rather
   * treat the error as an invalid signature.
   * @param request incoming trigger request
   */
  private static parseSignatureHeader(request: express.Request): string {
    const sha1Signature =
      request.get('x-hub-signature') || request.get('X-Hub-Signature');
    if (sha1Signature) {
      // See https://github.com/googleapis/repo-automation-bots/issues/2092
      return sha1Signature.startsWith('sha1=')
        ? sha1Signature
        : `sha1=${sha1Signature}`;
    }
    return 'unset';
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
    taskRetries: number;
  } {
    const name =
      request.get('x-github-event') || request.get('X-GitHub-Event') || '';
    const id =
      request.get('x-github-delivery') ||
      request.get('X-GitHub-Delivery') ||
      '';
    const signature = this.parseSignatureHeader(request);
    const taskId =
      request.get('X-CloudTasks-TaskName') ||
      request.get('x-cloudtasks-taskname') ||
      '';
    const taskRetries = parseInt(
      request.get('X-CloudTasks-TaskRetryCount') ||
        request.get('x-cloudtasks-taskretrycount') ||
        '0'
    );
    return {name, id, signature, taskId, taskRetries};
  }

  /**
   * Determine the type of trigger that started this execution
   * @param name event name from header
   * @param taskId task id from header
   */
  private static parseTriggerType(name: string, taskId: string): TriggerType {
    if (!taskId && SCHEDULER_EVENT_NAMES.includes(name)) {
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

  gcf(
    appFn: ApplicationFunction,
    wrapOptions?: WrapOptions
  ): (request: express.Request, response: express.Response) => Promise<void> {
    return async (request: express.Request, response: express.Response) => {
      const wrapConfig = this.parseWrapConfig(wrapOptions);

      this.probot =
        this.probot || (await this.loadProbot(appFn, wrapConfig.logging));

      const {name, id, signature, taskId, taskRetries} =
        GCFBootstrapper.parseRequestHeaders(request);

      const triggerType: TriggerType = GCFBootstrapper.parseTriggerType(
        name,
        taskId
      );

      // validate the signature
      if (
        !wrapConfig.skipVerification &&
        !this.probot.webhooks.verify(request.body, signature)
      ) {
        response.send({
          statusCode: 400,
          body: JSON.stringify({message: 'Invalid signature'}),
        });
        return;
      }

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
        } else if (triggerType === TriggerType.SCHEDULER) {
          // Cloud scheduler tasks (cron)
          await this.handleScheduled(id, request, wrapConfig);
        } else if (triggerType === TriggerType.PUBSUB) {
          const payload = this.parsePubSubPayload(request);
          await this.enqueueTask({
            id,
            name,
            body: JSON.stringify(payload),
          });
        } else if (triggerType === TriggerType.TASK) {
          const maxRetries = this.getRetryLimit(wrapConfig, name);
          // Abort task retries if we've hit the max number by
          // returning "success"
          if (taskRetries > maxRetries) {
            logger.metric('too-many-retries');
            logger.info(`Too many retries: ${taskRetries} > ${maxRetries}`);
            response.send({
              statusCode: 200,
              body: JSON.stringify({message: 'Too many retries'}),
            });
            return;
          }

          // If the payload contains `tmpUrl` this indicates that the original
          // payload has been written to Cloud Storage; download it.
          const payload = await this.maybeDownloadOriginalBody(request.body);

          // The payload does not exist, stop retrying on this task by letting
          // this request "succeed".
          if (!payload) {
            logger.metric('payload-expired');
            response.send({
              statusCode: 200,
              body: JSON.stringify({message: 'Payload expired'}),
            });
            return;
          }

          // TODO: find out the best way to get this type, and whether we can
          // keep using a custom event name.
          await this.probot.receive({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            name: name as any,
            id,
            payload,
          });
        } else if (triggerType === TriggerType.GITHUB) {
          await this.enqueueTask({
            id,
            name,
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
    wrapConfig: WrapConfig
  ) {
    const body: Scheduled = this.parseRequestBody(req);
    const cronType = body.cron_type ?? DEFAULT_CRON_TYPE;
    if (cronType === 'global') {
      await this.handleScheduledGlobal(id, body);
    } else if (cronType === 'installation') {
      await this.handleScheduledInstallation(id, body, wrapConfig);
    } else {
      await this.handleScheduledRepository(id, body, wrapConfig);
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
  private async handleScheduledGlobal(id: string, body: Scheduled) {
    await this.enqueueTask({
      id,
      name: SCHEDULER_GLOBAL_EVENT_NAME,
      body: JSON.stringify(body),
    });
  }

  /**
   * Async iterator over each installation for an app.
   *
   * See https://docs.github.com/en/rest/reference/apps#list-installations-for-the-authenticated-app
   * @param wrapConfig {WrapConfig}
   */
  private async *eachInstallation(wrapConfig: WrapConfig) {
    const octokit = await this.getAuthenticatedOctokit(undefined, wrapConfig);
    const installationsPaginated = octokit.paginate.iterator(
      octokit.apps.listInstallations
    );
    for await (const response of installationsPaginated) {
      for (const installation of response.data) {
        yield installation;
      }
    }
  }

  /**
   * Async iterator over each repository for an app installation.
   *
   * See https://docs.github.com/en/rest/reference/apps#list-repositories-accessible-to-the-app-installation
   * @param wrapConfig {WrapConfig}
   */
  private async *eachInstalledRepository(
    installationId: number,
    wrapConfig: WrapConfig
  ) {
    const octokit = await this.getAuthenticatedOctokit(
      installationId,
      wrapConfig
    );
    const installationRepositoriesPaginated = octokit.paginate.iterator(
      octokit.apps.listReposAccessibleToInstallation,
      {
        mediaType: {
          previews: ['machine-man'],
        },
      }
    );
    for await (const response of installationRepositoriesPaginated) {
      for (const repo of response.data) {
        yield repo;
      }
    }
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
    wrapConfig: WrapConfig
  ) {
    if (body.installation) {
      await this.enqueueTask({
        id,
        name: SCHEDULER_INSTALLATION_EVENT_NAME,
        body: JSON.stringify(body),
      });
    } else {
      const generator = this.eachInstallation(wrapConfig);
      for await (const installation of generator) {
        const extraParams: Scheduled = {
          installation: {
            id: installation.id,
          },
        };
        if (
          installation.target_type === 'Organization' &&
          installation?.account?.login
        ) {
          extraParams.cron_org = installation.account.login;
        }
        const payload = {
          ...body,
          ...extraParams,
        };
        await this.enqueueTask({
          id,
          name: SCHEDULER_INSTALLATION_EVENT_NAME,
          body: JSON.stringify(payload),
        });
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
    wrapConfig: WrapConfig
  ) {
    if (body.repo) {
      // Job was scheduled for a single repository:
      await this.scheduledToTask(
        body.repo,
        id,
        body,
        SCHEDULER_REPOSITORY_EVENT_NAME
      );
    } else if (body.installation) {
      const generator = this.eachInstalledRepository(
        body.installation.id,
        wrapConfig
      );
      for await (const repo of generator) {
        if (repo.archived === true || repo.disabled === true) {
          continue;
        }
        await this.scheduledToTask(
          repo.full_name,
          id,
          body,
          SCHEDULER_REPOSITORY_EVENT_NAME
        );
      }
    } else {
      const installationGenerator = this.eachInstallation(wrapConfig);
      const promises: Array<Promise<void>> = new Array<Promise<void>>();
      const batchNum = 30;
      for await (const installation of installationGenerator) {
        const generator = this.eachInstalledRepository(
          installation.id,
          wrapConfig
        );
        const extraParams: Scheduled = {
          installation: {
            id: installation.id,
          },
        };
        if (
          installation.target_type === 'Organization' &&
          installation?.account?.login
        ) {
          extraParams.cron_org = installation.account.login;
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
              repo.full_name,
              id,
              payload,
              SCHEDULER_REPOSITORY_EVENT_NAME
            )
          );
          if (promises.length >= batchNum) {
            await Promise.all(promises);
            promises.splice(0, promises.length);
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
    eventName: string
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

  /**
   * Schedule a event trigger as a Cloud Task.
   * @param params {EnqueueTaskParams} Task parameters.
   */
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
      const signature = this.probot?.webhooks.sign(payload) || '';
      await this.cloudTasksClient.createTask({
        parent: queuePath,
        task: {
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
          },
        },
      });
    } else {
      const signature = this.probot?.webhooks.sign('') || '';
      await this.cloudTasksClient.createTask({
        parent: queuePath,
        task: {
          httpRequest: {
            httpMethod: 'POST',
            headers: {
              'X-GitHub-Event': params.name || '',
              'X-GitHub-Delivery': params.id || '',
              'X-Hub-Signature': signature,
              'Content-Type': 'application/json',
            },
            url,
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
  private async maybeWriteBodyToTmp(body: string): Promise<string> {
    if (process.env.WEBHOOK_TMP) {
      const tmp = `${Date.now()}-${v4()}.txt`;
      const bucket = this.storage.bucket(process.env.WEBHOOK_TMP);
      const writeable = bucket.file(tmp).createWriteStream({
        validation: !RUNNING_IN_TEST,
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
  }): Promise<object | null> {
    if (payload.tmpUrl) {
      if (!process.env.WEBHOOK_TMP) {
        throw Error('no tmp directory configured');
      }
      const bucket = this.storage.bucket(process.env.WEBHOOK_TMP);
      const file = bucket.file(payload.tmpUrl);
      const readable = file.createReadStream({
        validation: process.env.NODE_ENV !== 'test',
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
