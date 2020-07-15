import {DataProcessor} from './data-processor-abstract';

export class CloudTasksProcessor extends DataProcessor {
  
  public async collectAndProcess(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
