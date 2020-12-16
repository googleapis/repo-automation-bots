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
import {Probot, createProbot, ProbotOctokit} from 'probot';
import {resolve} from 'path';
import nock from 'nock';
import sinon, {SinonStub} from 'sinon';
import {describe, it, beforeEach, afterEach} from 'mocha';
import handler from '../src/merge-on-green';
import {CheckStatus, Reviews, Comment} from '../src/merge-logic';
import {logger} from 'gcf-utils';
import assert from 'assert';
// eslint-disable-next-line node/no-extraneous-import
import {config} from '@probot/octokit-plugin-config';

const TestingOctokit = ProbotOctokit.plugin(config);
const testingOctokitInstance = new TestingOctokit({auth: 'abc123'});
const sandbox = sinon.createSandbox();

interface HeadSha {
  sha: string;
}

interface CheckRuns {
  name: string;
  conclusion: string;
}

interface PR {
  number: number;
  owner: string;
  repo: string;
  state: string;
  html_url: string;
  user: {
    login: string;
  };
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

function removeMogLabel(label: string) {
  return nock('https://api.github.com')
    .delete(`/repos/testOwner/testRepo/issues/1/labels/${label}`)
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

function getPRCleanUp(state: string, merged: boolean) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/pulls/1')
    .reply(200, {state, merged});
}

function getLabels(name: string) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/issues/1/labels')
    .reply(200, [{name}]);
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

function react() {
  return nock('https://api.github.com')
    .post('/repos/testOwner/testRepo/issues/1/reactions')
    .reply(200, {id: 1});
}

function removeReaction() {
  return nock('https://api.github.com')
    .delete('/repos/testOwner/testRepo/issues/1/reactions/1')
    .reply(204);
}

function getPR(
  mergeable: boolean,
  mergeableState: string,
  state: string,
  labels: {name: string}[] = []
) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/pulls/1')
    .reply(200, {
      title: 'Test PR',
      body: 'Test Body',
      state,
      mergeable,
      mergeable_state: mergeableState,
      user: {login: 'login'},
      labels,
    });
}

function searchForPRs(pr: PR[], labelName: string) {
  return nock('https://api.github.com')
    .get(
      `/search/issues?q=is%3Aopen%20is%3Apr%20user%3Agoogleapis%20user%3AGoogleCloudPlatform%20label%3A%22${labelName}%22`
    )
    .reply(200, pr);
}

