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
import {DataProcessor, ProcessorOptions} from './data-processor-abstract';
import {WriteResult} from '@google-cloud/firestore';
import {CloudTasksClient, protos, v2} from '@google-cloud/tasks';
import {
  BotDocument,
  TaskQueueStatusDocument,
  FirestoreCollection,
  getPrimaryKey,
} from '../types/firestore-schema';

type CloudTasksList = [
  protos.google.cloud.tasks.v2.ITask[],
  protos.google.cloud.tasks.v2.IListTasksRequest | null,
  protos.google.cloud.tasks.v2.IListTasksResponse
];

interface QueueStatus {
  [queueName: string]: number;
}

export interface CloudTasksProcessorOptions extends ProcessorOptions {
  tasksClient?: v2.CloudTasksClient;
  taskQueueProjectId: string;
  taskQueueLocation: string;
}

/**
 * Collects the current status of Cloud Task queues associated
 * with repo automation bots and inserts it into Firestore
 */
export class CloudTasksProcessor extends DataProcessor {
  private projectId: string;
  private location: string;
  private tasksClient: v2.CloudTasksClient;

  /**
   * Create a Cloud Tasks data processor
   * @param firestore (optional) a custom Firestore client
   * @param tasksClient (optional) a custom Cloud Tasks client
   */
  constructor(options: CloudTasksProcessorOptions) {
    super(options);
    this.projectId = options.taskQueueProjectId;
    this.location = options.taskQueueLocation;
    this.tasksClient = options.tasksClient || new CloudTasksClient();
  }

  public getTasksProjectId(): string {
    return this.projectId;
  }

  public getTasksProjectLocation(): string {
    return this.location;
  }

  public async collectAndProcess(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.getBotNames()
        .then(botNames => {
          const queueNames = botNames.map(this.botNameToQueueName);
          return this.getTaskQueueStatus(
            this.projectId,
            this.location,
            queueNames
          );
        })
        .then(queueStatus => {
          return this.storeTaskQueueStatus(queueStatus);
        })
        .then(() => resolve())
        .catch(error => {
          console.trace(error);
          reject(`Failed to collect and process Cloud Tasks data: ${error}`);
        });
    });
  }

  private async getBotNames(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      this.firestore
        .collection(FirestoreCollection.Bot)
        .get()
        .then(botCollection => {
          if (!botCollection) {
            reject('Got falsy results from Firestore');
            return;
          }
          const botDocuments: BotDocument[] = botCollection.docs.map(
            doc => doc.data() as BotDocument
          );
          resolve(botDocuments.map(doc => doc.bot_name));
        })
        .catch(error => {
          console.trace(error); // TODO: replace with logger
          reject(error);
        });
    });
  }

  private async getTaskQueueStatus(
    project: string,
    location: string,
    queueNames: string[]
  ): Promise<QueueStatus> {
    return new Promise<QueueStatus>((resolve, reject) => {
      const queueStatus: QueueStatus = {};

      const taskListPromises: Promise<void>[] = queueNames.map(queueName => {
        const queuePath = this.tasksClient.queuePath(
          project,
          location,
          queueName
        );
        return this.tasksClient
          .listTasks({parent: queuePath})
          .then((taskList: CloudTasksList) => {
            queueStatus[queueName] = taskList[0].length;
          })
          .catch(error => reject(error));
      });

      // Note: this will reject if even one of the calls fails
      Promise.all(taskListPromises)
        .then(() => {
          resolve(queueStatus);
        })
        .catch(error => {
          console.trace(error);
          reject(error);
        });
    });
  }

  private async storeTaskQueueStatus(
    queueStatus: QueueStatus
  ): Promise<number> {
    const currentTimestamp = new Date().getTime();
    const queueNames = Object.keys(queueStatus);

    const writePromises: Promise<WriteResult>[] = queueNames.map(queueName => {
      const documentData: TaskQueueStatusDocument = {
        timestamp: currentTimestamp,
        queue_name: queueName,
        in_queue: queueStatus[queueName],
      };
      return this.updateFirestore({
        doc: documentData,
        collection: FirestoreCollection.TaskQueueStatus,
      });
    });

    return new Promise(resolve => {
      Promise.all(writePromises).then(() => resolve(currentTimestamp));
    });
  }

  // Assumes that queue name == bot name with the exception
  // that all "_" (underscore) are replaced by "-" (hyphen)
  private botNameToQueueName(botName: string): string {
    return botName.replace(/_/gi, '-');
  }
}
