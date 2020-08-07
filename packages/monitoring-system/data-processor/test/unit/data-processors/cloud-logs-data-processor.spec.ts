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
import {MockSubscription} from './mocks/mock-pubsub-subscription';
import {PubSub} from '@google-cloud/pubsub';
import {MockFirestore, MockRecord} from './mocks/mock-firestore';
import {CloudLogsProcessor} from '../../../src/data-processors/cloud-logs-data-processor';
import {loadFixture} from './util/test-util';
import {ObjectWritableMock} from 'stream-mock';
import pino from 'pino';

let mockSubscription: MockSubscription;
let mockFirestore: MockFirestore;
let processor: CloudLogsProcessor;

/**
 * Number of seconds that the test Cloud Logs processor should
 * listen to the mock subscription for.
 * 
 * NOTE: Increasing this will have a significant impact on test run times
 */
const LISTEN_LIMIT = 0.5;

/**
 * Returns the given object as a Buffer
 * @param obj object to convert
 */
function asBuffer(obj: {}): Buffer {
  return Buffer.from(JSON.stringify(obj));
}

/**
 * Returns a logger with the given destination
 * @param dest an ObjectWritableMock stream
 */
function getMockLogger(dest: ObjectWritableMock): pino.Logger {
  const defaultOptions: pino.LoggerOptions = {
    base: null,
    messageKey: 'message',
    timestamp: false,
    level: 'trace',
  };
  return pino(defaultOptions, dest);
}

/**
 * Asserts that the given writestream has an error logged
 * with the given message
 */
function assertErrorLogged(
  expectedErrorMsg: string,
  writeStream: ObjectWritableMock
) {
  try {
    writeStream.end();
    const lines: string[] = writeStream.data;
    const jsonLines = lines.map(line => JSON.parse(line));
    assert(jsonLines.length > 0, 'No logs found');
    let foundErrorLog = false;
    for (const line of jsonLines) {
      const isErrorLevel = line.level === 50;
      const hasCorrectMsg =
        line.message && String(line.message).includes(expectedErrorMsg);
      foundErrorLog = isErrorLevel && hasCorrectMsg;
      if (foundErrorLog) break;
    }
    assert(foundErrorLog, 'No relevant errors were logged');
  } catch (error) {
    throw new Error(`Failed to read stream: ${error}`);
  }
}

/**
 * Asserts that the given message was properly processed and acked.
 * @param message message to test
 * @param expectedRecords expected records in firestore
 * @param preExistingRecords records to add to firestore before test
 */
async function testValidMessage(
  message: {},
  expectedRecords: MockRecord[]
): Promise<void> {
  return startAndSendMessage(message)
  .then(messageId => {
    assert(mockSubscription.wasAcked(messageId));
    expectedRecords.forEach(record => mockFirestore.assertRecord(record));
  })
  .catch(error => {
    assert.fail(error);
  });
}

/**
 * Asserts that the given malformed message was properly processed
 * @param malformedMessage a malformed message
 * @param writeStream the stream to which logs are written
 */
async function testMalformedMessage(
  malformedMessage: {},
  expectedErrorMsg: string,
  writeStream: ObjectWritableMock
): Promise<void> {
  return startAndSendMessage(malformedMessage).then(messageId => {
    assert(mockSubscription.wasAcked(messageId));
    assertErrorLogged(expectedErrorMsg, writeStream);
  });
}

/**
 * Starts the processor and sends a message
 * @param message message to send
 * @returns promise with message id
 */
async function startAndSendMessage(message: {}): Promise<string> {
  return startAndSendMultipleMessages([message]).then(ids => ids[0]);
}

/**
 * Starts the processor and sends multiple messages
 * @param messages messages to send
 * @returns promise with an array of message ids
 */
