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

    // TODO: existing records / double-processing of logs

    describe('correctly formed execution start and execution end logs', () => {

      // what the execution record would look like after receiving just the start log
      const executionRecordStart = {
        document: {
          '4ww4alqs7ikq': {
            execution_id: '4ww4alqs7ikq',
            bot_id: 'merge_on_green',
            start_time: 1595536893000,
            logs_url:
              'https://pantheon.corp.google.com/logs/query;query=resource.type%3D%22' +
              'cloud_function%22%0Alabels.%22execution_id%22%3D%224ww4alqs7ikq%22;' +
              'timeRange=2020-07-23T20:41:33.701320846Z%2F22020-07-23T20:41:33.701320846Z;' +
              'summaryFields=:true:32:beginning?project=repo-automation-bots',
          },
        }, collectionName: "Bot_Execution"
      };

      // what the execution record would look like after receiving just the end log
      const executionRecordEnd = {
        document: {
          '4ww4alqs7ikq': {
            execution_id: '4ww4q2vqvkl1',
            bot_id: 'auto_label',
            end_time: 1595536887000,
          },
        }, collectionName: "Bot_Execution"
      };

      // what the execution record would look like after receiving start + end logs
      const executionRecordBoth = {
        document: { ...executionRecordStart.document, ...executionRecordEnd.document },
        collectionName: "Bot_Execution"
      }

      describe('when no execution record exists', () => {
        it('creates a new execution record and stores execution start logs', () => {
          return testMessage(
            MOCK_MESSAGES.execution_start,
            [executionRecordStart]
          );
        });

        it('creates a new execution record and stores execution end logs', () => {
          return testMessage(
            MOCK_MESSAGES.execution_end,
            [executionRecordEnd]
          );
        });
      });

      describe('when an execution record already exists', () => {
        it('identifies existing record and stores execution start logs', () => {
          return testMessage(
            MOCK_MESSAGES.execution_start,
            [executionRecordBoth],
            [executionRecordEnd]
          );
        });

        it('identifies existing record and stores execution end logs', () => {
          return testMessage(
            MOCK_MESSAGES.execution_end,
            [executionRecordBoth],
            [executionRecordEnd]
          );
        });
      });
    });

    describe('correctly formed trigger information logs', () => {

      const executionRecord = {
        document: {
          '1lth8bxqr88v': {
            execution_id: '1lth8bxqr88v',
          },
        },
        collectionName: 'Bot_Execution',
      };

      const triggerRecord = {
        document: {
          '1lth8bxqr88v': {
            execution_id: '1lth8bxqr88v',
            trigger_type: 'GITHUB_WEBHOOK',
            github_event: '62eb57323fe7436520941da6d02534d2',
          },
        },
        collectionName: 'Trigger',
      };

      const repositoryRecord = {
        document: {
          'java-spanner_googleapis_org': {
            repo_name: 'java-spanner',
            owner_name: 'googleapis',
            owner_type: 'org'
          }
        },
        collectionName: 'GitHub_Repository',
      }

      describe('when no execution and repository record exists', () => {
        it('creates new execution and repository record and stores trigger information logs', () => {
          return testMessage(
            MOCK_MESSAGES.trigger_information,
            [executionRecord, triggerRecord, repositoryRecord]
          );
        });
      });

      describe('when an execution and repository record already exist', () => {
        it('identifies existing record and stores trigger information logs', () => {
          return testMessage(
            MOCK_MESSAGES.trigger_information,
            [executionRecord, triggerRecord, repositoryRecord],
            [executionRecord, repositoryRecord]
          );
        });
      });
    });

    describe('correctly formed GitHub action logs', () => {

      const executionRecord = {
        document: {
          'g36ouppwsu6z': {
            execution_id: 'g36ouppwsu6z',
          },
        },
        collectionName: 'Bot_Execution',
      };

      const actionRecord = {
        document: {
          'g36ouppwsu6z_ISSUE_ADD_LABELS_1596118668017': {
            execution_id: 'g36ouppwsu6z',
            action_type: 'ISSUE_ADD_LABELS',
            timestamp: 1596118668017,
            destination_object: 'ISSUE_python-ndb_googleapis_org_489',
            destination_repo: 'python-ndb_googleapis_org',
            value: 'kokoro:run',
          },
        },
        collectionName: 'Action',
      };

      const repositoryRecord = {
        document: {
          'python-ndb_googleapis_org': {
            repo_name: 'python-ndb',
            owner_name: 'googleapis',
            owner_type: 'org'
          },
        },
        collectionName: 'GitHub_Repository',
      };

      const objectRecord = {
        document: {
          'python-ndb_googleapis_org': {
            repo_name: 'python-ndb',
            owner_name: 'googleapis',
            owner_type: 'org'
          },
        },
        collectionName: 'GitHub_Object',
      };

      describe('when no execution/repository/object record exists', () => {
        it('creates a new execution/repository/object record and stores GitHub action logs', () => {
          return testMessage(
            MOCK_MESSAGES.github_action,
            [executionRecord, actionRecord, objectRecord, repositoryRecord]
          );
        });
      });

      describe('when an execution/repository/object record already exists', () => {
        it('identifies execution/repository/object record and stores GitHub action logs', () => {
          return testMessage(
            MOCK_MESSAGES.github_action,
            [executionRecord, objectRecord, repositoryRecord],
            [actionRecord]
          );
        });
      });
    });

    describe('correctly formed error logs', () => {
      describe('when no execution record exists', () => {
        it('creates a new execution record and stores error logs', () => {
          const expectedRecord1 = {
            document: {
              'pb86861bj247': {
                execution_id: 'pb86861bj247',
              },
            },
            collectionName: 'Bot_Execution',
          };
          const expectedRecord2 = {
            document: {
              'pb86861bj247_1596123567270': {
                execution_id: 'pb86861bj247',
                timestamp: 1596123567270,
                error_msg: 'TypeError: Cannot read property \'name\' of undefined'
              },
            },
            collectionName: 'Error',
          };
          return testMessage(MOCK_MESSAGES.error, [
            expectedRecord1,
            expectedRecord2,
          ]);
        });
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
