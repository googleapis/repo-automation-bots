// Copyright 2021 Google LLC
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
import nock from 'nock';
import sinon, {SinonStub} from 'sinon';
import {describe, it, beforeEach, afterEach} from 'mocha';
import assert from 'assert';
import {handler} from '../src/merge-on-green';
import {
  CheckStatus,
  Reviews,
  Comment,
  getLatestCommit,
  cleanGHLinks,
} from '../src/merge-logic';
import {logger} from 'gcf-utils';
import * as gcfUtilsModule from 'gcf-utils';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';

const sandbox = sinon.createSandbox();
const fetch = require('node-fetch');

interface HeadSha {
  sha: string;
}

interface CheckRuns {
  name: string;
  conclusion: string;
  status: string;
}

nock.disableNetConnect();

function getReviewsCompleted(response: Reviews[]) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/pulls/1/reviews')
    .reply(200, response);
}

function mockLatestCommit(response: HeadSha[]) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/pulls/1/commits')
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

function removeReaction() {
  return nock('https://api.github.com')
    .delete('/repos/testOwner/testRepo/issues/1/reactions/1')
    .reply(204);
}

function getPR(
  mergeable: boolean,
  mergeableState: string,
  state: string,
  labels: {name: string}[] = [],
  body: string | null | undefined = 'Test Body'
) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/pulls/1')
    .reply(200, {
      title: 'Test PR',
      body,
      state,
      mergeable,
      mergeable_state: mergeableState,
      user: {login: 'login'},
      labels,
    });
}

