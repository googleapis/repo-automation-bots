import {Task} from './task-service';
import {DataProcessor} from './data-processors/data-processor-abstract';
import {CloudLogsProcessor} from './data-processors/cloud-logs-data-processor';
import {GCFProcessor} from './data-processors/cloud-functions-data-processor';
import {CloudTasksProcessor} from './data-processors/cloud-tasks-data-processor';
import {GitHubProcessor} from './data-processors/github-data-processor';

export interface Factory {
  getDataProcessor(task: Task): DataProcessor;
}

export class DataProcessorFactory implements Factory {
  /**
   * Return a relevant data processor for the given task
   * @param task a processing task
   * @throws if no appropriate data processor is found for task
   */
  public getDataProcessor(task: Task): DataProcessor {
    switch (task) {
      case Task.ProcessLogs:
        return new CloudLogsProcessor();
      case Task.ProcessGCF:
        return new GCFProcessor();
      case Task.ProcessTaskQueue:
        return new CloudTasksProcessor();
      case Task.ProcessGitHub:
        return new GitHubProcessor();
      default:
        throw new Error(`Couldn't identify a data processor for task: ${task}`);
    }
  }
}
