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
import {CloudTasksClient, v2} from '@google-cloud/tasks';

export class CloudTasksProcessor extends DataProcessor {
  private tasksClient: v2.CloudTasksClient;
  
  constructor() {
    super();
    this.tasksClient = new CloudTasksClient();
  }

  public async collectAndProcess(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private static getQueueNames(): Promise<string[]> {
    const root = this.fsRoot();
    root.doc('Bot')
  }
}
