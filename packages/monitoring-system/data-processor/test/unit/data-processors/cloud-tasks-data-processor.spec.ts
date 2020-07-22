// Copyright 2020 Google LLC
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
import {describe, it, beforeEach} from 'mocha';
import assert from 'assert';
import {CloudTasksProcessor} from '../../../src/data-processors/cloud-tasks-data-processor';
import {protos} from '@google-cloud/tasks';
import {MockFirestore, FirestoreData} from './mock-firestore';
import {MockCloudTasksClient, TaskQueueData} from './mock-cloud-tasks-client';

class DummyTask implements protos.google.cloud.tasks.v2.ITask {}
let MockTaskQueueData: TaskQueueData;
let mockFirestoreData1: FirestoreData;
let mockFirestoreData2: FirestoreData;
let mockFirestoreData3: FirestoreData;

function resetMockData() {
  MockTaskQueueData = {
    projectFoo: {
      locationBar: {
        queue1: [
          [new DummyTask(), new DummyTask(), new DummyTask()],
          null,
          {tasks: null, nextPageToken: null},
        ],
        queue2: [[new DummyTask()], null, {tasks: null, nextPageToken: null}],
        queue3: [
          [new DummyTask(), new DummyTask()],
          null,
          {tasks: null, nextPageToken: null},
        ],
      },
    },
  };

  mockFirestoreData1 = {
    Bot: {
      ID1: {
        bot_name: 'bot_a',
      },
      ID2: {
        bot_name: 'bot_b',
      },
      ID3: {
        bot_name: 'bot_c',
      },
    },
  };

  mockFirestoreData2 = {
    Bot: {},
  };

  mockFirestoreData3 = {
    Task_Queue_Status: {},
  };
}

