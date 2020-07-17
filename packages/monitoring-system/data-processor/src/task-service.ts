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
import express from 'express';
import {DataProcessorFactory, Factory} from './data-processor-factory';

/**
 * Data Processing Tasks
 */
export enum Task {
  ProcessLogs = 'Process Logs Data',
  ProcessTaskQueue = 'Process Task Queue Data',
  ProcessGCF = 'Process Cloud Functions Data',
  ProcessGitHub = 'Process GitHub Data',
}

/**
 * HTTP endpoints mapped to the corresponding Task
 */
export const TaskEndpoints: {[endpoint: string]: Task} = {
  '/task/process-logs': Task.ProcessLogs,
  '/task/process-task-queue': Task.ProcessTaskQueue,
  '/task/process-github': Task.ProcessGitHub,
  '/task/process-gcf': Task.ProcessGCF,
};

/**
 * REST Service that receives and handles Task requests
 */
export class TaskService {
  private app: express.Application;
  private factory: Factory;

  /**
   * Instantiate TaskService
   * @param factory (optional) a custom data processor factory.
   *        Defaults to DataProcessorFactory.
   */
  constructor(factory?: Factory) {
    this.app = express();
    this.factory = factory || new DataProcessorFactory();
    this.mapEndpoints();
  }

  /**
   * Start the service and listen for task requests
   */
  public async start() {
    const port = process.env.PORT || 8080;
    this.app.listen(port, () => {
      console.log('Data Processor started. Now awaiting task requests.', port);
    });
  }

  private mapEndpoints() {
    for (const endpoint of Object.keys(TaskEndpoints)) {
      this.app.get(endpoint, (req, res) =>
        this.handleTask(TaskEndpoints[endpoint], req, res)
      );
    }
  }

  private async handleTask(
    task: Task,
    req: express.Request,
    res: express.Response
  ) {
    try {
      const dataProcessor = this.factory.getDataProcessor(task);
      await dataProcessor.collectAndProcess();
      res.status(200).send({
        status: 'success',
        task: task,
        msg: 'Task was successfully completed',
      });
    } catch (err) {
      res.status(500).send({
        status: 'error',
        task: task,
        msg: 'Error while completing task',
      });
    }
  }
}

const service = new TaskService();
service.start();
