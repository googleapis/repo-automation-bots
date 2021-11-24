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

// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import nock from 'nock';
import sinon from 'sinon';
import {describe, it, afterEach, beforeEach} from 'mocha';
import * as assert from 'assert';
import {logger} from 'gcf-utils';
import * as policy from '../src/policy';
import * as bq from '../src/export';
import * as changer from '../src/changer';
import {policyBot} from '../src/bot';
import * as gh from '../src/issue';

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    // we are relying on the lack of nocks or stubs to signal that this exited
    // successfully, skipping all of the interesting stuff.
  });

  it('should run the check and saves the result', async () => {
    const repo = 'nodejs-storage';
    const org = 'googleapis';
    const fakeRepo = {
      full_name: 'googleapis/nodejs-storage',
    } as policy.GitHubRepo;
    const fakeResult = {} as policy.PolicyResult;
    const p = new policy.Policy(new Octokit(), console);
    const c = new changer.Changer(new Octokit(), fakeRepo);
    const getPolicyStub = sinon.stub(policy, 'getPolicy').returns(p);
    const getChangerStub = sinon.stub(changer, 'getChanger').returns(c);
    const getRepoStub = sinon.stub(p, 'getRepo').resolves(fakeRepo);
    const checkPolicyStub = sinon
      .stub(p, 'checkRepoPolicy')
      .resolves(fakeResult);
    const exportStub = sinon.stub(bq, 'exportToBigQuery').resolves();
    const submitFixesStub = sinon.stub(c, 'submitFixes').resolves();

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    assert.ok(getPolicyStub.calledOnce);
    assert.ok(getChangerStub.calledOnce);
    assert.ok(getRepoStub.calledOnce);
    assert.ok(checkPolicyStub.calledOnce);
    assert.ok(exportStub.calledOnce);
    assert.ok(submitFixesStub.calledOnce);
  });

  it('should run checks for sample repos in GoogleCloudPlatform', async () => {
    const repo = 'nodejs-docs-samples';
    const org = 'GoogleCloudPlatform';
    const fakeRepo = {
      topics: ['samples'],
      full_name: 'googleapis/nodejs-storage',
    } as policy.GitHubRepo;
    const fakeResult = {} as policy.PolicyResult;
    const p = new policy.Policy(new Octokit(), console);
    const c = new changer.Changer(new Octokit(), fakeRepo);
    const getPolicyStub = sinon.stub(policy, 'getPolicy').returns(p);
    const getChangerStub = sinon.stub(changer, 'getChanger').returns(c);
    const getRepoStub = sinon.stub(p, 'getRepo').resolves(fakeRepo);
    const checkPolicyStub = sinon
      .stub(p, 'checkRepoPolicy')
      .resolves(fakeResult);
    const exportStub = sinon.stub(bq, 'exportToBigQuery').resolves();
    const submitFixesStub = sinon.stub(c, 'submitFixes').resolves();

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    assert.ok(getChangerStub.calledOnce);
    assert.ok(getPolicyStub.calledOnce);
    assert.ok(getRepoStub.calledOnce);
    assert.ok(checkPolicyStub.calledOnce);
    assert.ok(exportStub.calledOnce);
    assert.ok(submitFixesStub.calledOnce);
  });

  it('should raise error if checkRepoPolicy throws', async () => {
    const repo = 'nodejs-docs-samples';
    const org = 'GoogleCloudPlatform';
    const fakeRepo = {
      topics: ['samples'],
      full_name: 'googleapis/nodejs-storage',
    } as policy.GitHubRepo;
    const p = new policy.Policy(new Octokit(), console);
    const getPolicyStub = sinon.stub(policy, 'getPolicy').returns(p);
    const getRepoStub = sinon.stub(p, 'getRepo').resolves(fakeRepo);
    const checkPolicyStub = sinon
      .stub(p, 'checkRepoPolicy')
      .throws(Error('reading file failed'));
    await assert.rejects(
      probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      }),
      /reading file failed/
    );
    assert.ok(getPolicyStub.calledOnce);
    assert.ok(getRepoStub.calledOnce);
    assert.ok(checkPolicyStub.calledOnce);
  });

  it('should skip archived repos', async () => {
    const repo = 'nodejs-storage';
    const org = 'googleapis';
    const fakeRepo = {archived: true} as policy.GitHubRepo;
    const p = new policy.Policy(new Octokit(), console);
    const getPolicyStub = sinon.stub(policy, 'getPolicy').returns(p);
    const getRepoStub = sinon.stub(p, 'getRepo').resolves(fakeRepo);
    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    assert.ok(getRepoStub.calledOnce);
    assert.ok(getPolicyStub.calledOnce);
  });

  it('should skip private repos', async () => {
    const repo = 'nodejs-storage';
    const org = 'googleapis';
    const fakeRepo = {private: true} as policy.GitHubRepo;
    const p = new policy.Policy(new Octokit(), console);
    const getPolicyStub = sinon.stub(policy, 'getPolicy').returns(p);
    const getRepoStub = sinon.stub(p, 'getRepo').resolves(fakeRepo);
    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    assert.ok(getRepoStub.calledOnce);
    assert.ok(getPolicyStub.calledOnce);
  });

  it('should skip GoogleCloudPlatform repos without magic repo topics', async () => {
    const repo = 'nodejs-storage';
    const org = 'GoogleCloudPlatform';
    const fakeRepo = {} as policy.GitHubRepo;
    const p = new policy.Policy(new Octokit(), console);
    const getPolicyStub = sinon.stub(policy, 'getPolicy').returns(p);
    const getRepoStub = sinon.stub(p, 'getRepo').resolves(fakeRepo);
    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    assert.ok(getRepoStub.calledOnce);
    assert.ok(getPolicyStub.calledOnce);
  });

  it('should still succeed if submitFixes fails, and log a result', async () => {
    const repo = 'nodejs-storage';
    const org = 'googleapis';
    const fakeRepo = {
      full_name: 'googleapis/nodejs-storage',
    } as policy.GitHubRepo;
    const fakeResult = {} as policy.PolicyResult;
    const p = new policy.Policy(new Octokit(), console);
    const c = new changer.Changer(new Octokit(), fakeRepo);
    const getPolicyStub = sinon.stub(policy, 'getPolicy').returns(p);
    const getChangerStub = sinon.stub(changer, 'getChanger').returns(c);
    const getRepoStub = sinon.stub(p, 'getRepo').resolves(fakeRepo);
    const checkPolicyStub = sinon
      .stub(p, 'checkRepoPolicy')
      .resolves(fakeResult);
    const exportStub = sinon.stub(bq, 'exportToBigQuery').resolves();
    const submitFixesStub = sinon.stub(c, 'submitFixes').throws();
    const openIssueStub = sinon.stub(gh, 'openIssue').resolves();
    const errStub = sinon.stub(logger, 'error');

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    assert.ok(getChangerStub.calledOnce);
    assert.ok(getPolicyStub.calledOnce);
    assert.ok(getRepoStub.calledOnce);
    assert.ok(checkPolicyStub.calledOnce);
    assert.ok(exportStub.calledOnce);
    assert.ok(submitFixesStub.calledOnce);
    assert.ok(errStub.calledOnce);
    assert.ok(openIssueStub.calledOnce);
  });
});
