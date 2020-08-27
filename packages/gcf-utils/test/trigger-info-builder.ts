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

import {TriggerType} from '../src/gcf-utils';
import {describe, it} from 'mocha';
import assert from 'assert';
import {buildTriggerInfo} from '../src/logging/trigger-info-builder';

describe('buildTriggerInfo', () => {
  it('returns correct pub/sub trigger info', () => {
    const requestBody = {};
    const triggerType = TriggerType.PUBSUB;
    const triggerInfo = buildTriggerInfo(
      triggerType,
      '',
      '',
      requestBody
    );
    const expectedInfo = {
      message: 'Execution started by Pub/Sub',
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
      triggerType,
      '',
      '',
      requestBody
    );
    const expectedInfo = {
      message: 'Execution started by Cloud Scheduler',
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
      triggerType,
      '1234',
      '',
      requestBody
    );
    const expectedInfo = {
      message: 'Execution started by Cloud Task',
      trigger: {
        trigger_type: 'Cloud Task',
        github_delivery_guid: '1234',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct Github trigger info for issue opened event', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/issue-opened.json');
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      triggerType,
      '1234',
      'issue',
      requestBody
    );
    const expectedInfo = {
      message: 'Execution started by GitHub Webhook',
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'testUser',
        github_delivery_guid: '1234',
        github_event_type: "issue: opened",
        trigger_source_repo: {
          owner: 'testOwner',
          owner_type: 'User',
          repo_name: 'testRepo',
          url: 'https://github.com/testOwner/testRepo',
        },
        payload_hash: '7a142ffd5cbfe793332b45ed2cd22e5a',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct Github trigger info for issue labeled event', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/issue-labeled.json');
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      triggerType,
      '1234',
      'issue',
      requestBody
    );
    const expectedInfo = {
      message: 'Execution started by GitHub Webhook',
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'testUser',
        github_delivery_guid: '1234',
        github_event_type: "issue: labeled",
        trigger_source_repo: {
          owner: 'testOwner',
          owner_type: 'User',
          repo_name: 'testRepo',
          url: 'https://github.com/testOwner/testRepo',
        },
        payload_hash: '869a213d4bf2660eff1659b36554cacc',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct Github trigger info for label deleted event', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/label-deleted.json');
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      triggerType,
      '1234',
      'label',
      requestBody
    );
    const expectedInfo = {
      message: 'Execution started by GitHub Webhook',
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'testUser',
        github_delivery_guid: '1234',
        github_event_type: "label: deleted",
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
      triggerType,
      '1234',
      'pull_request',
      requestBody
    );
    const expectedInfo = {
      message: 'Execution started by GitHub Webhook',
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'testUser',
        github_delivery_guid: '1234',
        github_event_type: "pull_request: labeled",
        trigger_source_repo: {
          owner: 'testOwner',
          owner_type: 'User',
          repo_name: 'testRepo',
          url: 'https://github.com/testOwner/testRepo',
        },
        payload_hash: 'f082fc594443d59f56c096d2380082b1',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct Github trigger info for pull request opened event', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/pull-request-opened.json');
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      triggerType,
      '1234',
      'pull_request',
      requestBody
    );
    const expectedInfo = {
      message: 'Execution started by GitHub Webhook',
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'testUser',
        github_delivery_guid: '1234',
        github_event_type: "pull_request: opened",
        trigger_source_repo: {
          owner: 'testOwner',
          owner_type: 'User',
          repo_name: 'testRepo',
          url: 'https://github.com/testOwner/testRepo',
        },
        payload_hash: '0fa7bf09fe3dc4d3d5e3cb784b5a5a89',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct Github trigger info for pull request sync event', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/pull-request-sync.json');
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      triggerType,
      '1234',
      'pull_request',
      requestBody
    );
    const expectedInfo = {
      message: 'Execution started by GitHub Webhook',
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'testUser',
        github_delivery_guid: '1234',
        github_event_type: "pull_request: synchronize",
        trigger_source_repo: {
          owner: 'testOwner',
          owner_type: 'User',
          repo_name: 'testRepo',
          url: 'https://github.com/testOwner/testRepo',
        },
        payload_hash: 'cbb27d7db59ca4d6cdd6116771fd5969',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns correct Github trigger info for release released event', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/release-released.json');
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      triggerType,
      '1234',
      'release',
      requestBody
    );
    const expectedInfo = {
      message: 'Execution started by GitHub Webhook',
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'testUser',
        github_delivery_guid: '1234',
        github_event_type: "release: released",
        trigger_source_repo: {
          owner: 'testOwner',
          owner_type: 'User',
          repo_name: 'testRepo',
          url: 'https://github.com/testOwner/testRepo',
        },
        payload_hash: '9ab5878f727ed29fda2999b240f879c4',
      },
    };
    assert.deepEqual(triggerInfo, expectedInfo);
  });

  it('returns UNKNOWN for Github trigger info when information is unavailable', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requestBody = require('../../test/fixtures/github-webhook-payloads/issue-opened-missing-info.json');
    const triggerType = TriggerType.GITHUB;
    const triggerInfo = buildTriggerInfo(
      triggerType,
      '',
      'issues',
      requestBody
    );
    const expectedInfo = {
      message: 'Execution started by GitHub Webhook',
      trigger: {
        trigger_type: 'GitHub Webhook',
        trigger_sender: 'UNKNOWN',
        github_delivery_guid: '',
        github_event_type: "issues: opened",
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
