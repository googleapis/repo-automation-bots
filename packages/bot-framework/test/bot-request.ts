// Copyright 2023 Google LLC
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

import {describe, it} from 'mocha';
import assert from 'assert';
import {parseBotRequest, TriggerType} from '../src/bot-request';
import {mockRequest} from './helpers';

describe('parseBotRequest', () => {
  describe('with all headers', () => {
    const headers = {
      'x-github-event': 'issues',
      'x-github-delivery': '123',
      'x-cloudtasks-taskname': 'some-task',
      'x-cloudtasks-taskretrycount': '3',
      'x-hub-signature': 'some-signature',
      'x-cloud-trace-context': 'abc123/def234;o=1',
    };
    const body = {
      installation: {id: 1},
    };
    const request = mockRequest(body, headers);
    const botRequest = parseBotRequest(request);

    it('should parse the event name', () => {
      assert.strictEqual(botRequest.eventName, 'issues');
    });
    it('should parse the github delivery id', () => {
      assert.strictEqual(botRequest.githubDeliveryId, '123');
    });
    it('should parse the signature', () => {
      assert.strictEqual(botRequest.signature, 'some-signature');
    });
    it('should parse the task name', () => {
      assert.strictEqual(botRequest.taskName, 'some-task');
    });
    it('should parse the task retry count', () => {
      assert.strictEqual(botRequest.taskRetryCount, 3);
    });
    it('should parse the trace id', () => {
      assert.strictEqual(botRequest.traceId, 'abc123');
    });
    it('should parse trigger type', () => {
      assert.strictEqual(botRequest.triggerType, TriggerType.TASK);
    });
  });
  describe('without headers', () => {
    const headers = {};
    const body = {
      installation: {id: 1},
    };
    const request = mockRequest(body, headers);
    const botRequest = parseBotRequest(request);

    it('should parse the event name', () => {
      assert.strictEqual(botRequest.eventName, '');
    });
    it('should parse the github delivery id', () => {
      assert.strictEqual(botRequest.githubDeliveryId, '');
    });
    it('should parse the signature', () => {
      assert.strictEqual(botRequest.signature, 'unset');
    });
    it('should parse the task name', () => {
      assert.strictEqual(botRequest.taskName, undefined);
    });
    it('should parse the task retry count', () => {
      assert.strictEqual(botRequest.taskRetryCount, 0);
    });
    it('should parse the trace id', () => {
      assert.strictEqual(botRequest.traceId, undefined);
    });
    it('should parse trigger type', () => {
      assert.strictEqual(botRequest.triggerType, TriggerType.UNKNOWN);
    });
  });
  describe('trigger types', () => {
    for (const scheduledTaskType of [
      'schedule.global',
      'schedule.installation',
      'schedule.repository',
    ]) {
      it(`should parse a scheduled task for ${scheduledTaskType}`, () => {
        const headers = {
          'x-github-event': scheduledTaskType,
        };
        const body = {
          installation: {id: 1},
        };
        const request = mockRequest(body, headers);
        const botRequest = parseBotRequest(request);
        assert.strictEqual(botRequest.triggerType, TriggerType.SCHEDULER);
      });
    }
    it('should parse a pubsub event', () => {
      const headers = {
        'x-github-event': 'pubsub.message',
      };
      const body = {
        installation: {id: 1},
      };
      const request = mockRequest(body, headers);
      const botRequest = parseBotRequest(request);
      assert.strictEqual(botRequest.triggerType, TriggerType.PUBSUB);
    });
    it('should parse a GitHub webhook', () => {
      const headers = {
        'x-github-event': 'issues.message',
      };
      const body = {
        installation: {id: 1},
      };
      const request = mockRequest(body, headers);
      const botRequest = parseBotRequest(request);
      assert.strictEqual(botRequest.triggerType, TriggerType.GITHUB);
    });
    it('should parse a backend task', () => {
      const headers = {
        'x-github-event': 'issues.message',
        'x-cloudtasks-taskname': 'some-task',
      };
      const body = {
        installation: {id: 1},
      };
      const request = mockRequest(body, headers);
      const botRequest = parseBotRequest(request);
      assert.strictEqual(botRequest.triggerType, TriggerType.TASK);
    });
  });
});