describe('Cloud Tasks Data Processor', () => {
  let mockFirestore: MockFirestore;
  let processor: CloudTasksProcessor;

  beforeEach(() => {
    mockFirestore = new MockFirestore();
    processor = new CloudTasksProcessor(mockFirestore);
    resetMockData();
  });

  describe('getBotNames()', () => {
    it('gets the correct bot names from Firestore when there are 3 bots', () => {
      mockFirestore.setMockData(mockFirestoreData1);
      return processor['getBotNames']().then(names => {
        assert.deepEqual(names, ['bot_a', 'bot_b', 'bot_c']);
      });
    });

    it('returns an empty list when there are no bots in Firestore', () => {
      mockFirestore.setMockData(mockFirestoreData2);
      return processor['getBotNames']().then(names => {
        assert(names.length === 0);
      });
    });

    it('returns an empty list when Bot schema not found', () => {
      mockFirestore.setMockData({});
      return processor['getBotNames']().then(names => {
        assert(names.length === 0);
      });
    });

    it('throws an appropriate error if there is an error connecting to Firestore', () => {
      let thrown = false;
      mockFirestore.setMockData(mockFirestoreData1);
      mockFirestore.throwOnCollection();

      return processor['getBotNames']()
        .catch(() => {
          thrown = true;
        })
        .finally(() => {
          assert(thrown, 'Expected an error to be thrown for timeout');
        });
    });
  });

  describe('storeTaskQueueStatus()', () => {
    it('stores task queue status correctly for 1 or more queues', () => {
      mockFirestore.setMockData(mockFirestoreData3);
      const queueStatus: {[name: string]: number} = {
        queue1: 0,
        queue2: 10,
        queue3: 50,
      };
      return processor['storeTaskQueueStatus'](queueStatus).then(() => {
        const root = mockFirestoreData3.Task_Queue_Status;
        const entry_keys = Object.keys(root);
        assert(entry_keys.length === 3);
        for (const key of entry_keys) {
          const parts = key.split('_');
          const name = root[key].queue_name;
          const timestamp = root[key].timestamp;
          const in_queue = root[key].in_queue;

          assert.equal(name, parts[0]);
          assert.equal(timestamp, parts[1]);
          assert(Object.keys(queueStatus).indexOf(name) > -1);
          assert.equal(queueStatus[name], in_queue);
        }
      });
    });

    it('does not set any data in Firestore if no queue status to store', () => {
      mockFirestore.setMockData(mockFirestoreData3);
      const queueStatus: {[name: string]: number} = {};
      return processor['storeTaskQueueStatus'](queueStatus).then(() => {
        const root = mockFirestoreData3.Task_Queue_Status;
        const entry_keys = Object.keys(root);
        assert(entry_keys.length === 0);
      });
    });

    it('does not overwrite previous status for same queue', () => {
      mockFirestore.setMockData(mockFirestoreData3);
      const queueStatus1: {[name: string]: number} = {
        queue1: 0,
        queue2: 10,
        queue3: 50,
      };
      const queueStatus2: {[name: string]: number} = {
        queue1: 0,
        queue2: 10,
        queue3: 50,
      };
      return processor['storeTaskQueueStatus'](queueStatus1)
        .then(() => {
          return processor['storeTaskQueueStatus'](queueStatus2);
        })
        .then(() => {
          const root = mockFirestoreData3.Task_Queue_Status;
          const entry_keys = Object.keys(root);
          assert(entry_keys.length === 6);
          for (const key of entry_keys) {
            const parts = key.split('_');
            const name = root[key].queue_name;
            const timestamp = root[key].timestamp;
            const in_queue = root[key].in_queue;

            assert.equal(name, parts[0]);
            assert.equal(timestamp, parts[1]);
            assert(Object.keys(queueStatus1).indexOf(name) > -1);
            assert.equal(queueStatus1[name], in_queue);
          }
        });
    });
  });

  describe('getTaskQueueStatus()', () => {
    it('gets task queue status from Cloud Task for 1 queue', () => {
      const mockTasksClient = new MockCloudTasksClient(MockTaskQueueData);
      return new CloudTasksProcessor(undefined, mockTasksClient)
        ['getTaskQueueStatus']('projectFoo', 'locationBar', ['queue1'])
        .then(status => {
          assert.deepEqual(status, {queue1: 3});
        });
    });

    it('gets task queue status from Cloud Tasks for >1 queue', () => {
      const mockTasksClient = new MockCloudTasksClient(MockTaskQueueData);
      return new CloudTasksProcessor(undefined, mockTasksClient)
        ['getTaskQueueStatus']('projectFoo', 'locationBar', [
          'queue1',
          'queue2',
          'queue3',
        ])
        .then(status => {
          assert.deepEqual(status, {queue1: 3, queue2: 1, queue3: 2});
        });
    });

    it('returns an empty object if queueNames is empty', () => {
      const mockTasksClient = new MockCloudTasksClient(MockTaskQueueData);
      return new CloudTasksProcessor(undefined, mockTasksClient)
        ['getTaskQueueStatus']('projectFoo', 'locationBar', [])
        .then(status => {
          assert.deepEqual(status, {});
        });
    });

    it('throws an error if the project is incorrect', () => {
      let thrown = false;
      const mockTasksClient = new MockCloudTasksClient(MockTaskQueueData);
      return new CloudTasksProcessor(undefined, mockTasksClient)
        ['getTaskQueueStatus']('projectFooWrong', 'locationBar', [
          'queue1',
          'queue2',
          'queue3',
        ])
        .catch(() => {
          thrown = true;
        })
        .finally(() => {
          assert(thrown, 'Expected error to be thrown');
        });
    });

    it('throws an error if the location is incorrect', () => {
      let thrown = false;
      const mockTasksClient = new MockCloudTasksClient(MockTaskQueueData);
      return new CloudTasksProcessor(undefined, mockTasksClient)
        ['getTaskQueueStatus']('projectFoo', 'locationBarWrong', [
          'queue1',
          'queue2',
          'queue3',
        ])
        .catch(() => {
          thrown = true;
        })
        .finally(() => {
          assert(thrown, 'Expected error to be thrown');
        });
    });

    it('throws an error if the queue name is incorrect', () => {
      let thrown = false;
      const mockTasksClient = new MockCloudTasksClient(MockTaskQueueData);
      return new CloudTasksProcessor(undefined, mockTasksClient)
        ['getTaskQueueStatus']('projectFoo', 'locationBar', ['queue1Wrong'])
        .catch(() => {
          thrown = true;
        })
        .finally(() => {
          assert(thrown, 'Expected error to be thrown');
        });
    });

    it('throws an error if there is one incorrect queuename among other correct ones', () => {
      let thrown = false;
      const mockTasksClient = new MockCloudTasksClient(MockTaskQueueData);
      return new CloudTasksProcessor(undefined, mockTasksClient)
        ['getTaskQueueStatus']('projectFoo', 'locationBar', [
          'queue1Wrong',
          'queue2',
          'queue3',
        ])
        .catch(() => {
          thrown = true;
        })
        .finally(() => {
          assert(thrown, 'Expected error to be thrown');
        });
    });
  });
});
