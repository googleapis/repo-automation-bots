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
import {resolve} from 'path';
import {CloudTasksProcessor} from '../../../src/data-processors/cloud-tasks-data-processor';
import {MockFirestore, FirestoreData} from './mock-firestore';
import {
  MockCloudTasksClient,
  MockTaskQueueData,
} from './mock-cloud-tasks-client';

const PATH_TO_FIXTURES = 'test/unit/data-processors/fixtures';
interface InputQueueStatus {
  [name: string]: number;
}
interface StoredQueueStatus {
  [name: string]: {in_queue: number; queue_name: string; timestamp: number};
}

describe('Cloud Tasks Data Processor', () => {
  let mockFirestore: MockFirestore;
  let mockTasksClient: MockCloudTasksClient;
  let processor: CloudTasksProcessor;

  let MockTaskQueueData1: MockTaskQueueData;
  let MockFirestoreData1: FirestoreData;
  let MockFirestoreData2: FirestoreData;
  let MockFirestoreData3: FirestoreData;

  function resetMockData() {
    /* eslint-disable @typescript-eslint/no-var-requires */
    MockTaskQueueData1 = require(resolve(
      PATH_TO_FIXTURES,
      'mock-task-queue-data-1.json'
    ));
    MockFirestoreData1 = require(resolve(
      PATH_TO_FIXTURES,
      'mock-firestore-data-1.json'
    ));
    MockFirestoreData2 = require(resolve(
      PATH_TO_FIXTURES,
      'mock-firestore-data-2.json'
    ));
    MockFirestoreData3 = copy(
      require(resolve(PATH_TO_FIXTURES, 'mock-firestore-data-3.json'))
    );
    /* eslint-enable @typescript-eslint/no-var-requires */
  }

  function copy(data: {}): {} {
    return JSON.parse(JSON.stringify(data));
  }

  beforeEach(() => {
    mockFirestore = new MockFirestore();
    mockTasksClient = new MockCloudTasksClient();
    processor = new CloudTasksProcessor({
      firestore: mockFirestore,
      tasksClient: mockTasksClient,
      taskQueueProjectId: 'foo',
      taskQueueLocation: 'bar',
    });
    resetMockData();
  });

  describe('getBotNames()', () => {
    it('gets the correct bot names from Firestore when there are 3 bots', () => {
      mockFirestore.setMockData(MockFirestoreData1);
      return processor['getBotNames']().then(names => {
        assert.deepEqual(names, ['bot_a', 'bot_b', 'bot_c']);
      });
    });

    it('returns an empty list when there are no bots in Firestore', () => {
      mockFirestore.setMockData(MockFirestoreData2);
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

    it('throws an appropriate error if there is an error from Firestore', () => {
      let thrown = false;
      mockFirestore.setMockData(MockFirestoreData1);
      mockFirestore.throwOnCollection();

      return processor['getBotNames']()
        .catch(() => {
          thrown = true;
        })
        .finally(() => {
          assert(thrown, 'Expected an error to be thrown');
        });
    });
  });

  describe('storeTaskQueueStatus()', () => {
    it('stores task queue status correctly for 1 or more queues', () => {
      mockFirestore.setMockData(MockFirestoreData3);
      const queueStatus: InputQueueStatus = {
        queue1: 0,
        queue2: 10,
        queue3: 50,
      };

      return processor['storeTaskQueueStatus'](queueStatus).then(timestamp => {
        const actual = MockFirestoreData3.Task_Queue_Status;
        const expected: StoredQueueStatus = {};
        Object.keys(queueStatus).forEach(key => {
          expected[`${key}_${timestamp}`] = {
            in_queue: queueStatus[key],
            queue_name: key,
            timestamp: timestamp,
          };
        });
        assert.deepEqual(actual, expected);
      });
    });

    it('does not set any data in Firestore if no queue status to store', () => {
      mockFirestore.setMockData(MockFirestoreData3);
      const queueStatus: InputQueueStatus = {};
      return processor['storeTaskQueueStatus'](queueStatus).then(() => {
        const actual = MockFirestoreData3.Task_Queue_Status;
        const expected: StoredQueueStatus = {};
        assert.deepEqual(actual, expected);
      });
    });

    it('does not overwrite previous status for same queue', () => {
      mockFirestore.setMockData(MockFirestoreData3);
      let returnedTimestamp1: number;
      const queueStatus1: InputQueueStatus = {
        queue1: 0,
        queue2: 10,
        queue3: 50,
      };
      const queueStatus2: InputQueueStatus = {
        queue1: 0,
        queue2: 10,
        queue4: 50,
      };
      return processor['storeTaskQueueStatus'](queueStatus1)
        .then(timestamp1 => {
          returnedTimestamp1 = timestamp1;
          return processor['storeTaskQueueStatus'](queueStatus2);
        })
        .then(returnedTimestamp2 => {
          const actual = MockFirestoreData3.Task_Queue_Status;
          const expected: StoredQueueStatus = {};
          Object.keys(queueStatus1).forEach(key => {
            expected[`${key}_${returnedTimestamp1}`] = {
              in_queue: queueStatus1[key],
              queue_name: key,
              timestamp: returnedTimestamp1,
            };
          });
          Object.keys(queueStatus2).forEach(key => {
            expected[`${key}_${returnedTimestamp2}`] = {
              in_queue: queueStatus2[key],
              queue_name: key,
              timestamp: returnedTimestamp2,
            };
          });
          assert.deepEqual(actual, expected);
        });
    });
  });

  describe('getTaskQueueStatus()', () => {
    it('gets task queue status from Cloud Task for 1 queue', () => {
      mockTasksClient.setMockData(MockTaskQueueData1);
      return processor['getTaskQueueStatus']('projectFoo', 'locationBar', [
        'queue1',
      ]).then(status => {
        assert.deepEqual(status, {queue1: 3});
      });
    });

    it('gets task queue status from Cloud Tasks for >1 queue', () => {
      mockTasksClient.setMockData(MockTaskQueueData1);
      return processor['getTaskQueueStatus']('projectFoo', 'locationBar', [
        'queue1',
        'queue2',
        'queue3',
      ]).then(status => {
        assert.deepEqual(status, {queue1: 3, queue2: 1, queue3: 2});
      });
    });

    it('returns an empty object if queueNames is empty', () => {
      mockTasksClient.setMockData(MockTaskQueueData1);
      return processor['getTaskQueueStatus'](
        'projectFoo',
        'locationBar',
        []
      ).then(status => {
        assert.deepEqual(status, {});
      });
    });

    it('throws an error if the project is incorrect', () => {
      let thrown = false;
      mockTasksClient.setMockData(MockTaskQueueData1);
      return processor['getTaskQueueStatus']('projectFooWrong', 'locationBar', [
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
      mockTasksClient.setMockData(MockTaskQueueData1);
      return processor['getTaskQueueStatus']('projectFoo', 'locationBarWrong', [
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
      mockTasksClient.setMockData(MockTaskQueueData1);
      return processor['getTaskQueueStatus']('projectFoo', 'locationBar', [
        'queue1Wrong',
      ])
        .catch(() => {
          thrown = true;
        })
        .finally(() => {
          assert(thrown, 'Expected error to be thrown');
        });
    });

    it('throws an error if there is one incorrect queuename among other correct ones', () => {
      let thrown = false;
      mockTasksClient.setMockData(MockTaskQueueData1);
      return processor['getTaskQueueStatus']('projectFoo', 'locationBar', [
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
