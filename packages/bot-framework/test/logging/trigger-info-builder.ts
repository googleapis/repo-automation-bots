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
import {buildTriggerInfo} from '../../src/logging/trigger-info-builder';
import {TriggerType} from '../../src/bot-request';

describe('buildTriggerInfo', () => {
  const signature = 'fakeSignature';
  const rawBody = Buffer.from('fake-body');
  const payload = {};
  const taskRetryCount = 1;
  it('returns correct pub/sub trigger info', () => {
    const requestBody = {};
    const triggerType = TriggerType.PUBSUB;
    const triggerInfo = buildTriggerInfo(
      {
        eventName: '',
        githubDeliveryId: '',
        triggerType,
        signature,
        taskRetryCount,
        rawBody,
        payload,
      },
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'Pub/Sub',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct scheduler trigger info', () => {
    const requestBody = {};
    const triggerType = TriggerType.SCHEDULER;
    const triggerInfo = buildTriggerInfo(
      {
        eventName: '',
        githubDeliveryId: '',
        triggerType,
        signature,
        taskRetryCount,
        rawBody,
        payload,
      },
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'Cloud Scheduler',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct task trigger info', () => {
    const requestBody = {};
    const triggerType = TriggerType.TASK;
    const triggerInfo = buildTriggerInfo(
      {
        eventName: 'issue',
        githubDeliveryId: '1234',
        triggerType,
        signature,
        taskRetryCount,
        rawBody,
        payload,
      },
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'Cloud Task',
        trigger_sender: 'UNKNOWN',
        github_delivery_guid: '1234',
        github_event_type: 'issue',
        trigger_source_repo: {
          owner: 'UNKNOWN',
          owner_type: 'UNKNOWN',
          repo_name: 'UNKNOWN',
          url: 'UNKNOWN',
        },
        payload_hash: '99914b932bd37a50b983c5e7c90ae93b',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct task trigger info with trigger source', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/issue-opened.json');
    const triggerType = TriggerType.TASK;
    const triggerInfo = buildTriggerInfo(
      {
        eventName: 'issue',
        githubDeliveryId: '1234',
        triggerType,
        signature,
        taskRetryCount,
        rawBody,
        payload,
      },
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'Cloud Task',
        trigger_sender: 'testUser',
        github_delivery_guid: '1234',
        github_event_type: 'issue.opened',
        trigger_source_repo: {
          owner: 'testOwner',
          owner_type: 'User',
          repo_name: 'testRepo',
          url: 'https://github.com/testOwner/testRepo',
        },
        payload_hash: '669f4417a11633569ed8b28ad41547fc',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct Github trigger info for issue opened event', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/issue-opened.json');
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      {
        eventName: 'issue',
        githubDeliveryId: '1234',
        triggerType,
        signature,
        taskRetryCount,
        rawBody,
        payload,
      },
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'testUser',
        github_delivery_guid: '1234',
        github_event_type: 'issue.opened',
        trigger_source_repo: {
          owner: 'testOwner',
          owner_type: 'User',
          repo_name: 'testRepo',
          url: 'https://github.com/testOwner/testRepo',
        },
        payload_hash: '669f4417a11633569ed8b28ad41547fc',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct Github trigger info for issue labeled event', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/issue-labeled.json');
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      {
        eventName: 'issue',
        githubDeliveryId: '1234',
        triggerType,
        signature,
        taskRetryCount,
        rawBody,
        payload,
      },
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'testUser',
        github_delivery_guid: '1234',
        github_event_type: 'issue.labeled',
        trigger_source_repo: {
          owner: 'testOwner',
          owner_type: 'User',
          repo_name: 'testRepo',
          url: 'https://github.com/testOwner/testRepo',
        },
        payload_hash: 'd13a3476a348ae024584736dac212964',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct Github trigger info for label deleted event', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/label-deleted.json');
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      {
        eventName: 'label',
        githubDeliveryId: '1234',
        triggerType,
        signature,
        taskRetryCount,
        rawBody,
        payload,
      },
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'testUser',
        github_delivery_guid: '1234',
        github_event_type: 'label.deleted',
        trigger_source_repo: {
          owner: 'testOwner',
          owner_type: 'User',
          repo_name: 'testRepo',
          url: 'https://github.com/testOwner/testRepo',
        },
        payload_hash: 'd6922fd3ae605b5268c3a2e4e8a78e60',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct Github trigger info for pull request labeled event', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/pull-request-labeled.json');
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      {
        eventName: 'pull_request',
        githubDeliveryId: '1234',
        triggerType,
        signature,
        taskRetryCount,
        rawBody,
        payload,
      },
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'testUser',
        github_delivery_guid: '1234',
        github_event_type: 'pull_request.labeled',
        trigger_source_repo: {
          owner: 'testOwner',
          owner_type: 'User',
          repo_name: 'testRepo',
          url: 'https://github.com/testOwner/testRepo',
        },
        payload_hash: '49c69366711b5d3d4aad7a9d9afef6fb',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct Github trigger info for pull request opened event', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/pull-request-opened.json');
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      {
        eventName: 'pull_request',
        githubDeliveryId: '1234',
        triggerType,
        signature,
        taskRetryCount,
        rawBody,
        payload,
      },
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'testUser',
        github_delivery_guid: '1234',
        github_event_type: 'pull_request.opened',
        trigger_source_repo: {
          owner: 'testOwner',
          owner_type: 'User',
          repo_name: 'testRepo',
          url: 'https://github.com/testOwner/testRepo',
        },
        payload_hash: 'fb5cc31a1e4e1d6f871ec8f8173c77ab',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct Github trigger info for pull request sync event', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/pull-request-sync.json');
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      {
        eventName: 'pull_request',
        githubDeliveryId: '1234',
        triggerType,
        signature,
        taskRetryCount,
        rawBody,
        payload,
      },
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'testUser',
        github_delivery_guid: '1234',
        github_event_type: 'pull_request.synchronize',
        trigger_source_repo: {
          owner: 'testOwner',
          owner_type: 'User',
          repo_name: 'testRepo',
          url: 'https://github.com/testOwner/testRepo',
        },
        payload_hash: '50faed8c2b56bd41629e9bc2216f9551',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct Github trigger info for release released event', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/release-released.json');
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      {
        eventName: 'release',
        githubDeliveryId: '1234',
        triggerType,
        signature,
        taskRetryCount,
        rawBody,
        payload,
      },
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'testUser',
        github_delivery_guid: '1234',
        github_event_type: 'release.released',
        trigger_source_repo: {
          owner: 'testOwner',
          owner_type: 'User',
          repo_name: 'testRepo',
          url: 'https://github.com/testOwner/testRepo',
        },
        payload_hash: '736cf0da3841d4a2e4c0a86f0431c436',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns UNKNOWN for Github trigger info when information is unavailable', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/issue-opened-missing-info.json');
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      {
        eventName: 'issues',
        githubDeliveryId: '',
        triggerType,
        signature,
        taskRetryCount,
        rawBody,
        payload,
      },
      requestBody
    );
    const expectedInfo = {
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'UNKNOWN',
        github_delivery_guid: '',
        github_event_type: 'issues.opened',
        trigger_source_repo: {
          owner: 'UNKNOWN',
          owner_type: 'UNKNOWN',
          repo_name: 'UNKNOWN',
          url: 'UNKNOWN',
        },
        payload_hash: '2dfaf99ccabc68e6138c86ea543a21ea',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });
});
