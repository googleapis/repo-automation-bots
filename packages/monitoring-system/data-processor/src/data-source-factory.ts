import {Task} from './task-service';
import {DataSource} from './data-source-abstract';

export class DataSourceFactory {
  public static getDataSource(task: Task): DataSource {
    throw new Error('Not implemented');
  }
}
