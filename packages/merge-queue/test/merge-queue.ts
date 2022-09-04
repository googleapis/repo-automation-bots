// Copyright 2022 Google LLC
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

import {GCFBootstrapper, GCFLogger} from 'gcf-utils';

import {Probot, createProbot, ProbotOctokit} from 'probot';
import {Octokit} from '@octokit/rest';
import {PullRequestLabeledEvent} from '@octokit/webhooks-types';
import nock from 'nock';
import sinon from 'sinon';
import {describe, it, beforeEach, after} from 'mocha';

import {Datastore} from '@google-cloud/datastore';
import * as gcfUtils from 'gcf-utils';
import * as labelUtils from '@google-automations/label-utils';

import * as utils from '../src/utils';

import {ADD_LABEL, ADDED_LABEL, MERGE_QUEUE_LABELS} from '../src/labels';
import {createAppFn} from '../src/merge-queue';

nock.disableNetConnect();

describe('merge-queue bot', () => {
  const env = Object.assign({}, process.env);
  let probot: Probot;
  process.env.PROJECT_ID = 'test-project-id';
  process.env.GCF_SHORT_FUNCTION_NAME = 'test_merge_queue';
  process.env.GCF_LOCATION = 'us-central1';
  const bootstrap = new GCFBootstrapper({
    taskTargetEnvironment: 'run',
  });
  const sandbox = sinon.createSandbox();
  let syncLabelsStub: sinon.SinonStub;
  let getAuthenticatedOctokitStub: sinon.SinonStub;
  let addPRToQueueStub: sinon.SinonStub;
  let changeLabelStub: sinon.SinonStub;
  let enqueueTaskStub: sinon.SinonStub;
  let getQueueStub: sinon.SinonStub;
  let addOrUpdateIssueCommentStub: sinon.SinonStub;
  let removePRFromQueueStub: sinon.SinonStub;
  let updatePRForRemovalStub: sinon.SinonStub;

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
    probot.load(createAppFn(bootstrap));
    syncLabelsStub = sandbox.stub(labelUtils, 'syncLabels');
    getAuthenticatedOctokitStub = sandbox.stub(
      gcfUtils,
      'getAuthenticatedOctokit'
    );
    getAuthenticatedOctokitStub.resolves(new Octokit());
    addPRToQueueStub = sandbox.stub(utils, 'addPRToQueue');
    changeLabelStub = sandbox.stub(utils, 'changeLabel');
    enqueueTaskStub = sandbox.stub(utils, 'enqueueTask');
    getQueueStub = sandbox.stub(utils, 'getQueue');
    removePRFromQueueStub = sandbox.stub(utils, 'removePRFromQueue');
    addOrUpdateIssueCommentStub = sandbox.stub(
      gcfUtils,
      'addOrUpdateIssueComment'
    );
    updatePRForRemovalStub = sandbox.stub(utils, 'updatePRForRemoval');
  });
  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });
  after(() => {
    process.env = env;
  });

  describe('pull_request.labeled', () => {
    it('ignores unrelated labels', async () => {
      const repoFullName = 'googleapis/test-repo';
      const prNumber = 123;
      await probot.receive({
        name: 'pull_request',
        payload: {
          action: 'labeled',
          repository: {
            name: 'test-repo',
            full_name: repoFullName,
            owner: {
              login: 'googleapis',
            },
          },
          organization: {
            login: 'googleapis',
          },
          installation: {id: 1234},
          pull_request: {
            number: prNumber,
            labels: [{name: 'automerge'}],
          },
        } as unknown as PullRequestLabeledEvent,
        id: 'abc123',
      });
      sinon.assert.notCalled(addPRToQueueStub);
      sinon.assert.notCalled(changeLabelStub);
      sinon.assert.notCalled(enqueueTaskStub);
    });
    it('handles merge-queue:add label', async () => {
      const owner = 'googleapis';
      const repo = 'test-repo';
      const repoFullName = `${owner}/${repo}`;
      const prNumber = 123;
      const installationId = 1234;
      await probot.receive({
        name: 'pull_request',
        payload: {
          action: 'labeled',
          repository: {
            name: repo,
            full_name: repoFullName,
            owner: {
              login: owner,
            },
          },
          organization: {
            login: owner,
          },
          installation: {id: installationId},
          pull_request: {
            number: prNumber,
            labels: [{name: ADD_LABEL}],
          },
        } as unknown as PullRequestLabeledEvent,
        id: 'abc123',
      });
      sinon.assert.calledOnceWithExactly(
        addPRToQueueStub,
        sinon.match.instanceOf(Datastore),
        repoFullName,
        prNumber,
        sinon.match.instanceOf(GCFLogger)
      );
      sinon.assert.calledOnceWithExactly(
        changeLabelStub,
        sinon.match.instanceOf(Octokit),
        owner,
        repo,
        prNumber,
        ADD_LABEL,
        ADDED_LABEL
      );
      sinon.assert.calledOnceWithExactly(
        enqueueTaskStub,
        sinon.match.instanceOf(GCFBootstrapper),
        repoFullName,
        installationId,
        prNumber,
        sinon.match.instanceOf(GCFLogger)
      );
    });
  });
  describe('scheduler job', () => {
    it('handles callback from self', async () => {
      const repoFullName = 'googleapis/test-repo';
      getQueueStub.resolves({
        repoFullName: repoFullName,
        pullRequests: [],
      });
      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          repository: {
            name: 'test-repo',
            full_name: repoFullName,
            owner: {
              login: 'googleapis',
            },
          },
          organization: {
            login: 'googleapis',
          },
          installation: {id: 1234},
          task_type: utils.MERGE_QUEUE_CALLBACK,
          pr_number: 123,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      sinon.assert.calledOnceWithExactly(
        getQueueStub,
        sinon.match.instanceOf(Datastore),
        repoFullName
      );
    });
    it('notifies the current position to a PR', async () => {
      const repoFullName = 'googleapis/test-repo';
      const owner = 'googleapis';
      const repo = 'test-repo';
      const prNumber = 123;
      const installationId = 1234;
      getQueueStub.resolves({
        repoFullName: repoFullName,
        pullRequests: [111, 222, prNumber],
      });
      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          repository: {
            name: repo,
            full_name: repoFullName,
            owner: {
              login: owner,
            },
          },
          organization: {
            login: owner,
          },
          installation: {id: installationId},
          task_type: utils.MERGE_QUEUE_CALLBACK,
          pr_number: prNumber,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      sinon.assert.calledOnceWithExactly(
        getQueueStub,
        sinon.match.instanceOf(Datastore),
        repoFullName
      );
      sinon.assert.calledOnceWithExactly(
        addOrUpdateIssueCommentStub,
        sinon.match.instanceOf(Octokit),
        owner,
        repo,
        prNumber,
        installationId,
        'This pr is at 3 / 3 in the queue.'
      );
      sinon.assert.calledOnceWithExactly(
        enqueueTaskStub,
        sinon.match.instanceOf(GCFBootstrapper),
        repoFullName,
        installationId,
        prNumber,
        sinon.match.instanceOf(GCFLogger)
      );
    });
    it('removes a merged PR from the queue', async () => {
      const repoFullName = 'googleapis/test-repo';
      const owner = 'googleapis';
      const repo = 'test-repo';
      const prNumber = 123;
      const installationId = 1234;
      getQueueStub.resolves({
        repoFullName: repoFullName,
        pullRequests: [prNumber],
      });
      const scope = nock('https://api.github.com')
        .get(`/repos/${repoFullName}/pulls/${prNumber}`)
        .reply(200, {
          merged: true,
          updated_at: '2022-09-03T19:39:54Z',
        });
      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          repository: {
            name: repo,
            full_name: repoFullName,
            owner: {
              login: owner,
            },
          },
          organization: {
            login: owner,
          },
          installation: {id: installationId},
          task_type: utils.MERGE_QUEUE_CALLBACK,
          pr_number: prNumber,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      sinon.assert.calledOnceWithExactly(
        getQueueStub,
        sinon.match.instanceOf(Datastore),
        repoFullName
      );
      sinon.assert.calledOnceWithExactly(
        addOrUpdateIssueCommentStub,
        sinon.match.instanceOf(Octokit),
        owner,
        repo,
        prNumber,
        installationId,
        "This pr is at top of the queue, I'm on it."
      );
      sinon.assert.calledOnceWithExactly(
        removePRFromQueueStub,
        sinon.match.instanceOf(Datastore),
        repoFullName,
        prNumber,
        sinon.match.instanceOf(GCFLogger)
      );
      scope.done();
    });
    it('removes a "dirty" PR from the queue', async () => {
      const repoFullName = 'googleapis/test-repo';
      const owner = 'googleapis';
      const repo = 'test-repo';
      const prNumber = 123;
      const installationId = 1234;
      getQueueStub.resolves({
        repoFullName: repoFullName,
        pullRequests: [prNumber],
      });
      const scope = nock('https://api.github.com')
        .get(`/repos/${repoFullName}/pulls/${prNumber}`)
        .reply(200, {
          merged: false,
          mergeable_state: 'dirty',
        });
      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          repository: {
            name: repo,
            full_name: repoFullName,
            owner: {
              login: owner,
            },
          },
          organization: {
            login: owner,
          },
          installation: {id: installationId},
          task_type: utils.MERGE_QUEUE_CALLBACK,
          pr_number: prNumber,
          merge_effort_started_at: '2022-09-03T19:39:54Z',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      sinon.assert.calledOnceWithExactly(
        getQueueStub,
        sinon.match.instanceOf(Datastore),
        repoFullName
      );
      sinon.assert.calledOnceWithExactly(
        updatePRForRemovalStub,
        sinon.match.instanceOf(Octokit),
        owner,
        repo,
        prNumber,
        installationId,
        'The PR seems to have merge conflicts. Removing from the queue.'
      );
      sinon.assert.calledOnceWithExactly(
        removePRFromQueueStub,
        sinon.match.instanceOf(Datastore),
        repoFullName,
        prNumber,
        sinon.match.instanceOf(GCFLogger)
      );
      scope.done();
    });
    it('merges a "clean" PR', async () => {
      const repoFullName = 'googleapis/test-repo';
      const owner = 'googleapis';
      const repo = 'test-repo';
      const prNumber = 123;
      const installationId = 1234;
      const updated = '2022-09-03T19:39:54Z';
      getQueueStub.resolves({
        repoFullName: repoFullName,
        pullRequests: [prNumber],
      });
      const scope = nock('https://api.github.com')
        .get(`/repos/${repoFullName}/pulls/${prNumber}`)
        .reply(200, {
          title: 'commit_title',
          merged: false,
          mergeable: true,
          mergeable_state: 'clean',
        })
        .put(`/repos/${repoFullName}/pulls/${prNumber}/merge`, {
          commit_title: 'commit_title (#123)',
          commit_message: '',
          merge_method: 'squash',
        })
        .reply(200, 'ok');

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          repository: {
            name: repo,
            full_name: repoFullName,
            owner: {
              login: owner,
            },
          },
          organization: {
            login: owner,
          },
          installation: {id: installationId},
          task_type: utils.MERGE_QUEUE_CALLBACK,
          pr_number: prNumber,
          merge_effort_started_at: updated,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      sinon.assert.calledOnceWithExactly(
        getQueueStub,
        sinon.match.instanceOf(Datastore),
        repoFullName
      );
      sinon.assert.calledOnceWithExactly(
        enqueueTaskStub,
        sinon.match.instanceOf(GCFBootstrapper),
        repoFullName,
        installationId,
        prNumber,
        sinon.match.instanceOf(GCFLogger),
        updated
      );
      scope.done();
    });
    it('updates a PR which is "behind"', async () => {
      const repoFullName = 'googleapis/test-repo';
      const owner = 'googleapis';
      const repo = 'test-repo';
      const prNumber = 123;
      const installationId = 1234;
      const updated = '2022-09-03T19:39:54Z';
      getQueueStub.resolves({
        repoFullName: repoFullName,
        pullRequests: [prNumber],
      });
      const scope = nock('https://api.github.com')
        .get(`/repos/${repoFullName}/pulls/${prNumber}`)
        .reply(200, {
          merged: false,
          mergeable: true,
          mergeable_state: 'behind',
        })
        .put(`/repos/${repoFullName}/pulls/${prNumber}/update-branch`)
        .reply(200, 'ok');

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          repository: {
            name: repo,
            full_name: repoFullName,
            owner: {
              login: owner,
            },
          },
          organization: {
            login: owner,
          },
          installation: {id: installationId},
          task_type: utils.MERGE_QUEUE_CALLBACK,
          pr_number: prNumber,
          merge_effort_started_at: updated,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      sinon.assert.calledOnceWithExactly(
        getQueueStub,
        sinon.match.instanceOf(Datastore),
        repoFullName
      );
      sinon.assert.calledOnceWithExactly(
        enqueueTaskStub,
        sinon.match.instanceOf(GCFBootstrapper),
        repoFullName,
        installationId,
        prNumber,
        sinon.match.instanceOf(GCFLogger),
        updated
      );
      scope.done();
    });
    it('removes a PR which is timed out from the queue', async () => {
      const repoFullName = 'googleapis/test-repo';
      const owner = 'googleapis';
      const repo = 'test-repo';
      const prNumber = 123;
      const installationId = 1234;
      const updated = '2022-09-03T19:39:54Z';
      getQueueStub.resolves({
        repoFullName: repoFullName,
        pullRequests: [prNumber],
      });
      const scope = nock('https://api.github.com')
        .get(`/repos/${repoFullName}/pulls/${prNumber}`)
        .reply(200, {
          merged: false,
          mergeable: true,
          mergeable_state: 'blocked',
        });

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          repository: {
            name: repo,
            full_name: repoFullName,
            owner: {
              login: owner,
            },
          },
          organization: {
            login: owner,
          },
          installation: {id: installationId},
          task_type: utils.MERGE_QUEUE_CALLBACK,
          pr_number: prNumber,
          merge_effort_started_at: updated,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      sinon.assert.calledOnceWithExactly(
        getQueueStub,
        sinon.match.instanceOf(Datastore),
        repoFullName
      );
      sinon.assert.calledOnceWithExactly(
        updatePRForRemovalStub,
        sinon.match.instanceOf(Octokit),
        owner,
        repo,
        prNumber,
        installationId,
        'The PR has not become mergeable after 1 hour, removing from the queue.'
      );
      sinon.assert.calledOnceWithExactly(
        removePRFromQueueStub,
        sinon.match.instanceOf(Datastore),
        repoFullName,
        prNumber,
        sinon.match.instanceOf(GCFLogger)
      );
      scope.done();
    });
    it('sync labels', async () => {
      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          repository: {
            name: 'test-repo',
            owner: {
              login: 'googleapis',
            },
          },
          organization: {
            login: 'googleapis',
          },
          installation: {id: 1234},
          syncLabels: true,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      sinon.assert.calledOnceWithExactly(
        syncLabelsStub,
        sinon.match.instanceOf(Octokit),
        'googleapis',
        'test-repo',
        MERGE_QUEUE_LABELS
      );
    });
  });
});
