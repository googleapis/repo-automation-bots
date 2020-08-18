// Copyright 2020 Google LLC
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
import {Task} from './task-service';
import {
  DataProcessor,
  ProcessorOptions,
} from './data-processors/data-processor-abstract';
import {
  CloudLogsProcessor,
  CloudLogsProcessorOptions,
} from './data-processors/cloud-logs-data-processor';
import {
  CloudFunctionsProcessor,
  CloudFunctionsProcessorOptions,
} from './data-processors/cloud-functions-data-processor';
import {
  CloudTasksProcessor,
  CloudTasksProcessorOptions,
} from './data-processors/cloud-tasks-data-processor';
import {GitHubProcessor} from './data-processors/github-data-processor';
import {ConfigUtil, Config} from './util/config-util';
import {Firestore} from '@google-cloud/firestore';
import {PubSub} from '@google-cloud/pubsub';
import {logger} from './util/logger';

export interface Factory {
  getDataProcessor(task: Task): DataProcessor;
}

export class DataProcessorFactory implements Factory {
  private config: Config;

  constructor(config?: Config) {
    this.config = config || ConfigUtil.getConfig();
  }

  /**
   * Return a relevant data processor for the given task
   * @param task a processing task
   * @throws if no appropriate data processor is found for task
   */
  public getDataProcessor(task: Task): DataProcessor {
    switch (task) {
      case Task.ProcessCloudLogs:
        return new CloudLogsProcessor(this.getLogsProcessorOptions());
      case Task.ProcessCloudFunctions:
        return new CloudFunctionsProcessor(this.getFunctionsProcessorOptions());
      case Task.ProcessTaskQueue:
        return new CloudTasksProcessor(this.getTaskProcessorOptions());
      case Task.ProcessGitHub:
        return new GitHubProcessor(this.getProcessorOptions());
      default:
        logger.error(`Couldn't identify a data processor for task: ${task}`);
        throw new Error(`Couldn't identify a data processor for task: ${task}`);
    }
  }

  private getFunctionsProcessorOptions(): CloudFunctionsProcessorOptions {
    return {
      projectId: this.config.cloud_functions_processor
        .cloud_functions_project_id,
      ...this.getProcessorOptions(),
    };
  }

  private getLogsProcessorOptions(): CloudLogsProcessorOptions {
    const subscription = this.config.cloud_logs_processor.pub_sub_subscription;
    const listenLimit = this.config.cloud_logs_processor.pub_sub_listen_limit;

    return {
      subscription: new PubSub().subscription(subscription),
      listenLimit: listenLimit,
      ...this.getProcessorOptions(),
    };
  }

  private getTaskProcessorOptions(): CloudTasksProcessorOptions {
    return {
      taskQueueProjectId: this.config.task_queue_processor
        .task_queue_project_id,
      taskQueueLocation: this.config.task_queue_processor.task_queue_location,
      ...this.getProcessorOptions(),
    };
  }

  private getProcessorOptions(): ProcessorOptions {
    return {
      firestore: new Firestore({
        projectId: this.config.firestore.project_id,
      }),
    };
  }
}
