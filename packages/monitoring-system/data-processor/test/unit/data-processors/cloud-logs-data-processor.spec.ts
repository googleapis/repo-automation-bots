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
import {MockFirestore, FirestoreData} from './mock-firestore';
import {CloudLogsProcessor} from '../../../src/data-processors/cloud-logs-data-processor';
import { loadFixture } from './util/test-util';

interface BotExecution {
  [key: string]: string | number | undefined;
  execution_id: string;
  bot_id?: string;
  trigger_id?: string;
  start_time?: number;
  end_time?: number;
  logs_url?: string;
}

let firestoreData: FirestoreData;
function resetFirestoreData() {
  firestoreData = {
    Bot_Execution: {},
    Error: {},
    Trigger: {},
    Action: {},
    Action_Type: {},
    GitHub_Object: {},
  };
}

/**
 * Adds the following execution record to mock firestore
 * @param record record to add
 */
function addExecutionRecord(record: BotExecution) {
  firestoreData.Bot_Execution[record.execution_id] = record;
}

/**
 * Asserts there exists an execution record in mock firestore
 * that has all the properties/values as the expected record.
 * The mock record will be allowed to have more properties
 * than the expected record.
 * @param expected expected execution record
 */
function assertExecutionRecord(expected: BotExecution) {
  const mockRecord = firestoreData.Bot_Execution[expected.execution_id];
  assert(mockRecord, `Id ${expected.execution_id} not found in mock firestore`);

  for (const prop of Object.keys(expected)) {
    if (expected[prop]) {
      assert.equal(
        mockRecord[prop],
        expected[prop],
        `Expected mock execution record '${expected.execution_id}' ` +
        `to have property '${prop}' with value '${expected[prop]}'. ` +
        `Mock execution record: ${JSON.stringify(mockRecord)}`
      );
    }
  }
}

const MOCK_MESSAGES: any = loadFixture('mock-pubsub-log-messages.json', false);

describe('Cloud Logs Processor', () => {
  describe('collectAndProcess()', () => {
    let mockSubscription: MockSubscription;
    let mockFirestore: MockFirestore;
    let processor: CloudLogsProcessor;

    beforeEach(() => {
      resetFirestoreData();
      mockFirestore = new MockFirestore(firestoreData);
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
          const processingTask = processor.collectAndProcess();
          const message = Buffer.from(MOCK_MESSAGES.execution_start);
          const messageId = mockSubscription.sendMockMessage(message);
          return processingTask.then(() => {
            assertExecutionRecord({
              execution_id: "4ww4alqs7ikq",
              bot_id: "merge_on_green",
              start_time: 1595536893000,
              logs_url: "https://pantheon.corp.google.com/logs/query;query=resource.type%3D%22cloud_function%22%0Alabels.%22execution_id%22%3D%224ww4alqs7ikq%22;timeRange=2020-07-23T20:41:33.701320846Z%2F22020-07-23T20:41:33.701320846Z;summaryFields=:true:32:beginning?project=repo-automation-bots"
            })
          })
        });

        it('creates a new execution record and stores execution end logs');
      });

      describe('when an execution record already exists', () => {
        it('identifies existing record and stores execution start logs');

        it('identifies existing record and stores execution end logs');
      });
    });

    describe('correctly formed trigger information logs', () => {
      describe('when no execution record exists', () => {
        it('creates new execution record and stores trigger information logs');
      });

      describe('when an execution record already exists', () => {
        it('identifies existing record and stores trigger information logs');
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
