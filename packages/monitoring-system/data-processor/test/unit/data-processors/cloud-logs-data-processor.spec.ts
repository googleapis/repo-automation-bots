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
import { describe, it, beforeEach } from 'mocha';
import assert from 'assert';
import { MockSubscription } from './mocks/mock-pubsub-subscription';
import { PubSub } from '@google-cloud/pubsub';
import { MockFirestore, MockRecord } from './mock-firestore';
import { CloudLogsProcessor } from '../../../src/data-processors/cloud-logs-data-processor';
import { loadFixture } from './util/test-util';

let mockSubscription: MockSubscription;
let mockFirestore: MockFirestore;
let processor: CloudLogsProcessor;

const MOCK_MESSAGES: { [name: string]: {} } = loadFixture(
  'mock-pubsub-log-messages.json',
  false
);

/**
 * Returns the given object as a Buffer
 * @param obj object to convert
 */
function asBuffer(obj: {}): Buffer {
  return Buffer.from(JSON.stringify(obj));
}

/**
 * Asserts that the given message was properly processed and acked.
 * @param message message to test
 * @param expectedRecords expected records in firestore
 * @param preExistingRecords records to add to firestore before test
 */
async function testMessage(
  message: {},
  expectedRecords: MockRecord[],
  preExistingRecords?: MockRecord[]
): Promise<void> {
  if (preExistingRecords) {
    preExistingRecords.forEach(record => mockFirestore.addRecord(record));
  }
  const processingTask = processor.collectAndProcess();
  const bufferMsg = asBuffer(message);
  const messageId = mockSubscription.sendMockMessage(bufferMsg);
  return processingTask.then(() => {
    assert(mockSubscription.wasAcked(messageId));
    expectedRecords.forEach(record => mockFirestore.assertRecord(record));
  });
}

