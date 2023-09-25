import {PayloadCache} from './payload-cache';
import {GCFLogger} from '../logging/gcf-logger';
import {Storage} from '@google-cloud/storage';
import getStream from 'get-stream';
import intoStream from 'into-stream';
import * as uuid from 'uuid';

// A maximum body size in bytes for Cloud Task
export const MAX_BODY_SIZE_FOR_CLOUD_TASK = 665600; // 650KB
export const RUNNING_IN_TEST = process.env.NODE_ENV === 'test';

export class CloudStoragePayloadCache implements PayloadCache {
  private payloadBucket: string;
  private storageClient: Storage;
  private maxBodySize: number;

  constructor(payloadBucket: string) {
    this.payloadBucket = payloadBucket;
    // TODO: configure auto-retry
    this.storageClient = new Storage({
      retryOptions: {autoRetry: !RUNNING_IN_TEST},
    });
    // TODO: configure maxBodySize
    this.maxBodySize = MAX_BODY_SIZE_FOR_CLOUD_TASK;
  }

  async save(body: string, logger: GCFLogger): Promise<string> {
    if (Buffer.byteLength(body) <= this.maxBodySize) {
      logger.info('uploading payload directly to Cloud Tasks');
      return body;
    }
    const tmp = `${Date.now()}-${uuid.v4()}.txt`;
    const bucket = this.storageClient.bucket(this.payloadBucket);
    const writeable = bucket.file(tmp).createWriteStream({
      validation: !RUNNING_IN_TEST,
    });
    logger.info(`uploading payload to ${tmp}`);
    intoStream(body).pipe(writeable);
    await new Promise((resolve, reject) => {
      writeable.on('error', reject);
      writeable.on('finish', resolve);
    });
    return JSON.stringify({
      tmpUrl: tmp,
    });
  }
  async load(
    payload: Record<string, string>,
    logger: GCFLogger
  ): Promise<Record<string, any>> {
    if (!payload.tmpUrl) {
      return payload;
    }
    const bucket = this.storageClient.bucket(this.payloadBucket);
    const file = bucket.file(payload.tmpUrl);
    const readable = file.createReadStream({
      validation: !RUNNING_IN_TEST,
    });
    try {
      const content = await getStream(readable);
      logger.info(`downloaded payload from ${payload.tmpUrl}`);
      return JSON.parse(content);
    } catch (e) {
      if ((e as any).code === 404) {
        logger.info(`payload not found ${payload.tmpUrl}`);
        return payload;
      }
      logger.error(`failed to download from ${payload.tmpUrl}`, e);
      throw e;
    }
  }
}