async function startAndSendMultipleMessages(
  messages: Array<{}>
): Promise<string[]> {
  const processingTask = processor.collectAndProcess();
  const allMessages: Array<Promise<string>> = messages.map(message => {
    const messageId = mockSubscription.sendMockMessage(asBuffer(message));
    return processingTask.then(() => {
      return messageId;
    });
  });
  return Promise.all(allMessages);
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
    });

    describe('correctly formed incoming log messages', () => {
      beforeEach(() => {
        processor = new CloudLogsProcessor({
          firestore: mockFirestore,
          subscription: mockSubscription,
          listenLimit: LISTEN_LIMIT,
        });
      });

      describe('execution start and execution end logs', () => {
        // what the execution record would look like after receiving just the start log
        const executionRecordStart = {
          document: {
            '4ww4alqs7ikq': {
              execution_id: '4ww4alqs7ikq',
              bot_name: 'merge_on_green',
              start_time: 1595536893701,
              logs_url:
                `https://pantheon.corp.google.com/logs/query;query=labels.execution_id`+
                `%3D%224ww4alqs7ikq%22;timeRange=2020-07-23T20:41:28.701Z%2F2020-07-23T20:41:38.701Z`+
                `?project=repo-automation-bots&query=%0A`,
            },
          },
          collectionName: 'Bot_Execution',
        };

        // what the execution record would look like after receiving just the end log
        const executionRecordEnd = {
          document: {
            '4ww4alqs7ikq': {
              execution_id: '4ww4alqs7ikq',
              bot_name: 'merge_on_green',
              end_time: 1595536887861,
            },
          },
          collectionName: 'Bot_Execution',
        };

        // what the execution record would look like after receiving start + end logs
        const executionRecordBoth = {
          document: {
            ...executionRecordStart.document,
            ...executionRecordEnd.document,
          },
          collectionName: 'Bot_Execution',
        };

        const executionStartLog = loadFixture([
          'cloud-logs',
          'execution-start.json',
        ]);
        const executionEndLog = loadFixture([
          'cloud-logs',
          'execution-end.json',
        ]);

        describe('when no execution record exists', () => {
          it('creates a new execution record and stores execution start logs', () => {
            return testValidMessage(executionStartLog, [executionRecordStart]);
          }).timeout(5000);

          it('creates a new execution record and stores execution end logs', () => {
            return testValidMessage(executionEndLog, [executionRecordEnd]);
          });
        });

        describe('when a part execution record already exists', () => {
          it('identifies existing record and stores execution start logs', () => {
            mockFirestore.addRecord(executionRecordEnd);
            return testValidMessage(executionStartLog, [executionRecordBoth]);
          });

          it('identifies existing record and stores execution end logs', () => {
            mockFirestore.addRecord(executionRecordStart);
            return testValidMessage(executionEndLog, [executionRecordBoth]);
          });
        });

        describe('when a full execution record already exists', () => {
          beforeEach(() => {
            mockFirestore.addRecord(executionRecordBoth);
          });

          it('identifies existing record and stores execution start logs', () => {
            return testValidMessage(executionStartLog, [executionRecordBoth]);
          });

          it('identifies existing record and stores execution end logs', () => {
            return testValidMessage(executionEndLog, [executionRecordBoth]);
          });
        });
      });

      describe('trigger information logs', () => {
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
              trigger_type: 'GitHub Webhook',
              github_event: '62eb57323fe7436520941da6d02534d2',
            },
          },
          collectionName: 'Trigger',
        };

        const repositoryRecord = {
          document: {
            'java-spanner_googleapis': {
              repo_name: 'java-spanner',
              owner_name: 'googleapis',
            },
          },
          collectionName: 'GitHub_Repository',
        };

        const triggerInfoLog = loadFixture([
          'cloud-logs',
          'trigger-information.json',
        ]);

        describe('when no execution and repository record exists', () => {
          it('creates new execution and repository record and stores trigger information logs', () => {
            return testValidMessage(triggerInfoLog, [
              executionRecord,
              triggerRecord,
              repositoryRecord,
            ]);
          });
        });

        describe('when an execution and repository record already exist', () => {
          beforeEach(() => {
            mockFirestore.addRecord(executionRecord);
            mockFirestore.addRecord(repositoryRecord);
          });

          it('identifies existing record and stores trigger information logs', () => {
            return testValidMessage(triggerInfoLog, [
              executionRecord,
              triggerRecord,
              repositoryRecord,
            ]);
          });
        });
      });

      describe('GitHub action logs', () => {
        const executionRecord = {
          document: {
            g36ouppwsu6z: {
              execution_id: 'g36ouppwsu6z',
            },
          },
          collectionName: 'Bot_Execution',
        };

        const actionRecord = {
          document: {
            g36ouppwsu6z_ISSUE_ADD_LABELS_1596118668017: {
              execution_id: 'g36ouppwsu6z',
              action_type: 'ISSUE_ADD_LABELS',
              timestamp: 1596118668017,
              destination_object: 'ISSUE_python-ndb_googleapis_489',
              destination_repo: 'python-ndb_googleapis',
              value: 'kokoro:run',
            },
          },
          collectionName: 'Action',
        };

        const repositoryRecord = {
          document: {
            'python-ndb_googleapis': {
              repo_name: 'python-ndb',
              owner_name: 'googleapis',
            },
          },
          collectionName: 'GitHub_Repository',
        };

        const objectRecord = {
          document: {
            'ISSUE_python-ndb_googleapis_489': {
              object_type: "ISSUE",
              repository: "python-ndb_googleapis",
              object_id: 489
            },
          },
          collectionName: 'GitHub_Object',
        };

        const gitHubActionLog = loadFixture([
          'cloud-logs',
          'github-action.json',
        ]);

        describe('when no execution/repository/object record exists', () => {
          it('creates a new execution/repository/object record and stores GitHub action logs', () => {
            return testValidMessage(gitHubActionLog, [
              executionRecord,
              actionRecord,
              objectRecord,
              repositoryRecord,
            ]);
          });
        });

        describe('when an execution/repository/object record already exists', () => {
          beforeEach(() => {
            mockFirestore.addRecord(actionRecord);
          });

          it('identifies execution/repository/object record and stores GitHub action logs', () => {
            return testValidMessage(gitHubActionLog, [
              executionRecord,
              objectRecord,
              repositoryRecord,
            ]);
          });
        });
      });

      // describe('error logs', () => {
      //   const executionRecord = {
      //     document: {
      //       pb86861bj247: {
      //         execution_id: 'pb86861bj247',
      //       },
      //     },
      //     collectionName: 'Bot_Execution',
      //   };

      //   const errorRecord = {
      //     document: {
      //       pb86861bj247_1596123567270: {
      //         execution_id: 'pb86861bj247',
      //         timestamp: 1596123567270,
      //         error_msg: "TypeError: Cannot read property 'name' of undefined",
      //       },
      //     },
      //     collectionName: 'Error',
      //   };

      //   const errorLog = loadFixture(['cloud-logs', 'error.json']);

      //   describe('when no execution record exists', () => {
      //     it('creates a new execution record and stores error logs', () => {
      //       return testValidMessage(errorLog, [executionRecord, errorRecord]);
      //     });
      //   });

      //   describe('when an execution record already exists', () => {
      //     beforeEach(() => {
      //       mockFirestore.addRecord(errorRecord);
      //     });

      //     it('identifies existing record and stores error logs', () => {
      //       return testValidMessage(errorLog, [executionRecord]);
      //     });
      //   });
      // });
    });

    // describe('unidentifiable or malformed logs', () => {
    //   /**
    //    * Note: Malformed logs are logs that are similar to
    //    * expected logs but with slight differences. On the
    //    * other hand, unidentifiable logs are logs that differ
    //    * significantly from any recognized format
    //    */

    //   let mockWriteStream: ObjectWritableMock;

    //   beforeEach(() => {
    //     mockWriteStream = new ObjectWritableMock();
    //     processor = new CloudLogsProcessor({
    //       firestore: mockFirestore,
    //       subscription: mockSubscription,
    //       logger: getMockLogger(mockWriteStream),
    //       listenLimit: LISTEN_LIMIT,
    //     });
    //   });

    //   it('logs error for malformed execution start logs', () => {
    //     return testMalformedMessage(
    //       loadFixture(['cloud-logs', 'execution-start-missing-id.json']),
    //       'Detected malformed execution start logs',
    //       mockWriteStream
    //     );
    //   });

    //   it('logs error for malformed execution end logs', () => {
    //     return testMalformedMessage(
    //       loadFixture(['cloud-logs', 'execution-end-missing-timestamp.json']),
    //       'Detected malformed execution end logs',
    //       mockWriteStream
    //     );
    //   });

    //   it('logs error for malformed trigger information logs', () => {
    //     return testMalformedMessage(
    //       loadFixture(['cloud-logs', 'trigger-information-missing-type.json']),
    //       'Detected malformed trigger information logs',
    //       mockWriteStream
    //     );
    //   });

    //   it('logs error for malformed trigger information logs', () => {
    //     return testMalformedMessage(
    //       loadFixture(['cloud-logs', 'trigger-information-missing-repo.json']),
    //       'Detected malformed trigger information logs',
    //       mockWriteStream
    //     );
    //   });

    //   it('logs error for malformed GitHub action logs', () => {
    //     return testMalformedMessage(
    //       loadFixture(['cloud-logs', 'github-action-missing-type.json']),
    //       'Detected malformed GitHub action logs',
    //       mockWriteStream
    //     );
    //   });

    //   it('logs error for malformed execution error logs', () => {
    //     return testMalformedMessage(
    //       loadFixture(['cloud-logs', 'error-missing-id.json']),
    //       'Detected malformed execution error logs',
    //       mockWriteStream
    //     );
    //   });

    //   const triggerRecord = {
    //     document: {
    //       '1lth8bxqr88v': {
    //         execution_id: '1lth8bxqr88v',
    //         trigger_type: 'GitHub Webhook',
    //         github_event: '62eb57323fe7436520941da6d02534d2',
    //       },
    //     },
    //     collectionName: 'Trigger',
    //   };

    //   const executionRecordEnd = {
    //     document: {
    //       '4ww4alqs7ikq': {
    //         execution_id: '4ww4q2vqvkl1',
    //         bot_name: 'auto_label',
    //         end_time: 1595536887000,
    //       },
    //     },
    //     collectionName: 'Bot_Execution',
    //   };

    //   it('processes other valid messages when one message is malformed', () => {
    //     return startAndSendMultipleMessages([
    //       loadFixture(['cloud-logs', 'trigger-information.json']),
    //       loadFixture(['cloud-logs', 'error-missing-id.json']),
    //       loadFixture(['cloud-logs', 'execution-end.json']),
    //     ]).then((messageIds: string[]) => {
    //       messageIds.forEach(id => assert(mockSubscription.wasAcked(id)));
    //       mockFirestore.assertRecord(triggerRecord);
    //       mockFirestore.assertRecord(executionRecordEnd);
    //     });
    //   });

    //   it('ignores log statements with no metrics information', () => {
    //     const copyOfBlankData = JSON.parse(
    //       JSON.stringify(mockFirestore.getMockData())
    //     );
    //     return startAndSendMessage(
    //       loadFixture(['cloud-logs', 'non-metric.json'])
    //     ).then(messageId => {
    //       assert(mockSubscription.wasAcked(messageId));
    //       assert.deepEqual(
    //         mockFirestore.getMockData(),
    //         copyOfBlankData,
    //         'Expected no writes on Firestore'
    //       );
    //     });
    //   });
    // });

    // describe('PubSub error handling', () => {
    //   let mockWriteStream: ObjectWritableMock;

    //   beforeEach(() => {
    //     mockWriteStream = new ObjectWritableMock();
    //     processor = new CloudLogsProcessor({
    //       firestore: mockFirestore,
    //       subscription: mockSubscription,
    //       logger: getMockLogger(mockWriteStream),
    //       listenLimit: LISTEN_LIMIT,
    //     });
    //   });

    //   const executionStartLog = loadFixture([
    //     'cloud-logs',
    //     'execution-start.json',
    //   ]);

    //   it('calls nack() on message if there is an error in processing and logs it', () => {
    //     mockFirestore.throwOnCollection();
    //     return startAndSendMessage(executionStartLog).then(messageId => {
    //       assert(
    //         mockSubscription.wasNacked(messageId),
    //         'Expected processor to nack() message on firestore error'
    //       );
    //       assertErrorLogged('Error while processing message', mockWriteStream);
    //     });
    //   });

    //   it('throws an error when cannot pull messages from PubSub', () => {
    //     mockSubscription.throwErrorOnSetHandler();
    //     let thrown = false;
    //     return startAndSendMessage(executionStartLog)
    //       .catch(() => {
    //         thrown = true;
    //       })
    //       .finally(() =>
    //         assert(thrown, 'Expected error to be thrown for PubSub issues')
    //       );
    //   });

    //   it('throws an error when cannot acknowledge a processed PubSub message', () => {
    //     mockSubscription.throwErrorOnAck();
    //     let thrown = false;
    //     return startAndSendMessage(executionStartLog)
    //       .catch(() => {
    //         thrown = true;
    //       })
    //       .finally(() =>
    //         assert(thrown, 'Expected error to be thrown for PubSub issues')
    //       );
    //   });
    // });
  });
});
