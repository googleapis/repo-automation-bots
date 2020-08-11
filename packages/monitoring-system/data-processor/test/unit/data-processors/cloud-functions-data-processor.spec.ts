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

describe('Cloud Functions processor', () => {
  describe('collectAndProcess', () => {
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
        // functionsClient: mockFunctionsClient,
        projectId: 'foo-project',
        location: 'bar-location',
      });
    });

    it('stores bot names retrieved from Cloud Functions', () => {
      mockFunctionsClient.setMockData({
        'foo-project': {
          'bar-location': [
            [{entryPoint: 'bot1'}, {entryPoint: 'bot2'}, {entryPoint: 'bot3'}],
            null,
            {},
          ],
        },
      });

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
    it('does not store anything when there are no Cloud Functions');
    it('does not create duplicate entries for existing bots');
    it('throws an error if Cloud Functions throws an error');
    it('throws an error if Firestore throws an error');
  });
});
