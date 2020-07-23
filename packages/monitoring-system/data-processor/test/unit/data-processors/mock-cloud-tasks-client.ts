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

import {CloudTasksClient, protos} from '@google-cloud/tasks';
import {ClientOptions, CallOptions, PaginationCallback} from 'google-gax';

type ITask = protos.google.cloud.tasks.v2.ITask;
type IListTasksRequest = protos.google.cloud.tasks.v2.IListTasksRequest;
type IListTasksResponse = protos.google.cloud.tasks.v2.IListTasksResponse;

/**
 * An interface for mock task queue data
 */
export interface MockTaskQueueData {
  [project: string]: {
    [location: string]: {
      [queueName: string]: [
        ITask[],
        IListTasksRequest | null,
        IListTasksResponse
      ];
    };
  };
}

/**
 * A mock client to mimic Cloud Tasks Client behaviour
 */
export class MockCloudTasksClient extends CloudTasksClient {
  mockData: MockTaskQueueData;

  /**
   * Create a mock client
   * @param mockData mock data to be returned by client
   * @param opts options for the underlying Cloud Tasks Client
   */
  constructor(mockData?: MockTaskQueueData, opts?: ClientOptions) {
    super(opts);
    this.mockData = mockData || {};
  }

  /**
   * Set the mock data to be returned by this client
   * @param mockData mock task queue data
   */
  setMockData(mockData: MockTaskQueueData) {
    this.mockData = mockData;
  }

  /**
   * Returns a path to the given queue.
   * Note: this is a mock implementation that only works with
   * the mock client
   * @param project project in which queue exists
   * @param location location of the queue
   * @param queue the queue name
   */
  queuePath(project: string, location: string, queue: string): string {
    return `${project}/${location}/${queue}`;
  }

  /**
   * Lists the tasks for a queue in the mock data
   * @param request a list request with a parent param that has the queue path
   * @param optionsOrCallback (unused param)
   * @param callback (unused param)
   */
  listTasks(
    request: IListTasksRequest,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    optionsOrCallback?:
      | CallOptions
      | PaginationCallback<
          IListTasksRequest,
          IListTasksResponse | null | undefined,
          ITask
        >,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    callback?: PaginationCallback<
      IListTasksRequest,
      IListTasksResponse | null | undefined,
      ITask
    >
  ): Promise<[ITask[], IListTasksRequest | null, IListTasksResponse]> {
    return new Promise((resolve, reject) => {
      if (!request.parent) {
        reject('No queue path found');
      }
      const parts = request.parent?.split('/') || [];
      if (parts.length !== 3) {
        reject('Invalid queue path');
      }
      const project = this.mockData[parts[0]];
      if (!project) {
        reject(`Project ${parts[0]} does not exist`);
      }
      const location = project[parts[1]];
      if (!location) {
        reject(`Location ${parts[1]} does not exist`);
      }
      const queue = location[parts[2]];
      if (!queue) {
        reject(`Queue ${parts[2]} does not exist`);
      }
      resolve(queue);
    });
  }
}
