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

// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot} from 'probot';
import {resolve} from 'path';
import nock from 'nock';
import sinon, {SinonStub} from 'sinon';
import {describe, it, beforeEach, afterEach} from 'mocha';
import handler from '../src/merge-on-green';
import {CheckStatus, Reviews, Comment, Label} from '../src/merge-logic';
import {logger} from 'gcf-utils';
import assert from 'assert';
import {Octokit} from '@octokit/rest';
import {config} from '@probot/octokit-plugin-config';
const TestingOctokit = Octokit.plugin(config);

const sandbox = sinon.createSandbox();

interface HeadSha {
  sha: string;
}

interface CheckRuns {
  name: string;
  conclusion: string;
}

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/Fixtures');

function getReviewsCompleted(response: Reviews[]) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/pulls/1/reviews')
    .reply(200, response);
}

function getLatestCommit(response: HeadSha[]) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/pulls/1/commits?per_page=100&page=1')
    .reply(200, response);
}

function getStatusi(ref: string, response: CheckStatus[]) {
  return nock('https://api.github.com')
    .get(`/repos/testOwner/testRepo/commits/${ref}/statuses`)
    .reply(200, response);
}

function getRuns(ref: string, response: CheckRuns) {
  return nock('https://api.github.com')
    .get(`/repos/testOwner/testRepo/commits/${ref}/check-runs`)
    .reply(200, response);
}

function getCommentsOnPr(response: Comment[]) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/issues/1/comments')
    .reply(200, response);
}

function getMogLabel(response: Label[]) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/issues/1/labels')
    .reply(200, response);
}

function removeMogLabel() {
  return nock('https://api.github.com')
    .delete('/repos/testOwner/testRepo/issues/1/labels/automerge')
    .reply(200);
}

function merge() {
  return nock('https://api.github.com')
    .put('/repos/testOwner/testRepo/pulls/1/merge')
    .reply(200, {sha: '123', merged: true, message: 'in a bottle'});
}

function dismissReview(reviewNumber: number) {
  return nock('https://api.github.com')
    .put(`/repos/testOwner/testRepo/pulls/1/reviews/${reviewNumber}/dismissals`)
    .reply(200);
}

function mergeWithError() {
  return nock('https://api.github.com')
    .put('/repos/testOwner/testRepo/pulls/1/merge')
    .reply(400);
}

function commentOnPR() {
  return nock('https://api.github.com')
    .post('/repos/testOwner/testRepo/issues/1/comments')
    .reply(200);
}

function updateBranch() {
  return nock('https://api.github.com')
    .put('/repos/testOwner/testRepo/pulls/1/update-branch')
    .reply(200);
}

function getBranchProtection(status: number, requiredStatusChecks: string[]) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/branches/master/protection')
    .reply(status, {
      required_status_checks: {
        contexts: requiredStatusChecks,
      },
    });
}

function getRateLimit(remaining: number) {
  return nock('https://api.github.com')
    .get('/rate_limit')
    .reply(200, {
      resources: {
        core: {
          limit: 5000,
          remaining: remaining,
          reset: 1372700873,
        },
      },
    });
}

function getPR(mergeable: boolean, mergeableState: string, state: string) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/pulls/1')
    .reply(200, {
      title: 'Test PR',
      body: 'Test Body',
      state,
      mergeable,
      mergeable_state: mergeableState,
      user: {login: 'login'},
    });
}

