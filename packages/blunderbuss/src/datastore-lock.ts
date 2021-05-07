// Copyright 2021 Google LLC
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

import {v4 as uuidv4} from 'uuid';
import {Datastore, Key} from '@google-cloud/datastore';
import {logger} from 'gcf-utils';

const DEFAULT_LOCK_EXPIRY = 20 * 1000; // 20 seconds
const MAX_LOCK_EXPIRY = 60 * 1000; // 60 seconds
const LOCK_ACQUIRE_TIMEOUT = 120 * 1000; // 120 seconds
const BACKOFF_INITIAL_DELAY = 2 * 1000; // 1 seconds
const BACKOFF_MAX_DELAY = 10 * 1000; // 10 seconds
const DATASTORE_LOCK_ERROR_NAME = 'DatastoreLockError';

enum AcquireResult {
  Success = 1,
  Failure,
  LockActive,
}

const sleep = (ms: number) => {
  return new Promise(r => setTimeout(r, ms));
};

/**
 * A simple lock backed by Cloud Datastore
 */
export class DatastoreLock {
  private uniqueId: string;
  private kind: string;
  private target: string;
  private datastore: Datastore;
  private key: Key;
  private lockExpiry: number;

  constructor(
    lockId: string,
    target: string,
    lockExpiry: number = DEFAULT_LOCK_EXPIRY
  ) {
    if (lockExpiry > MAX_LOCK_EXPIRY) {
      throw new Error(
        `lockExpiry is too long, max is ${MAX_LOCK_EXPIRY}, ` +
          `given ${lockExpiry}`
      );
    }
    this.datastore = new Datastore();
    this.kind = `ds-lock-${lockId}`;
    this.target = target;
    this.key = this.datastore.key([this.kind, this.target]);
    this.uniqueId = uuidv4();
    this.lockExpiry = lockExpiry;
  }

  /**
   * Acquire the lock.
   */
  public async acquire(): Promise<boolean> {
    const startTime = Date.now();
    // Avoid multiple clients waiting for the same period of time.
    let waitTime = BACKOFF_INITIAL_DELAY + Math.floor(Math.random() * 1000);
    const maxDelay = BACKOFF_MAX_DELAY + Math.floor(Math.random() * 1000);

    while (Date.now() - startTime < LOCK_ACQUIRE_TIMEOUT) {
      const result = await this._acquire();
      if (result === AcquireResult.Success) {
        return true;
      }
      if (result === AcquireResult.Failure) {
        logger.debug(
          `Failed to acquire the lock, retrying after ${waitTime} miliseconds`
        );
      }
      if (result === AcquireResult.LockActive) {
        // The lock is active, wait and retry.
        logger.debug(
          `The lock is active, retrying after ${waitTime} miliseconds`
        );
      }
      await sleep(waitTime);
      waitTime = Math.min(
        maxDelay,
        waitTime + Math.floor(Math.random() * 2000)
      );
    }
    // Timeout
    return false;
  }

  private async _acquire(): Promise<AcquireResult> {
    const transaction = this.datastore.transaction();
    try {
      await transaction.run();
      // First get the entity
      const [entity] = await transaction.get(this.key);
      logger.debug(entity);

      if (entity === undefined || Date.now() > entity.expiry) {
        const entity = {
          key: this.key,
          data: {
            expiry: Date.now() + this.lockExpiry,
            uuid: this.uniqueId,
          },
        };
        transaction.save(entity);
        logger.debug(entity);
        await transaction.commit();
        return AcquireResult.Success;
      } else {
        // The lock is active.
        await transaction.rollback();
        return AcquireResult.LockActive;
      }
    } catch (err) {
      err.message = `Error acquiring a lock: ${err.message}`;
      logger.error(err);
      await transaction.rollback();
      return AcquireResult.Failure;
    }
  }

  /**
   * Release the lock.
   */
  public async release(): Promise<boolean> {
    const transaction = this.datastore.transaction();
    try {
      await transaction.run();
      const [entity] = await transaction.get(this.key);
      if (entity === undefined) {
        await transaction.rollback();
        return true;
      }
      if (entity.uuid !== this.uniqueId) {
        const err = new Error(
          `The lock for ${this.target} was acquired by another process.`
        );
        err.name = DATASTORE_LOCK_ERROR_NAME;
        throw err;
      }
      // The lock is created by myself.
      transaction.delete(this.key);
      await transaction.commit();
      return true;
    } catch (err) {
      if (err.name === DATASTORE_LOCK_ERROR_NAME) {
        throw err;
      }
      err.message = `Error releasing a lock: ${err.message}`;
      logger.error(err);
      await transaction.rollback();
      return false;
    }
  }
}
