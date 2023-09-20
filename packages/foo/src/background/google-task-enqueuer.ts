import {TaskEnqueuer, BackgroundRequest} from './task-enqueuer';
import {BotRequest} from '../bot-request';
import {GCFLogger} from '../gcf-utils';
import {v2 as CloudTasksV2} from '@google-cloud/tasks';
import {v2 as CloudRunV2} from '@google-cloud/run';
import { BotEnvironment } from '../webhook-handler';

export class GoogleTaskEnqueuer implements TaskEnqueuer {
  private projectId: string;
  private botName: string;
  private location: string;
  private cloudTasksClient: CloudTasksV2.CloudTasksClient;
  private cloudRunClient: CloudRunV2.ServicesClient;
  private cloudRunUrl?: string;

  constructor(projectId: string, botName: string, location: string) {
    this.projectId = projectId;
    this.botName = botName;
    this.location = location;
    // TODO: inject existing client
    this.cloudTasksClient = new CloudTasksV2.CloudTasksClient();
    this.cloudRunClient = new CloudRunV2.ServicesClient();
  }

  async loadTask(request: BotRequest, logger: GCFLogger): Promise<BotRequest> {
    return request;
  }
  async enqueueTask(
    request: BackgroundRequest,
    logger: GCFLogger
  ): Promise<void> {
    logger.info(
      `scheduling cloud task targeting: ${request.targetEnvironment}, service: ${request.targetName}`
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
      request.targetEnvironment,
      request.targetName
    );
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