//meta-note about the schedule.repository as any; currently GH does not support this type, see
//open issue for a fix: https://github.com/octokit/webhooks.js/issues/277
describe('merge-on-green', () => {
  let probot: Probot;
  const loggerStub = sandbox.stub(logger, 'error').throwsArg(0);

  beforeEach(() => {
    probot = createProbot({
      githubToken: 'abc123',
      Octokit: TestingOctokit as any,
    });

    probot.load(handler);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('merge-logic', () => {
    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    handler.getDatastore = async () => {
      const pr = [
        [
          {
            repo: 'testRepo',
            number: 1,
            owner: 'testOwner',
            created: Date.now(),
            branchProtection: ['Special Check'],
          },
        ],
      ];
      return pr;
    };

    it('merges a PR on green', async () => {
      const scopes = [
        getRateLimit(5000),
        getPR(true, 'clean', 'open'),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getMogLabel([{name: 'automerge'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'success', context: 'Special Check'},
        ]),
        getCommentsOnPr([]),
        merge(),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('merges a PR on green with an exact label', async () => {
      const scopes = [
        getRateLimit(5000),
        getPR(true, 'clean', 'open'),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getMogLabel([{name: 'automerge: exact'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'success', context: 'Special Check'},
        ]),
        getCommentsOnPr([]),
        merge(),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('fails when a review has not been approved', async () => {
      const scopes = [
        getRateLimit(5000),
        getPR(true, 'clean', 'open'),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
          {
            user: {login: 'octokitten'},
            state: 'CHANGES_REQUESTED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getMogLabel([{name: 'automerge'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'success', context: 'Special Check'},
        ]),
        getCommentsOnPr([]),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('fails if there is no commit', async () => {
      const scopes = [
        getRateLimit(5000),
        getPR(true, 'clean', 'open'),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]),
        getLatestCommit([]),
        getMogLabel([{name: 'automerge'}]),
        getStatusi('', [
          {state: 'success', context: 'Kokoro - Test: Binary Compatibility'},
        ]),
        getCommentsOnPr([]),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('fails if there is no MOG label', async () => {
      const scopes = [
        getRateLimit(5000),
        getPR(true, 'clean', 'open'),
        getMogLabel([{name: 'this is not the label you are looking for'}]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('fails if there are no status checks', async () => {
      const scopes = [
        getRateLimit(5000),
        getPR(true, 'clean', 'open'),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getMogLabel([{name: 'automerge'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
        getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
          name: '',
          conclusion: '',
        }),
        getCommentsOnPr([]),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('fails if the status checks have failed', async () => {
      const scopes = [
        getRateLimit(5000),
        getPR(true, 'clean', 'open'),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getMogLabel([{name: 'automerge'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'failure', context: 'Special Check'},
        ]),
        getCommentsOnPr([]),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('passes if checks are actually check runs', async () => {
      const scopes = [
        getRateLimit(5000),
        getPR(true, 'clean', 'open'),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getMogLabel([{name: 'automerge'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
        getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
          name: 'Special Check',
          conclusion: 'success',
        }),
        getCommentsOnPr([]),
        merge(),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('fails if no one has reviewed the PR', async () => {
      const scopes = [
        getRateLimit(5000),
        getPR(true, 'clean', 'open'),
        getReviewsCompleted([]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getMogLabel([{name: 'automerge'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
        getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
          name: 'Special Check',
          conclusion: 'success',
        }),
        getCommentsOnPr([]),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    //This method is supposed to include an error
    it('updates a branch if merge returns error and branch is behind', async () => {
      loggerStub.restore();

      const scopes = [
        getRateLimit(5000),
        getPR(true, 'behind', 'open'),
        getMogLabel([{name: 'automerge'}]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'success', context: 'Special Check'},
        ]),
        getCommentsOnPr([]),
        mergeWithError(),
        updateBranch(),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    //This method is supposed to include an error
    it('comments on PR if branch is dirty and merge returns with error', async () => {
      loggerStub.restore();

      const scopes = [
        getRateLimit(5000),
        getPR(true, 'dirty', 'open'),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]),
        getMogLabel([{name: 'automerge'}]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'success', context: 'Special Check'},
        ]),
        getCommentsOnPr([]),
        mergeWithError(),
        commentOnPR(),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('fails if PR is closed', async () => {
      const scopes = [
        getRateLimit(5000),
        getPR(true, 'clean', 'closed'),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getMogLabel([{name: 'automerge'}]),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    //This test is supposed to include an error
    it('does not comment if comment is already on PR and merge errors', async () => {
      loggerStub.restore();

      const scopes = [
        getRateLimit(5000),
        getPR(true, 'dirty', 'open'),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getMogLabel([{name: 'automerge'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'success', context: 'Special Check'},
        ]),
        getCommentsOnPr([
          {
            body:
              'Your PR has conflicts that you need to resolve before merge-on-green can automerge',
          },
        ]),
        mergeWithError(),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('dismisses reviews if the label is set to exact', async () => {
      const scopes = [
        getRateLimit(5000),
        getPR(true, 'clean', 'open'),
        getMogLabel([{name: 'automerge: exact'}]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '12345',
            id: 12345,
          },
          {
            user: {login: 'octokitten'},
            state: 'APPROVED',
            commit_id: '12346',
            id: 12346,
          },
        ]),
        dismissReview(12345),
        dismissReview(12346),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'success', context: 'Special Check'},
        ]),
        getCommentsOnPr([]),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });
      scopes.forEach(s => s.done());
    });

    it('does not execute if there is no more space for requests', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const scopes = [getRateLimit(0)];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('posts a comment on the PR if the flag is set to stop and the merge has failed', async () => {
      handler.getDatastore = async () => {
        const pr = [
          [
            {
              repo: 'testRepo',
              number: 1,
              owner: 'testOwner',
              created: -14254782000,
              branchProtection: ['Special Check'],
            },
          ],
        ];
        return pr;
      };
      const scopes = [
        getRateLimit(5000),
        getPR(true, 'clean', 'open'),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getMogLabel([{name: 'automerge'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'failure', context: 'Special Check'},
        ]),
        getCommentsOnPr([]),
        commentOnPR(),
        removeMogLabel(),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('posts a comment on the PR if the flag is set to comment', async () => {
      handler.getDatastore = async () => {
        const pr = [
          [
            {
              repo: 'testRepo',
              number: 1,
              owner: 'testOwner',
              created: Date.now() - 10920000, // 3 hours ago
              branchProtection: ['Special Check'],
            },
          ],
        ];
        return pr;
      };
      const scopes = [
        getRateLimit(5000),
        getPR(true, 'clean', 'open'),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getMogLabel([{name: 'automerge'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'failure', context: 'Special Check'},
        ]),
        getCommentsOnPr([]),
        commentOnPR(),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('rejects status checks that do not match the required check', async () => {
      handler.getDatastore = async () => {
        const pr = [
          [
            {
              repo: 'testRepo',
              number: 1,
              owner: 'testOwner',
              created: Date.now(),
              branchProtection: ["this is what we're looking for"],
            },
          ],
        ];
        return pr;
      };

      const scopes = [
        getRateLimit(5000),
        getPR(true, 'clean', 'open'),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getMogLabel([{name: 'automerge'}]),
        //Intentionally giving this status check a misleading name. We want subtests to match the beginning
        //of required status checks, not the other way around. i.e., if the required status check is "passes"
        //then it should reject a status check called "passe", but pass one called "passesS"
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'success', context: "this is what we're looking fo"},
        ]),
        getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
          name: "this is what we're looking fo",
          conclusion: 'success',
        }),
        getCommentsOnPr([]),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('accepts status checks that match the beginning of the required status check', async () => {
      handler.getDatastore = async () => {
        const pr = [
          [
            {
              repo: 'testRepo',
              number: 1,
              owner: 'testOwner',
              created: Date.now(),
              branchProtection: ["this is what we're looking for"],
            },
          ],
        ];
        return pr;
      };

      const scopes = [
        getRateLimit(5000),
        getPR(true, 'clean', 'open'),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]),
        getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getMogLabel([{name: 'automerge'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {
            state: 'success',
            context: "this is what we're looking for/subtest",
          },
        ]),
        getCommentsOnPr([]),
        merge(),
      ];

      await probot.receive({
        name: 'schedule.repository' as any,
        payload: {org: 'testOwner'},
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });
  });

  describe('merge-on-green wrapper logic', () => {
    let addPRStub: SinonStub;
    beforeEach(() => {
      addPRStub = sandbox.stub(handler, 'addPR');
    });

    afterEach(() => {
      addPRStub.restore();
    });

    it('adds a PR when label is added correctly', async () => {
      const scopes = [
        getRateLimit(5000),
        getBranchProtection(200, ['Special Check']),
      ];

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_labeled'
      ));

      await probot.receive({
        name: "pull_request",
        payload: {
          action: "labeled"
        },
        id: "abc123",
      });

      scopes.forEach(s => s.done());
      assert(addPRStub.called);
    });

    //This function is supposed to respond with an error
    it('does not add a PR if there is no branch protection and comments', async () => {
      loggerStub.restore();

      const scopes = [
        getRateLimit(5000),
        getBranchProtection(400, []),
        commentOnPR(),
      ];
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_labeled'
      ));

      await probot.receive({
        name: "pull_request",
        payload: {
          action: "labeled"
        },
        id: "abc123",
      });

      scopes.forEach(s => s.done());

      assert(!addPRStub.called);

      logger.info('stub called? ' + addPRStub.called);
    });

    it('does not execute if there is no more space for requests', async () => {
      const scopes = [getRateLimit(0)];

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_labeled'
      ));

      await probot.receive({
        name: "pull_request",
        payload: {
          action: "labeled"
        },
        id: "abc123",
      });

      scopes.forEach(s => s.done());

      assert(!addPRStub.called);

      logger.info('stub called? ' + addPRStub.called);
    });
  });
});
