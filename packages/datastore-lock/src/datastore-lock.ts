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
//

import crypto from 'crypto';
import {v4 as uuidv4} from 'uuid';
import {Datastore, Key} from '@google-cloud/datastore';
import {logger} from 'gcf-utils';

const DEFAULT_LOCK_EXPIRY = 20 * 1000; // 20 seconds
const MAX_LOCK_EXPIRY = 60 * 1000; // 60 seconds
const DEFAULT_LOCK_ACQUIRE_TIMEOUT = 120 * 1000; // 120 seconds
const BACKOFF_INITIAL_DELAY = 2 * 1000; // 1 seconds
const BACKOFF_MAX_DELAY = 10 * 1000; // 10 seconds

let cachedClient: Datastore;

enum AcquireResult {
  Success = 1,
  Failure,
  LockActive,
}

const sleep = (ms: number) => {
  return new Promise(r => setTimeout(r, ms));
};

interface LockEntity {
  expiry: number;
  uuid: string;
}

function isExpired(entity: LockEntity) {
  return Date.now() > entity.expiry;
}

const DATASTORE_LOCK_ERROR_NAME = 'DatastoreLockError';
export class DatastoreLockError extends Error {
  constructor(msg: string) {
    super(msg);
    this.name = DATASTORE_LOCK_ERROR_NAME;
  }
}

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
  private lockAcquireTimeout: number;

  constructor(
    lockId: string,
    target: string,
    lockExpiry: number = DEFAULT_LOCK_EXPIRY,
    lockAcquireTimeout: number = DEFAULT_LOCK_ACQUIRE_TIMEOUT
  ) {
    if (lockExpiry > MAX_LOCK_EXPIRY) {
      throw new Error(
        `lockExpiry is too long, max is ${MAX_LOCK_EXPIRY}, ` +
          `given ${lockExpiry}`
      );
    }
    // It reduces memory overhead on Cloud Function if we
    // only instantiate GRPC client once:
    if (!cachedClient) {
      cachedClient = new Datastore();
    }
    this.datastore = cachedClient;
    this.kind = `ds-lock-${lockId}`;
    this.target = target;
    const hash = crypto.createHash('sha1');
    hash.update(this.target);
    this.key = this.datastore.key([this.kind, hash.digest('hex')]);
    this.uniqueId = uuidv4();
    this.lockExpiry = lockExpiry;
    this.lockAcquireTimeout = lockAcquireTimeout;
  }

  /**
   * Acquire the lock.
   */
  public async acquire(): Promise<boolean> {
    const startTime = Date.now();
    // Avoid multiple clients waiting for the same period of time.
    let waitTime = BACKOFF_INITIAL_DELAY + Math.floor(Math.random() * 1000);
    const maxDelay = BACKOFF_MAX_DELAY + Math.floor(Math.random() * 1000);

    while (Date.now() - startTime < this.lockAcquireTimeout) {
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
      const entity: LockEntity = (await transaction.get(this.key))[0];
      logger.debug(entity);

      if (entity === undefined || isExpired(entity)) {
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
    } catch (e) {
      const err = e as Error;
      err.message = `Error acquiring a lock for ${this.target}: ${err.message}`;
      logger.error(err);
      await transaction.rollback();
      return AcquireResult.Failure;
    }
  }

  /**
   * Release the lock.
   *
   * @throws {DATASTORE_LOCK_ERROR_NAME}
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
        const err = new DatastoreLockError(
          `The lock for ${this.target} was acquired by another process.`
        );
        throw err;
      }
      // The lock is created by myself.
      transaction.delete(this.key);
      await transaction.commit();
      return true;
    } catch (e) {
      if (e instanceof DatastoreLockError) {
        throw e;
      }
      const err = e as Error;
      err.message = `Error releasing a lock for ${this.target}: ${err.message}`;
      logger.error(err);
      await transaction.rollback();
      return false;
    }
  }

  /**
   * Check whether or not a lock currently exists for a key.
   */
  public async peek(): Promise<boolean> {
    const entity: LockEntity = (await this.datastore.get(this.key))[0];
    if (entity?.expiry) return !isExpired(entity);
    else return false;
  }
}

/**
 * Parameters for creating a DatastoreLock.
 */
export interface DatastoreLockDetails {
  /** A unique identifier for the lock.
   * This identifier is used to identify the lock in the datastore. */
  lockId: string;
  /** The name of the resource that the lock is protecting.
   * Usually a url of a github resource. */
  target: string;
  /** If the current process crashes or otherwise fails to release the lock,
   * it will be automatically released in lockExpiry milliseconds. */
  lockExpiry?: number;
  /** Milliseconds to wait while trying to acquire the lock. */
  lockAcquireTimeout?: number;
}

/**
 * Construct a new DatastoreLock.
 */
export function datastoreLockFromDetails(
  details: DatastoreLockDetails
): DatastoreLock {
  return new DatastoreLock(
    details.lockId,
    details.target,
    details.lockExpiry,
    details.lockAcquireTimeout
  );
}

/**
 * Execute a function while holding a lock.
 *
 * @param details The Datastore lock's details.
 * @param f The function to execute while holding the lock.
 * @returns the value returned by f().
 */
export async function withDatastoreLock<R>(
  details: DatastoreLockDetails,
  f: () => Promise<R>
): Promise<R> {
  const lock = datastoreLockFromDetails(details);
  const acquired = await lock.acquire();
  if (!acquired) {
    // throw an error and expect gcf-utils infrastructure to retry
    throw new Error(
      `Failed to acquire lock in ${details.lockAcquireTimeout}ms for ${details.target}.`
    );
  }
  try {
    return await f();
  } finally {
    lock.release();
  }
}
