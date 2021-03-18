// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* eslint-disable node/no-extraneous-import */

import {Probot, createProbot, ProbotOctokit} from 'probot';
import {Octokit} from '@octokit/rest';
import nock from 'nock';
import sinon from 'sinon';
import {describe, it, afterEach, beforeEach} from 'mocha';
import * as assert from 'assert';
import * as policy from '../src/policy';
import * as bq from '../src/export';
import {policyBot} from '../src/bot';

nock.disableNetConnect();

describe('bot', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = createProbot({
      defaults: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
      },
    });
    probot.load(policyBot);
  });

  afterEach(() => {
    nock.cleanAll();
    sinon.restore();
  });

  it('should skip runs on non-approved orgs', async () => {
    const repo = 'nodejs-storage';
    const org = 'not-an-approved-org';
    await probot.receive({
      name: 'schedule.repository' as '*',
      payload: {
        repository: {
          name: repo,
          owner: {
            login: org,
          },
        },
        organization: {
          login: org,
        },
        cron_org: org,
      },
      id: 'abc123',
    });
    // we are relying on the lack of nocks or stubs to signal that this exited
    // successfully, skipping all of the interesting stuff.
  });

  it('runs the check and saves the result', async () => {
    const repo = 'nodejs-storage';
    const org = 'googleapis';
    const fakeRepo = {} as policy.GitHubRepo;
    const fakeResult = {} as policy.PolicyResult;
    const p = new policy.Policy(new Octokit(), console);
    const getPolicyStub = sinon.stub(policy, 'getPolicy').returns(p);
    const getRepoStub = sinon.stub(p, 'getRepo').resolves(fakeRepo);
    const checkPolicyStub = sinon
      .stub(p, 'checkRepoPolicy')
      .resolves(fakeResult);
    const exportStub = sinon.stub(bq, 'exportToBigQuery').resolves();

    await probot.receive({
      name: 'schedule.repository' as '*',
      payload: {
        repository: {
          name: repo,
          owner: {
            login: org,
          },
        },
        organization: {
          login: org,
        },
        cron_org: org,
      },
      id: 'abc123',
    });
    assert.ok(getPolicyStub.calledOnce);
    assert.ok(getRepoStub.calledOnce);
    assert.ok(checkPolicyStub.calledOnce);
    assert.ok(exportStub.calledOnce);
  });
});
