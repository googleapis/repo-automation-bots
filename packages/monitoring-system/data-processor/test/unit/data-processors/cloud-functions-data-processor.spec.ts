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
import {MockFirestore} from './mocks/mock-firestore';
import {MockCloudFunctionsClient} from './mocks/mock-cloud-functions-client';
import {CloudFunctionsProcessor} from '../../../src/data-processors/cloud-functions-data-processor';
import {protos} from '@google-cloud/functions';

type CloudFunction = protos.google.cloud.functions.v1.CloudFunction;

describe('Cloud Functions processor', () => {
  describe('collectAndProcess', () => {
    /**
     * Returns a mock CloudFunction object with the given entryPoint.
     * All other data is invalid.
     * @param entryPoint entryPoint for CloudFunction
     */
    function getMockGCFObject(entryPoint: string): CloudFunction {
      return {entryPoint: entryPoint} as CloudFunction;
    }

    let mockFirestore: MockFirestore;
    let mockFunctionsClient: MockCloudFunctionsClient;
    let processor: CloudFunctionsProcessor;

    beforeEach(() => {
      mockFirestore = new MockFirestore({
        Bot: {},
      });
      mockFunctionsClient = new MockCloudFunctionsClient();
      processor = new CloudFunctionsProcessor({
        firestore: mockFirestore,
        functionsClient: mockFunctionsClient,
        projectId: 'foo-project',
      });
    });

    it('stores bot names retrieved from Cloud Functions', () => {
      mockFunctionsClient.setMockData([
        [
          getMockGCFObject('bot1'),
          getMockGCFObject('bot2'),
          getMockGCFObject('bot3'),
        ],
        null,
        null,
      ]);

      return processor.collectAndProcess().then(() => {
        const firestoreData = mockFirestore.getMockData();
        const expectedData = {
          Bot: {
            bot1: {
              bot_name: 'bot1',
            },
            bot2: {
              bot_name: 'bot2',
            },
            bot3: {
              bot_name: 'bot3',
            },
          },
        };
        assert.deepEqual(firestoreData, expectedData);
      });
    });
    it('does not store anything when there are no Cloud Functions', () => {
      mockFunctionsClient.setMockData([[], null, null]);

      return processor.collectAndProcess().then(() => {
        const firestoreData = mockFirestore.getMockData();
        const expectedData = {
          Bot: {},
        };
        assert.deepEqual(firestoreData, expectedData);
      });
    });
    it('does not create duplicate entries for existing bots', () => {
      mockFirestore.setMockData({
        Bot: {
          bot1: {
            bot_name: 'bot1',
          },
          bot2: {
            bot_name: 'bot2',
          },
        },
      });

      mockFunctionsClient.setMockData([
        [
          getMockGCFObject('bot1'),
          getMockGCFObject('bot2'),
          getMockGCFObject('bot3'),
        ],
        null,
        null,
      ]);

      return processor.collectAndProcess().then(() => {
        const firestoreData = mockFirestore.getMockData();
        const expectedData = {
          Bot: {
            bot1: {
              bot_name: 'bot1',
            },
            bot2: {
              bot_name: 'bot2',
            },
            bot3: {
              bot_name: 'bot3',
            },
          },
        };
        assert.deepEqual(firestoreData, expectedData);
      });
    });

    it('throws an error if Cloud Functions throws an error', () => {
      mockFunctionsClient.throwOnGet();
      let thrown = false;
      return processor
        .collectAndProcess()
        .catch(() => (thrown = true))
        .finally(() => assert(thrown, 'Expected error to be thrown'));
    });

    it('throws an error if Firestore throws an error', () => {
      mockFunctionsClient.setMockData([[getMockGCFObject('bot1')], null, null]);

      mockFirestore.throwOnCollection();

      let thrown = false;
      return processor
        .collectAndProcess()
        .catch(() => (thrown = true))
        .finally(() => assert(thrown, 'Expected error to be thrown'));
    });
  });
});
