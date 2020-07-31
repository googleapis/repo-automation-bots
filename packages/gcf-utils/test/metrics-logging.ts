// Copyright 2019 Google LLC
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

import {TriggerType} from '../src/gcf-utils';
import {describe, it} from 'mocha';
import assert from 'assert';
import {buildTriggerInfo} from '../src/logging/metrics-logging';

describe('buildTriggerInfo', () => {
  it('returns correct pub/sub trigger info', () => {
    const requestBody = {};
    const github_delivery_guid = '';
    const triggerType = TriggerType.PUBSUB;
    const triggerInfo = buildTriggerInfo(
      triggerType,
      github_delivery_guid,
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'Pub/Sub',
        message: 'Execution started by Pub/Sub',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct scheduler trigger info', () => {
    const requestBody = {};
    const github_delivery_guid = '';
    const triggerType = TriggerType.SCHEDULER;
    const triggerInfo = buildTriggerInfo(
      triggerType,
      github_delivery_guid,
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'Cloud Scheduler',
        message: 'Execution started by Cloud Scheduler',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct task trigger info', () => {
    const requestBody = {};
    const github_delivery_guid = '1234';
    const triggerType = TriggerType.TASK;
    const triggerInfo = buildTriggerInfo(
      triggerType,
      github_delivery_guid,
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'Cloud Task',
        github_delivery_guid: '1234',
        message: 'Execution started by Cloud Task',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct Github trigger info', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payload-all-info.json');
    const github_delivery_guid = '1234';
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      triggerType,
      github_delivery_guid,
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'testUser2',
        github_delivery_guid: '1234',
        message: 'Execution started by GitHub Webhook',
        trigger_source_repo: {
          owner: 'testOwner',
          owner_type: 'User',
          repo_name: 'testRepo',
          url: 'https://github.com/testOwner/testRepo',
        },
        payload_hash: '8f834d7b7a6dfc9a054c78c77a2a4c90',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns UNKNOWN for Github trigger info when information is unavailable', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payload-missing-info.json');
    const github_delivery_guid = '';
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      triggerType,
      github_delivery_guid,
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'GitHub Webhook',
        message: 'Execution started by GitHub Webhook',
        trigger_sender: 'UNKNOWN',
        github_delivery_guid: '',
        trigger_source_repo: {
          owner: 'UNKNOWN',
          owner_type: 'UNKNOWN',
          repo_name: 'UNKNOWN',
          url: 'UNKNOWN',
        },
        payload_hash: '6ceaa9d7875be85cc0796caf4e8da857',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });
});