describe('Cloud Logs Processor', () => {
  describe('collectAndProcess()', () => {
    beforeEach(() => {
      mockFirestore = new MockFirestore({
        Bot_Execution: {},
        Error: {},
        Trigger: {},
        Action: {},
        Action_Type: {},
        GitHub_Repository: {},
        GitHub_Object: {},
      });
      mockSubscription = new MockSubscription(
        new PubSub(),
        'mock-subscription'
      );
      processor = new CloudLogsProcessor({
        firestore: mockFirestore,
        subscription: mockSubscription,
      });
    });

    describe('correctly formed execution start and execution end logs', () => {
      describe('when no execution record exists', () => {
        it('creates a new execution record and stores execution start logs', () => {
          const expectedDocument = {
            '4ww4alqs7ikq': {
              execution_id: '4ww4alqs7ikq',
              bot_id: 'merge_on_green',
              start_time: 1595536893000,
              logs_url:
                'https://pantheon.corp.google.com/logs/query;query=resource.type%3D%22' +
                'cloud_function%22%0Alabels.%22execution_id%22%3D%224ww4alqs7ikq%22;' +
                'timeRange=2020-07-23T20:41:33.701320846Z%2F22020-07-23T20:41:33.701320846Z;' +
                'summaryFields=:true:32:beginning?project=repo-automation-bots',
            }
          };
          return testMessage(MOCK_MESSAGES.execution_start, [{
            document: expectedDocument,
            collectionName: 'Bot_Execution',
          }]);
        });

        it('creates a new execution record and stores execution end logs', () => {
          const expectedDocument = {
            '4ww4q2vqvkl1': {
              execution_id: '4ww4q2vqvkl1',
              bot_id: 'auto_label',
              end_time: 1595536887000,
            }
          };
          return testMessage(MOCK_MESSAGES.execution_end, [{
            document: expectedDocument,
            collectionName: 'Bot_Execution',
          }]);
        });
      });

      describe('when an execution record already exists', () => {
        it('identifies existing record and stores execution start logs', () => {
          const preExistingDocument = {
            '4ww4alqs7ikq': {
              execution_id: '4ww4alqs7ikq',
              end_time: 12345,
            }
          };
          const expectedDocument = {
            '4ww4alqs7ikq': {
              execution_id: '4ww4alqs7ikq',
              bot_id: 'merge_on_green',
              start_time: 1595536893000,
              end_time: 12345,
              logs_url:
                'https://pantheon.corp.google.com/logs/query;query=resource.type%3D%22' +
                'cloud_function%22%0Alabels.%22execution_id%22%3D%224ww4alqs7ikq%22;' +
                'timeRange=2020-07-23T20:41:33.701320846Z%2F22020-07-23T20:41:33.701320846Z;' +
                'summaryFields=:true:32:beginning?project=repo-automation-bots',
            }
          };
          return testMessage(
            MOCK_MESSAGES.execution_start,
            [{ document: expectedDocument, collectionName: 'Bot_Execution' }],
            [{ document: preExistingDocument, collectionName: 'Bot_Execution' }]
          );
        });

        it('identifies existing record and stores execution end logs', () => {
          const preExistingDocument = {
            '4ww4q2vqvkl1': {
              execution_id: '4ww4q2vqvkl1',
              start_time: 12345,
              logs_url: 'some/url',
            }
          };
          const expectedDocument = {
            '4ww4q2vqvkl1': {
              execution_id: '4ww4q2vqvkl1',
              bot_id: 'auto_label',
              end_time: 1595536887000,
              start_time: 12345,
              logs_url: 'some/url',
            }
          };
          return testMessage(
            MOCK_MESSAGES.execution_end,
            [{ document: expectedDocument, collectionName: 'Bot_Execution' }],
            [{ document: preExistingDocument, collectionName: 'Bot_Execution' }]
          );
        });
      });
    });

    describe('correctly formed trigger information logs', () => {
      describe('when no execution record exists', () => {
        it('creates new execution record and stores trigger information logs', () => {
          const expectedRecord1 = {
            document: {
              '1lth8bxqr88v': {
                execution_id: '1lth8bxqr88v'
              },
            }, collectionName: 'Bot_Execution'
          };
          const expectedRecord2 = {
            document: {
              '1lth8bxqr88v': {
                execution_id: '1lth8bxqr88v',
                trigger_type: 'GITHUB_WEBHOOK',
                github_event: '62eb57323fe7436520941da6d02534d2'
              }
            }, collectionName: 'Trigger'
          };
          return testMessage(MOCK_MESSAGES.trigger_information, [expectedRecord1, expectedRecord2]);
        });
      });

      describe('when an execution record already exists', () => {
        it('identifies existing record and stores trigger information logs', () => {
          const preExistingRecord = {
            document: {
              '1lth8bxqr88v': {
                execution_id: '1lth8bxqr88v'
              },
            }, collectionName: 'Bot_Execution'
          };
          const expectedRecord1 = {
            document: {
              '1lth8bxqr88v': {
                execution_id: '1lth8bxqr88v',
                trigger_type: 'GITHUB_WEBHOOK',
                github_event: '62eb57323fe7436520941da6d02534d2'
              }
            }, collectionName: 'Trigger'
          };
          return testMessage(MOCK_MESSAGES.trigger_information, [preExistingRecord, expectedRecord1], [preExistingRecord]);
        });
      });
    });

    describe('correctly formed GitHub action logs', () => {
      describe('when no execution record exists', () => {
        it('creates a new execution record and stores GitHub action logs');
      });

      describe('when an execution record already exists', () => {
        it('identifies existing record and stores GitHub action logs');
      });
    });

    describe('correctly formed error logs', () => {
      describe('when no execution record exists', () => {
        it('creates a new execution record and stores error logs');
      });

      describe('when an execution record already exists', () => {
        it('identifies existing record and stores error logs');
      });
    });

    describe('unidentifiable or malformed logs', () => {
      it('logs error for malformed execution start logs');

      it('logs error for malformed execution end logs');

      it('logs error for malformed trigger information logs');

      it('logs error for malformed GitHub action logs');

      it(
        'processes other correctly formed logs when one of the logs in PubSub message is malformed'
      );

      it('ignores log statements with an unidentified format');
    });

    describe('PubSub interaction', () => {
      it('correctly pulls new messages from PubSub');

      it('acknowledges PubSub messages if they are processed correctly');

      it(
        'does not acknowledge PubSub messages if there is an error in processing'
      );

      it('throws an error when cannot pull messages from PubSub');

      it('throws an error when cannot acknowledge a processed PubSub message');
    });
  });
});