//meta-note about the schedule.repository as any; currently GH does not support this type, see
//open issue for a fix: https://github.com/octokit/webhooks.js/issues/277
describe('merge-logic', () => {
  let probot: Probot;
  let loggerStub: SinonStub;
  let getAuthenticatedOctokitStub: SinonStub;

  beforeEach(() => {
    loggerStub = sandbox.stub(logger, 'error').throwsArg(0);
    sandbox.stub(handler, 'removePR').resolves(undefined);
    probot = createProbot({
      overrides: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
      },
    });

    probot.load(handler);
    // TODO(sofisl): Remove once metrics have been collected (06/15/21)
    sandbox.stub(Math, 'random').returns(0.1);
    getAuthenticatedOctokitStub = sandbox.stub(
      gcfUtilsModule,
      'getAuthenticatedOctokit'
    );
    getAuthenticatedOctokitStub.resolves(new Octokit({request: {fetch}}));
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('with default/normal get Datastore payload', () => {
    beforeEach(() => {
      sandbox.stub(handler, 'getDatastore').resolves([
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
      ]);
    });

    it('merges a PR on green', async () => {
      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('merges a PR with empty body on green', async () => {
      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'success', context: 'Special Check'},
        ]),
        getPR(true, 'clean', 'open', [], /* body: */ null),
        getCommentsOnPr([]),
        merge(),
        removeMogLabel('automerge'),
        removeReaction(),
      ];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('fails if there is no commit', async () => {
      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([]),
        getStatusi('', [
          {state: 'success', context: 'Kokoro - Test: Binary Compatibility'},
        ]),
        getCommentsOnPr([]),
      ];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('fails if there are no status checks', async () => {
      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
        getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
          name: '',
          conclusion: '',
          status: '',
        }),
        getCommentsOnPr([]),
      ];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('fails if the status checks have failed', async () => {
      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'failure', context: 'Special Check'},
        ]),
        getCommentsOnPr([]),
      ];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('passes if checks are actually check runs', async () => {
      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
        getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
          name: 'Special Check',
          conclusion: 'success',
          status: 'completed',
        }),
        getCommentsOnPr([]),
        getPR(true, 'clean', 'open'),
        merge(),
        removeMogLabel('automerge'),
        removeReaction(),
      ];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('passes if checks are marked neutral check runs', async () => {
      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
        getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
          name: 'Special Check',
          conclusion: 'neutral',
          status: 'completed',
        }),
        getCommentsOnPr([]),
        getPR(true, 'clean', 'open'),
        merge(),
        removeMogLabel('automerge'),
        removeReaction(),
      ];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('fails if there is a do not merge label', async () => {
      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
        getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
          name: 'Special Check',
          conclusion: 'success',
          status: 'completed',
        }),
        getCommentsOnPr([]),
        getPR(true, 'clean', 'open', [{name: 'do not merge'}]),
      ];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('fails if the check is incomplete', async () => {
      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
        getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
          name: 'Special Check',
          conclusion: 'success',
          status: 'in_progress',
        }),
        getCommentsOnPr([]),
      ];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    //This method is supposed to include an error
    it('updates a branch if merge returns error and branch is behind', async () => {
      loggerStub.restore();

      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'success', context: 'Special Check'},
        ]),
        getCommentsOnPr([]),
        getPR(true, 'behind', 'open'),
        mergeWithError(),
        updateBranch(),
      ];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    //This test is supposed to include an error
    it('comments on PR if branch is dirty and merge returns with error', async () => {
      loggerStub.restore();

      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'success', context: 'Special Check'},
        ]),
        getCommentsOnPr([]),
        getPR(true, 'dirty', 'open'),
        mergeWithError(),
        commentOnPR(),
      ];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    //This test is supposed to include an error
    it('does not comment if comment is already on PR and merge errors', async () => {
      loggerStub.restore();

      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'success', context: 'Special Check'},
        ]),
        getCommentsOnPr([
          {
            body: 'Your PR has conflicts that you need to resolve before merge-on-green can automerge',
          },
        ]),
        getPR(true, 'dirty', 'open'),
        mergeWithError(),
      ];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('does not execute if there is no more space for requests', async () => {
      loggerStub.restore();
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const scopes = [getRateLimit(0)];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });
  });

  describe('with different Datastore payloads', () => {
    it('posts a comment on the PR if the flag is set to stop and the merge has failed', async () => {
      sandbox.stub(handler, 'getDatastore').resolves([
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
      ]);

      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'failure', context: 'Special Check'},
        ]),
        getCommentsOnPr([]),
        commentOnPR(),
        removeMogLabel('automerge'),
        removeReaction(),
      ];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('rejects status checks that do not match the required check', async () => {
      sandbox.stub(handler, 'getDatastore').resolves([
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
      ]);

      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        //Intentionally giving this status check a misleading name. We want subtests to match the beginning
        //of required status checks, not the other way around. i.e., if the required status check is "passes"
        //then it should reject a status check called "passe", but pass one called "passesS"
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'success', context: "this is what we're looking fo"},
        ]),
        getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
          name: "this is what we're looking fo",
          conclusion: 'success',
          status: 'completed',
        }),
        getCommentsOnPr([]),
      ];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('accepts status checks that match the beginning of the required status check', async () => {
      sandbox.stub(handler, 'getDatastore').resolves([
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
      ]);

      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('merges a PR on green with exact label', async () => {
      sandbox.stub(handler, 'getDatastore').resolves([
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
      ]);

      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'success', context: 'Special Check'},
        ]),
        getPR(true, 'clean', 'open', [{name: 'automerge: exact'}]),
        getReviewsCompleted([
          {
            user: {login: 'octocat'},
            state: 'APPROVED',
            commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
            id: 12345,
          },
        ]),
        getCommentsOnPr([]),
        merge(),
        removeMogLabel('automerge%3A%20exact'),
        removeReaction(),
      ];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });

    it('dismisses reviews if automerge label is set to exact', async () => {
      sandbox.stub(handler, 'getDatastore').resolves([
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
      ]);

      const scopes = [
        getRateLimit(5000),
        mockLatestCommit([{sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'}]),
        getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
          {state: 'success', context: 'Special Check'},
        ]),
        getPR(true, 'clean', 'open', [{name: 'automerge: exact'}]),
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
        getCommentsOnPr([]),
        dismissReview(12346),
        dismissReview(12345),
        merge(),
        removeMogLabel('automerge%3A%20exact'),
        removeReaction(),
      ];

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.installation' as any,
        payload: {
          cron_type: 'installation',
          cron_org: 'testOwner',
          performMerge: true,
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });

      scopes.forEach(s => s.done());
    });
  });

  describe('gets latest commit', () => {
    it('gets the latest commit if there were more than 100', async () => {
      const arrayOfCommits = [];
      for (let i = 0; i < 102; i++) {
        if (i === 101) {
          arrayOfCommits.push({sha: '6dcb09b5blastcommitaebed695e2e4193db5e'});
        } else {
          arrayOfCommits.push({
            sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
          });
        }
      }
      const lastCommitRequest = mockLatestCommit(arrayOfCommits);
      const lastCommit = await getLatestCommit(
        'testOwner',
        'testRepo',
        1,
        new Octokit({auth: 'abc123', request: {fetch}})
      );
      lastCommitRequest.done();
      assert.match(lastCommit, /lastcommit/);
    });
  });

  describe('cleans GH links from GH body', () => {
    it('converts GH links to togithub.gom', async () => {
      const bodyToClean =
        'Reactor-Core 3.4.16 is part of 2020.0.17 Release Train (Europium SR17).' +
        'This service release contains a few bugfixes and improvements.' +
        "What's Changed" +
        '✨ New features and improvements' +
        'Improve BoundedElasticScheduler to be less blocking by @​simonbasle in https://github.com/reactor/reactor-core/pull/2909' +
        'Add EmitFailureHandler.busyLoop flavor by @​Animesh27 in https://github.com/reactor/reactor-core/pull/2943' +
        '🐞 Bug fixes' +
        'Fix Mono.then not cancelling between Callable sources by @​simonbasle in https://github.com/reactor/reactor-core/pull/2934' +
        '📖 Documentation, Tests and Build' +
        'Update Gradle to v7.4 in https://github.com/reactor/reactor-core/pull/2922' +
        '[doc] Correct flux subscribe example in faq by @​liukun2634 in https://github.com/reactor/reactor-core/pull/2924' +
        'Show how-to-fix hints in CI when preliminary steps fail (check of license headers, api compatibility) by @​simonbasle in https://github.com/reactor/reactor-core/pull/2932' +
        '[guide] Remove ref to Swing/SwtScheduler in addons appendix by @​simonbasle in https://github.com/reactor/reactor-core/pull/2959' +
        '[build] Have jcstress part of slowerChecks by @​simonbasle in https://github.com/reactor/reactor-core/pull/2958' +
        '🆙 Dependency Upgrades' +
        'Update plugin spotless to v6.3.0 in https://github.com/reactor/reactor-core/pull/2925' +
        'Update plugin bnd to v6.2.0 in https://github.com/reactor/reactor-core/pull/2941' +
        'Update dependency org.awaitility:awaitility to v4.2.0 in https://github.com/reactor/reactor-core/pull/2945' +
        'Update dependency ch.qos.logback:logback-classic to v1.2.11 in https://github.com/reactor/reactor-core/pull/2946' +
        'Update dependency com.tngtech.archunit:archunit to v0.23.1 in https://github.com/reactor/reactor-core/pull/2940' +
        'Update plugin japicmp to v0.4.0 in https://github.com/reactor/reactor-core/pull/2948' +
        'Update dependency org.mockito:mockito-core to v4.4.0 in https://github.com/reactor/reactor-core/pull/2951' +
        'Update plugin download to v5.0.2 in https://github.com/reactor/reactor-core/pull/2950' +
        'New Contributors' +
        '@​Animesh27 made their first contribution in https://github.com/reactor/reactor-core/pull/2943 👍' +
        'Full Changelog: reactor/reactor-core@v3.4.15...v3.4.16';
      const messageWithoutGHLinks = cleanGHLinks(bodyToClean);

      const cleanedBody =
        'Reactor-Core 3.4.16 is part of 2020.0.17 Release Train (Europium SR17).' +
        'This service release contains a few bugfixes and improvements.' +
        "What's Changed" +
        '✨ New features and improvements' +
        'Improve BoundedElasticScheduler to be less blocking by @​simonbasle in https://togithub.com/reactor/reactor-core/pull/2909' +
        'Add EmitFailureHandler.busyLoop flavor by @​Animesh27 in https://togithub.com/reactor/reactor-core/pull/2943' +
        '🐞 Bug fixes' +
        'Fix Mono.then not cancelling between Callable sources by @​simonbasle in https://togithub.com/reactor/reactor-core/pull/2934' +
        '📖 Documentation, Tests and Build' +
        'Update Gradle to v7.4 in https://togithub.com/reactor/reactor-core/pull/2922' +
        '[doc] Correct flux subscribe example in faq by @​liukun2634 in https://togithub.com/reactor/reactor-core/pull/2924' +
        'Show how-to-fix hints in CI when preliminary steps fail (check of license headers, api compatibility) by @​simonbasle in https://togithub.com/reactor/reactor-core/pull/2932' +
        '[guide] Remove ref to Swing/SwtScheduler in addons appendix by @​simonbasle in https://togithub.com/reactor/reactor-core/pull/2959' +
        '[build] Have jcstress part of slowerChecks by @​simonbasle in https://togithub.com/reactor/reactor-core/pull/2958' +
        '🆙 Dependency Upgrades' +
        'Update plugin spotless to v6.3.0 in https://togithub.com/reactor/reactor-core/pull/2925' +
        'Update plugin bnd to v6.2.0 in https://togithub.com/reactor/reactor-core/pull/2941' +
        'Update dependency org.awaitility:awaitility to v4.2.0 in https://togithub.com/reactor/reactor-core/pull/2945' +
        'Update dependency ch.qos.logback:logback-classic to v1.2.11 in https://togithub.com/reactor/reactor-core/pull/2946' +
        'Update dependency com.tngtech.archunit:archunit to v0.23.1 in https://togithub.com/reactor/reactor-core/pull/2940' +
        'Update plugin japicmp to v0.4.0 in https://togithub.com/reactor/reactor-core/pull/2948' +
        'Update dependency org.mockito:mockito-core to v4.4.0 in https://togithub.com/reactor/reactor-core/pull/2951' +
        'Update plugin download to v5.0.2 in https://togithub.com/reactor/reactor-core/pull/2950' +
        'New Contributors' +
        '@​Animesh27 made their first contribution in https://togithub.com/reactor/reactor-core/pull/2943 👍' +
        'Full Changelog: reactor/reactor-core@v3.4.15...v3.4.16';

      assert.deepStrictEqual(cleanedBody, messageWithoutGHLinks);
    });
  });
});
