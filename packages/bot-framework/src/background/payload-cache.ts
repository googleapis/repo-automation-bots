import {GCFLogger} from '../logging/gcf-logger';

export interface PayloadCache {
  save(body: string, logger: GCFLogger): Promise<string>;
  load(
    payload: Record<string, string>,
    logger: GCFLogger
  ): Promise<Record<string, any>>;
}

export class NoopPayloadCache implements PayloadCache {
  async save(body: string, logger: GCFLogger): Promise<string> {
    return body;
  }
  async load(
    payload: Record<string, string>,
    logger: GCFLogger
  ): Promise<Record<string, any>> {
    return payload;
  }
}
