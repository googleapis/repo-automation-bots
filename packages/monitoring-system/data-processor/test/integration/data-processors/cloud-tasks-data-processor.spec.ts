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
import {describe, it} from 'mocha';
import firebaseAdmin from 'firebase-admin';
import {resolve} from 'path';
import {CloudTasksProcessor} from '../../../src/data-processors/cloud-tasks-data-processor';

describe('Cloud Tasks Data Processor', () => {
  describe('getQueueNames()', () => {
    it('returns queue names from firestore', () => {
      const app = firebaseAdmin.initializeApp(
        {
          credential: firebaseAdmin.credential.cert(
            require(resolve(
              './test/integration/data-processors/firestore-service-key.json'
            ))
          ),
        },
        'cloud_tasks_test'
      );
      const firestore = firebaseAdmin.firestore(app);
      const processor = new CloudTasksProcessor(firestore);
      return processor['getBotNames']()
        .then(names => console.log(names))
        .catch(error => console.log(error));
    });
  });
  describe('getQueueNames()', () => {
    it('gets task queue status from Cloud Task', () => {
      process.env.GOOGLE_APPLICATION_CREDENTIALS = resolve(
        'test/integration/data-processors/cloud-tasks-service-key.json'
      );
      const processor = new CloudTasksProcessor();
      return processor['getTaskQueueStatus'](
        'aziz-sonawalla-test',
        'us-east1',
        ['sample-bot-queue']
      )
        .then(status => console.log(status))
        .catch(error => console.log(error));
    }).timeout(5000);
  });
  describe('storeTaskQueueStatus()', () => {
    it('stores task queue status', () => {
      const app = firebaseAdmin.initializeApp(
        {
          credential: firebaseAdmin.credential.cert(
            require(resolve(
              './test/integration/data-processors/firestore-service-key.json'
            ))
          ),
        },
        'cloud_tasks_test_2'
      );
      const firestore = firebaseAdmin.firestore(app);
      const processor = new CloudTasksProcessor(firestore);
      return processor['storeTaskQueueStatus']({
        queue1: 5,
        queue2: 10,
        queue4: 100,
      }).catch(error => console.log(error));
    });
  });
});
