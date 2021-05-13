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
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {describe, it, before, after} from 'mocha';
import nock from 'nock';

import DataStoreEmulator from 'google-datastore-emulator';
import {DatastoreLock} from '../src/datastore-lock';

chai.use(chaiAsPromised);

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
      await chai.expect(l.release()).to.be.rejectedWith(Error);
      await chai.expect(l2.release()).to.be.rejectedWith(Error);
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
});
