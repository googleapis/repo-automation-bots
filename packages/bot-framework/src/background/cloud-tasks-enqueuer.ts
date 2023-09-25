import {TaskEnqueuer, BackgroundRequest} from './task-enqueuer';
import {BotRequest} from '../bot-request';
import {GCFLogger} from '../gcf-utils';
import {v2 as CloudTasksV2} from '@google-cloud/tasks';
import {v2 as CloudRunV2} from '@google-cloud/run';
import {BotEnvironment} from '../webhook-handler';

type PayloadSigner = (payload: string) => Promise<string>;

export class CloudTasksEnqueuer implements TaskEnqueuer {
  private projectId: string;
  private botName: string;
  private location: string;
  private cloudTasksClient: CloudTasksV2.CloudTasksClient;
  private cloudRunClient: CloudRunV2.ServicesClient;
  private cloudRunUrl?: string;
  private payloadSigner: PayloadSigner;
  private taskCaller: string;

  constructor(
    projectId: string,
    botName: string,
    location: string,
    taskCaller: string,
    payloadSigner: PayloadSigner
  ) {
    this.projectId = projectId;
    this.botName = botName;
    this.location = location;
    // TODO: inject existing client
    this.cloudTasksClient = new CloudTasksV2.CloudTasksClient();
    this.cloudRunClient = new CloudRunV2.ServicesClient();
    this.payloadSigner = payloadSigner;
    this.taskCaller = taskCaller;
  }

  async loadTask(request: BotRequest, logger: GCFLogger): Promise<BotRequest> {
    return request;
  }
  async enqueueTask(
    botRequest: BackgroundRequest,
    logger: GCFLogger
  ): Promise<void> {
    logger.info(
      `scheduling cloud task targeting: ${botRequest.targetEnvironment}, service: ${botRequest.targetName}`
    );

    // Make a task here and return 200 as this is coming from GitHub
    // queue name can contain only letters ([A-Za-z]), numbers ([0-9]), or hyphens (-):
    const queueName = this.botName.replace(/_/g, '-');
    const queuePath = this.cloudTasksClient.queuePath(
      this.projectId,
      this.location,
      queueName
    );
    const url = await this.getTaskTarget(
      this.projectId,
      this.location,
      botRequest.targetEnvironment,
      botRequest.targetName
    );
    const delayInSeconds = botRequest.delayInSeconds ?? 0;

    logger.info(`scheduling task in queue ${queueName}`);
    if (botRequest.body) {
      const signature = (await this.payloadSigner(botRequest.body)) || '';
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
              'X-GitHub-Event': botRequest.eventName || '',
              'X-GitHub-Delivery': botRequest.id || '',
              'X-Hub-Signature': signature,
              'Content-Type': 'application/json',
            },
            url,
            body: Buffer.from(botRequest.body),
            oidcToken: {
              serviceAccountEmail: this.taskCaller,
            },
          },
        },
      });
    } else {
      const signature = (await this.payloadSigner('')) || '';
      await this.cloudTasksClient.createTask({
        parent: queuePath,
        task: {
          scheduleTime: {
            seconds: delayInSeconds + Date.now() / 1000,
          },
          httpRequest: {
            httpMethod: 'POST',
            headers: {
              'X-GitHub-Event': botRequest.eventName || '',
              'X-GitHub-Delivery': botRequest.id || '',
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

  private async getTaskTarget(
    projectId: string,
    location: string,
    taskTargetEnvironment: BotEnvironment,
    botName: string
  ): Promise<string> {
    if (taskTargetEnvironment === 'functions') {
      // https://us-central1-repo-automation-bots.cloudfunctions.net/merge_on_green
      return `https://${location}-${projectId}.cloudfunctions.net/${botName}`;
    } else if (taskTargetEnvironment === 'run') {
      if (this.cloudRunUrl) {
        return this.cloudRunUrl;
      }

      const url = await this.getCloudRunUrl(projectId, location, botName);
      if (url) {
        this.cloudRunUrl = url;
        return url;
      }
      throw new Error(`Unable to find url for Cloud Run service: ${botName}`);
    }
    // Shouldn't get here
    throw new Error(`Unknown task target: ${taskTargetEnvironment}`);
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
    return res.uri || null;
  }
}
