import {DataProcessor} from './data-processor-abstract';

export class GCFProcessor extends DataProcessor {
  public async collectAndProcess(): Promise<void> {
    throw new Error('Method not implemented.');
  }

  private getAllGCFNames(): string[] {
    throw new Error('Method not implemented.');
  }
}