//meta-note about the schedule.repository as any; currently GH does not support this type, see
//open issue for a fix: https://github.com/octokit/webhooks.js/issues/277
describe('merge-on-green', () => {
  let probot: Probot;
  const loggerStub = sandbox.stub(logger, 'error').throwsArg(0);

  beforeEach(() => {
    probot = createProbot({
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      }),
    });

    const app = probot.load(handler);
    app.auth = async () => testingOctokitInstance;
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('merge-logic', () => {
    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    describe('with default/normal get Datastore payload', () => {
      handler.getDatastore = async () => {
        const pr = [
          [
            {
              repo: 'testRepo',
              number: 1,
              owner: 'testOwner',
              created: Date.now(),
              branchProtection: ['Special Check'],
              label: 'automerge',
              author: 'testOwner',
              reactionId: 1,
              url: 'url/url',
              installationId: 123456,
            },
          ],
        ];
        return pr;
      };

      it('merges a PR on green', async () => {
        const scopes = [
          getRateLimit(5000),
          getReviewsCompleted([
            {
              user: {login: 'octocat'},
              state: 'APPROVED',
              commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              id: 12345,
            },
          ]),
          getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
          getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
            {state: 'success', context: 'Special Check'},
          ]),
          getPR(true, 'clean', 'open'),
          getCommentsOnPr([]),
          merge(),
          removeMogLabel('automerge'),
          removeReaction(),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner'},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('fails when a review has not been approved', async () => {
        const scopes = [
          getRateLimit(5000),
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
          getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
            {state: 'success', context: 'Special Check'},
          ]),
          getCommentsOnPr([]),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner'},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('fails if there is no commit', async () => {
        const scopes = [
          getRateLimit(5000),
          getReviewsCompleted([
            {
              user: {login: 'octocat'},
              state: 'APPROVED',
              commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              id: 12345,
            },
          ]),
          getLatestCommit([]),
          getStatusi('', [
            {state: 'success', context: 'Kokoro - Test: Binary Compatibility'},
          ]),
          getCommentsOnPr([]),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner'},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('fails if there are no status checks', async () => {
        const scopes = [
          getRateLimit(5000),
          getReviewsCompleted([
            {
              user: {login: 'octocat'},
              state: 'APPROVED',
              commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              id: 12345,
            },
          ]),
          getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
          getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
          getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
            name: '',
            conclusion: '',
          }),
          getCommentsOnPr([]),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner'},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('fails if the status checks have failed', async () => {
        const scopes = [
          getRateLimit(5000),
          getReviewsCompleted([
            {
              user: {login: 'octocat'},
              state: 'APPROVED',
              commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              id: 12345,
            },
          ]),
          getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
          getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
            {state: 'failure', context: 'Special Check'},
          ]),
          getCommentsOnPr([]),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner'},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('passes if checks are actually check runs', async () => {
        const scopes = [
          getRateLimit(5000),
          getReviewsCompleted([
            {
              user: {login: 'octocat'},
              state: 'APPROVED',
              commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              id: 12345,
            },
          ]),
          getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
          getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
          getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
            name: 'Special Check',
            conclusion: 'success',
          }),
          getCommentsOnPr([]),
          getPR(true, 'clean', 'open'),
          merge(),
          removeMogLabel('automerge'),
          removeReaction(),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner'},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('fails if there is a do not merge label', async () => {
        const scopes = [
          getRateLimit(5000),
          getReviewsCompleted([
            {
              user: {login: 'octocat'},
              state: 'APPROVED',
              commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              id: 12345,
            },
          ]),
          getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
          getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
          getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
            name: 'Special Check',
            conclusion: 'success',
          }),
          getCommentsOnPr([]),
          getPR(true, 'clean', 'open', [{name: 'do not merge'}]),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner'},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('fails if no one has reviewed the PR', async () => {
        const scopes = [
          getRateLimit(5000),
          getReviewsCompleted([]),
          getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
          getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
          getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
            name: 'Special Check',
            conclusion: 'success',
          }),
          getCommentsOnPr([]),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
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
          getPR(true, 'behind', 'open'),
          mergeWithError(),
          updateBranch(),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner'},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      //This test is supposed to include an error
      it('comments on PR if branch is dirty and merge returns with error', async () => {
        loggerStub.restore();

        const scopes = [
          getRateLimit(5000),
          getReviewsCompleted([
            {
              user: {login: 'octocat'},
              state: 'APPROVED',
              commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              id: 12345,
            },
          ]),
          getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
          getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
            {state: 'success', context: 'Special Check'},
          ]),
          getCommentsOnPr([]),
          getPR(true, 'dirty', 'open'),
          mergeWithError(),
          commentOnPR(),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
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
          getReviewsCompleted([
            {
              user: {login: 'octocat'},
              state: 'APPROVED',
              commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              id: 12345,
            },
          ]),
          getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
          getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
            {state: 'success', context: 'Special Check'},
          ]),
          getCommentsOnPr([
            {
              body:
                'Your PR has conflicts that you need to resolve before merge-on-green can automerge',
            },
          ]),
          getPR(true, 'dirty', 'open'),
          mergeWithError(),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner'},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('does not execute if there is no more space for requests', async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const scopes = [getRateLimit(0)];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner'},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });
    });

    describe('with different Datastore payloads', () => {
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
                label: 'automerge',
                author: 'testOwner',
                reactionId: 1,
              },
            ],
          ];
          return pr;
        };

        const scopes = [
          getRateLimit(5000),
          getReviewsCompleted([
            {
              user: {login: 'octocat'},
              state: 'APPROVED',
              commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              id: 12345,
            },
          ]),
          getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
          getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
            {state: 'failure', context: 'Special Check'},
          ]),
          getCommentsOnPr([]),
          commentOnPR(),
          removeMogLabel('automerge'),
          removeReaction(),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
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
                label: 'automerge',
                author: 'testOwner',
                reactionId: 1,
              },
            ],
          ];
          return pr;
        };

        const scopes = [
          getRateLimit(5000),
          getReviewsCompleted([
            {
              user: {login: 'octocat'},
              state: 'APPROVED',
              commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              id: 12345,
            },
          ]),
          getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
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
          name: 'schedule.repository' as '*',
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
                label: 'automerge',
                author: 'testOwner',
                reactionId: 1,
              },
            ],
          ];
          return pr;
        };

        const scopes = [
          getRateLimit(5000),
          getReviewsCompleted([
            {
              user: {login: 'octocat'},
              state: 'APPROVED',
              commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              id: 12345,
            },
          ]),
          getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
          getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
            {
              state: 'success',
              context: "this is what we're looking for/subtest",
            },
          ]),
          getCommentsOnPr([]),
          getPR(true, 'clean', 'open'),
          merge(),
          removeMogLabel('automerge'),
          removeReaction(),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner'},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('merges a PR on green with exact label', async () => {
        handler.getDatastore = async () => {
          const pr = [
            [
              {
                repo: 'testRepo',
                number: 1,
                owner: 'testOwner',
                created: Date.now(),
                branchProtection: ['Special Check'],
                label: 'automerge: exact',
                author: 'testOwner',
                reactionId: 1,
              },
            ],
          ];
          return pr;
        };

        const scopes = [
          getRateLimit(5000),
          getReviewsCompleted([
            {
              user: {login: 'octocat'},
              state: 'APPROVED',
              commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              id: 12345,
            },
          ]),
          getLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
          getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
            {state: 'success', context: 'Special Check'},
          ]),
          getPR(true, 'clean', 'open'),
          getCommentsOnPr([]),
          merge(),
          removeMogLabel('automerge%3A%20exact'),
          removeReaction(),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner'},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('dismisses reviews if automerge label is set to exact', async () => {
        handler.getDatastore = async () => {
          const pr = [
            [
              {
                repo: 'testRepo',
                number: 1,
                owner: 'testOwner',
                created: Date.now(),
                branchProtection: ['Special Check'],
                label: 'automerge: exact',
                author: 'testOwner',
                reactionId: 1,
              },
            ],
          ];
          return pr;
        };

        const scopes = [
          getRateLimit(5000),
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
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner'},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });
    });
  });

  describe('merge-on-green wrapper logic', () => {
    let addPRStub: SinonStub;
    let removePRStub: SinonStub;
    let getPRStub: SinonStub;

    beforeEach(() => {
      addPRStub = sandbox.stub(handler, 'addPR');
      removePRStub = sandbox.stub(handler, 'removePR');
      getPRStub = sandbox.stub(handler, 'getPR');
    });

    afterEach(() => {
      addPRStub.restore();
      removePRStub.restore();
      getPRStub.restore();
    });

    describe('adding-a-PR-to-Datastore (addPR) method', async () => {
      it('does not add a PR if no branch protection', async () => {
        addPRStub.restore();
        loggerStub.restore();

        const scopes = [
          getRateLimit(5000),
          // we're purposefully calling an error here
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
          name: 'pull_request',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('adds a PR and reacts if branch protection', async () => {
        addPRStub.restore();
        addPRStub = sandbox.stub(handler, 'addPR').callsFake(async () => {
          const branchProtection = await handler.checkForBranchProtection(
            'testOwner',
            'testRepo',
            1,
            testingOctokitInstance
          );
          if (branchProtection) {
            try {
              await handler.createReaction(
                'testOwner',
                'testRepo',
                1,
                testingOctokitInstance
              );
            } catch (err) {
              logger.error(err);
            }
          }
        });
        const scopes = [
          getRateLimit(5000),
          // we're purposefully calling an error here
          getBranchProtection(200, ['Special Check']),
          react(),
        ];
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_labeled'
        ));
        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });
    });
    describe('cleanup repository events', () => {
      it('deletes a PR if PR is closed when cleaning up repository', async () => {
        handler.getDatastore = async () => {
          const pr = [
            [
              {
                repo: 'testRepo',
                number: 1,
                owner: 'testOwner',
                created: Date.now(),
                branchProtection: ['Special Check'],
                label: 'automerge',
                author: 'testOwner',
                reactionId: 1,
              },
            ],
          ];
          return pr;
        };

        const scopes = [
          getPRCleanUp('closed', false),
          getLabels('automerge'),
          removeMogLabel('automerge'),
          removeReaction(),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner', cleanUp: true},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
        assert(removePRStub.called);
      });

      it('deletes a PR if PR is merged when cleaning up repository', async () => {
        const scopes = [
          getPRCleanUp('closed', true),
          getLabels('automerge'),
          removeMogLabel('automerge'),
          removeReaction(),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner', cleanUp: true},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
        assert(removePRStub.called);
      });

      it('deletes a PR if label is not found when cleaning up repository', async () => {
        const scopes = [
          getPRCleanUp('closed', true),
          getLabels('anotherLabel'),
          removeMogLabel('automerge'),
          removeReaction(),
        ];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner', cleanUp: true},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
        assert(removePRStub.called);
      });

      it('does not delete a PR if it is not invalid', async () => {
        const scopes = [getPRCleanUp('open', false), getLabels('automerge')];

        await probot.receive({
          name: 'schedule.repository' as '*',
          payload: {org: 'testOwner', cleanUp: true},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
        assert(!removePRStub.called);
      });
    });

    describe('pick up PRs', () => {
      it('adds a PR if the PR was not picked up by a webhook event w automerge label', async () => {
        getPRStub.restore();
        getPRStub = sandbox.stub(handler, 'getPR').resolves();
        const scopes = [
          searchForPRs(
            [
              {
                number: 1,
                owner: 'testOwner',
                repo: 'testRepo',
                state: 'continue',
                html_url: 'https://github.com/testOwner/testRepo/pull/1',
                user: {
                  login: 'testOwner',
                },
              },
            ],
            'automerge'
          ),
          searchForPRs([], 'automerge%3A%20exact'),
        ];

        await probot.receive({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          name: 'schedule.repository' as any,
          payload: {
            repository: {
              name: 'testRepo',
              owner: {
                login: 'testOwner',
              },
            },
            organization: {
              login: 'testOwner',
            },
            org: 'testOwner',
            cron_org: 'testOwner',
          },
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
        assert(getPRStub.called);
        assert(addPRStub.called);
      });

      it('adds a PR if the PR was not picked up by a webhook event w automerge: exact label', async () => {
        getPRStub.restore();
        getPRStub = sandbox.stub(handler, 'getPR').resolves();
        const scopes = [
          searchForPRs([], 'automerge'),
          searchForPRs(
            [
              {
                number: 1,
                owner: 'testOwner',
                repo: 'testRepo',
                state: 'continue',
                html_url: 'https://github.com/testOwner/testRepo/pull/6',
                user: {
                  login: 'testOwner',
                },
              },
            ],
            'automerge%3A%20exact'
          ),
        ];

        await probot.receive({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          name: 'schedule.repository' as any,
          payload: {
            repository: {
              name: 'testRepo',
              owner: {
                login: 'testOwner',
              },
            },
            organization: {
              login: 'testOwner',
            },
            org: 'testOwner',
            cron_org: 'testOwner',
          },
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
        assert(getPRStub.called);
        assert(addPRStub.called);
      });

      it('does not add a PR if no labels were found under automerge or automerge exact', async () => {
        const scopes = [
          searchForPRs([], 'automerge'),
          searchForPRs([], 'automerge%3A%20exact'),
        ];

        await probot.receive({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          name: 'schedule.repository' as any,
          payload: {
            repository: {
              name: 'testRepo',
              owner: {
                login: 'testOwner',
              },
            },
            organization: {
              login: 'testOwner',
            },
            org: 'testOwner',
            cron_org: 'testOwner',
          },
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
        assert(!addPRStub.called);
      });

      it('does not add a PR if label is in Datastore already', async () => {
        getPRStub.restore();
        getPRStub = sandbox.stub(handler, 'getPR').resolves({
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          branchProtextion: ['Special Check'],
          label: 'automerge',
          author: 'testOwner',
          url: 'https://github.com/testOwner/testRepo/pull/6',
          reactionId: 1,
        });

        const scopes = [
          searchForPRs(
            [
              {
                number: 1,
                owner: 'testOwner',
                repo: 'testRepo',
                state: 'continue',
                html_url: 'https://github.com/testOwner/testRepo/pull/6',
                user: {
                  login: 'testOwner',
                },
              },
            ],
            'automerge'
          ),
          searchForPRs([], 'automerge%3A%20exact'),
        ];

        await probot.receive({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          name: 'schedule.repository' as any,
          payload: {
            repository: {
              name: 'testRepo',
              owner: {
                login: 'testOwner',
              },
            },
            organization: {
              login: 'testOwner',
            },
            org: 'testOwner',
            cron_org: 'testOwner',
          },
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
        assert(getPRStub.called);
        assert(!addPRStub.called);
      });
    });

    describe('PRs when labeled', () => {
      handler.allowlist = ['testOwner'];
      it('adds a PR when label is added correctly', async () => {
        const scopes = [getRateLimit(5000)];

        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_labeled'
        ));

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
        assert(addPRStub.called);
      });

      //This function is supposed to respond with an error
      it('does not add a PR if branch protection errors and comments on PR', async () => {
        addPRStub.restore();
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
          name: 'pull_request',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('does not add a PR if PR is labeled but does not include MOG', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'labeled',
            number: 1,
            repository: {
              name: 'testRepo',
              owner: {
                login: 'testOwner',
              },
            },
            pull_request: {
              html_url: 'https://github.com/testOwner/testRepo/pull/6',
              user: {
                login: 'testOwner',
              },
              labels: [
                {
                  name: 'bug',
                },
              ],
            },
            installation: {
              id: 'abc123',
            },
          },
          id: 'abc123',
        });

        assert(!addPRStub.called);

        logger.info('stub called? ' + addPRStub.called);
      });

      it('does not add a PR if PR is labeled but is not in allowlist', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'labeled',
            number: 1,
            repository: {
              name: 'testRepo',
              owner: {
                login: 'denylistOwner',
              },
            },
            pull_request: {
              html_url: 'https://github.com/testOwner/testRepo/pull/6',
              user: {
                login: 'testOwner',
              },
              labels: [
                {
                  name: 'automerge',
                },
              ],
            },
            installation: {
              id: 'abc123',
            },
          },
          id: 'abc123',
        });

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
          name: 'pull_request',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());

        assert(!addPRStub.called);

        logger.info('stub called? ' + addPRStub.called);
      });
    });

    describe('PRs when closed, merged or unlabeled', () => {
      it('deletes a PR from datastore if it was closed', async () => {
        getPRStub.restore();
        getPRStub = sandbox.stub(handler, 'getPR').resolves({
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          branchProtextion: ['Special Check'],
          label: 'automerge',
          author: 'testOwner',
          url: 'https://github.com/testOwner/testRepo/pull/6',
          reactionId: 1,
        });

        const scopes = [removeReaction(), removeMogLabel('automerge')];

        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'closed',
            repository: {
              name: 'testRepo',
              owner: {
                login: 'testOwner',
              },
            },
            pull_request: {
              number: 1,
              html_url: 'https://github.com/testOwner/testRepo/pull/6',
              user: {
                login: 'testOwner',
              },
              labels: [
                {
                  name: 'automerge',
                },
              ],
            },
          },
          id: 'abc123',
        });

        assert(getPRStub.called);
        scopes.forEach(s => s.done());
        assert(removePRStub.called);

        logger.info('getPR stub called? ' + getPRStub.called);
        logger.info('remove stub called? ' + removePRStub.called);

        getPRStub.restore();
      });

      it('deletes a PR from datastore if it unlabeled MOG', async () => {
        getPRStub.restore();
        getPRStub = sandbox.stub(handler, 'getPR').resolves({
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          branchProtextion: ['Special Check'],
          label: 'automerge',
          author: 'testOwner',
          url: 'https://github.com/testOwner/testRepo/pull/6',
          reactionId: 1,
        });

        const scopes = [removeReaction(), removeMogLabel('automerge')];

        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'unlabeled',
            repository: {
              name: 'testRepo',
              owner: {
                login: 'testOwner',
              },
            },
            pull_request: {
              number: 1,
              html_url: 'https://github.com/testOwner/testRepo/pull/6',
              user: {
                login: 'testOwner',
              },
              labels: [
                {
                  name: 'buggy',
                },
              ],
            },
          },
          id: 'abc123',
        });

        assert(getPRStub.called);
        scopes.forEach(s => s.done());
        assert(removePRStub.called);

        logger.info('getPR stub called? ' + getPRStub.called);
        logger.info('remove stub called? ' + removePRStub.called);
      });

      it('does not delete a PR from datastore if it unlabeled another label other than MOG', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'unlabeled',
            repository: {
              name: 'testRepo',
              owner: {
                login: 'testOwner',
              },
            },
            pull_request: {
              number: 1,
              html_url: 'https://github.com/testOwner/testRepo/pull/6',
              user: {
                login: 'testOwner',
              },
              labels: [
                {
                  name: 'automerge',
                },
              ],
            },
          },
          id: 'abc123',
        });

        assert(!getPRStub.called);
        assert(!removePRStub.called);

        logger.info('getPR stub called? ' + getPRStub.called);
        logger.info('remove stub called? ' + removePRStub.called);
      });

      it('does not delete a PR if PR merged is not in the table', async () => {
        getPRStub.restore();
        getPRStub = sandbox.stub(handler, 'getPR').resolves(undefined);

        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'merged',
            repository: {
              name: 'notherightrepo',
              owner: {
                login: 'nottherightowner',
              },
            },
            pull_request: {
              number: 1,
              html_url: 'https://github.com/testOwner/testRepo/pull/8',
              user: {
                login: 'testOwner',
              },
              labels: [
                {
                  name: 'automerge',
                },
              ],
            },
          },
          id: 'abc123',
        });

        assert(getPRStub.called);
        assert(!removePRStub.called);

        logger.info('getPR stub called? ' + getPRStub.called);
        logger.info('remove stub called? ' + removePRStub.called);
      });
    });
  });
});
