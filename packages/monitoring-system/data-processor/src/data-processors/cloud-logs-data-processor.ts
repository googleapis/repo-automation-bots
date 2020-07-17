import {DataProcessor} from './data-processor-abstract';

export class CloudLogsProcessor extends DataProcessor {
  public async collectAndProcess(): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
