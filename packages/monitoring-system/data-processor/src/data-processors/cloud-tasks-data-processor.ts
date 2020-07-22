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
import {DataProcessor} from './data-processor-abstract';
import {Firestore} from '@google-cloud/firestore';
import {CloudTasksClient, protos, v2} from '@google-cloud/tasks';

type CloudTasksListResponse = [
  protos.google.cloud.tasks.v2.ITask[],
  protos.google.cloud.tasks.v2.IListTasksRequest | null,
  protos.google.cloud.tasks.v2.IListTasksResponse
];

interface QueueStatus {
  [queueName: string]: number;
}

/**
 * Collects the current status of Cloud Task queues associated
 * with repo automation bots and inserts it into Firestore
 */
export class CloudTasksProcessor extends DataProcessor {
  private PROJECT_ID = 'repo-automation-bots';
  private LOCATION = 'us-central1';

  private tasksClient: v2.CloudTasksClient;

  /**
   * Create a Cloud Tasks data processor
   * @param firestore (optional) a custom Firestore client
   * @param tasksClient (optional) a custom Cloud Tasks client
   */
  constructor(firestore?: Firestore, tasksClient?: v2.CloudTasksClient) {
    super(firestore);
    this.tasksClient = tasksClient || new CloudTasksClient();
  }

  public async collectAndProcess(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      this.getBotNames()
        .then(botNames => {
          // assumes that queue name == bot name
          return this.getTaskQueueStatus(
            this.PROJECT_ID,
            this.LOCATION,
            botNames
          );
        })
        .then(queueStatus => {
          return this.storeTaskQueueStatus(queueStatus);
        })
        .then(() => resolve())
        .catch(error => {
          reject(`Failed to collect and process Cloud Tasks data: ${error}`);
        });
    });
  }

  private async getBotNames(): Promise<string[]> {
    return new Promise<string[]>((resolve, reject) => {
      this.firestore
        .collection('Bot')
        .get()
        .then(botDocument => {
          if (!botDocument) {
            reject('Got falsy results from Firestore');
            return;
          }
          const subDocs = botDocument.docs;
          resolve(subDocs.map(doc => doc.data().bot_name));
        })
        .catch(error => reject(error));
    });
  }

  private async getTaskQueueStatus(
    project: string,
    location: string,
    queueNames: string[]
  ): Promise<QueueStatus> {
    return new Promise<QueueStatus>((resolve, reject) => {
      const queueStatus: QueueStatus = {};
      const taskListPromises: Promise<CloudTasksListResponse>[] = [];

      for (const name of queueNames) {
        const queuePath = this.tasksClient.queuePath(project, location, name);
        const taskListPromise = this.tasksClient.listTasks({
          parent: queuePath,
        });

        taskListPromise
          .then(taskList => {
            queueStatus[name] = taskList[0].length;
          })
          .catch(error => reject(error));

        taskListPromises.push(taskListPromise);
      }

      Promise.all(taskListPromises)
        .then(() => {
          resolve(queueStatus);
        })
        .catch(error => reject(error));
    });
  }

  private async storeTaskQueueStatus(
    queueStatus: QueueStatus
  ): Promise<FirebaseFirestore.WriteResult[]> {
    const currentTimestamp = new Date().getTime();
    const collectionRef = this.firestore.collection('Task_Queue_Status');
    const writePromises: Promise<FirebaseFirestore.WriteResult>[] = [];

    for (const queueName of Object.keys(queueStatus)) {
      const docKey = `${queueName}_${currentTimestamp}`;
      const writePromise = collectionRef.doc(docKey)
      .set({
        timestamp: currentTimestamp,
        queue_name: queueName,
        in_queue: queueStatus[queueName],
      });
      writePromises.push(writePromise);
    }

    return Promise.all(writePromises);
  }
}
