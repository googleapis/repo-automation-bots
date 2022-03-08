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

import assert from 'assert';
import {describe, it, before, after} from 'mocha';
import nock from 'nock';

import DataStoreEmulator from 'google-datastore-emulator';
import {DatastoreLock} from '../src/datastore-lock';

describe('datastore-lock', () => {
  let emulator: DataStoreEmulator;

  before(() => {
    nock.enableNetConnect('127.0.0.1');
    nock.enableNetConnect('localhost');
    const options = {
      useDocker: true,
    };

    emulator = new DataStoreEmulator(options);

    return emulator.start();
  });

  after(() => {
    emulator.stop();
    nock.disableNetConnect();
  });

  describe('lock test', () => {
    it('successfully acquires and releases the lock', async () => {
      const l = new DatastoreLock('datastore-lock-test', 'test', 500);
      const l2 = new DatastoreLock('datastore-lock-test', 'test', 0);
      const l3 = new DatastoreLock('datastore-lock-test', 'test', 0);
      assert(await l.acquire());
      assert(await l2.acquire());
      assert(await l3.acquire());
      await assert.rejects(l.release(), Error);
      await assert.rejects(l2.release(), Error);
      assert(await l3.release());
    });
    it('fails for acquiring and releasing the lock', async () => {
      // This should fail, for better code coverage.
      const l = new DatastoreLock('xxxxx'.repeat(1024), 'test', 0, 50);
      assert(!(await l.acquire()));
      assert(!(await l.release()));
      assert.throws(() => {
        new DatastoreLock('datastore-lock-test', 'test', 120 * 1000 + 1);
      }, Error);
    });
  });

  describe('peek', () => {
    it('returns true if a lock already exists on a key', async () => {
      // First request for lock.
      const l = new DatastoreLock('datastore-lock-test', 'test');
      assert(await l.acquire());
      // Second request asks, is there a lock?
      const l2 = new DatastoreLock('datastore-lock-test', 'test');
      assert(await l2.peek());
      // Cleanup.
      await l.release();
    });
    it('returns false if no lock exists on the key', async () => {
      // First request for lock.
      const l = new DatastoreLock('datastore-lock-test', 'test');
      assert.strictEqual(await l.peek(), false);
    });
    it('return false if peek is called after timeout', async () => {
      // First request for lock.
      const l = new DatastoreLock('datastore-lock-test', 'test', 100);
      assert(await l.acquire());
      await new Promise(resolve => {
        setTimeout(resolve, 250);
      });
      // Second request asks, is there a lock? It should have timed out:
      const l2 = new DatastoreLock('datastore-lock-test', 'test');
      assert.strictEqual(await l2.peek(), false);
    });
  });
});
