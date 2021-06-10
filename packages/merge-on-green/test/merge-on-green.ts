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
import {resolve} from 'path';
import nock from 'nock';
import sinon, {SinonStub} from 'sinon';
import {describe, it, beforeEach, afterEach, suite} from 'mocha';
import handler from '../src/merge-on-green';
import {logger} from 'gcf-utils';
import assert from 'assert';
// eslint-disable-next-line node/no-extraneous-import
import {config} from '@probot/octokit-plugin-config';

const TestingOctokit = ProbotOctokit.plugin(config).defaults({
  retry: {enabled: false},
  throttle: {enabled: false},
});

const testingOctokitInstance = new TestingOctokit({auth: 'abc123'});
const sandbox = sinon.createSandbox();

interface PR {
  number: number;
  owner: string;
  repo: string;
  state: string;
  html_url: string;
  repository_url: string;
  user: {
    login: string;
  };
}

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/Fixtures');

function getBranchProtection(
  branch: string,
  status: number,
  requiredStatusChecks: string[]
) {
  return nock('https://api.github.com')
    .get(`/repos/testOwner/testRepo/branches/${branch}/protection`)
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

function searchForPRs(pr: PR[], labelName: string) {
  return nock('https://api.github.com')
    .get(
      `/search/issues?q=is%3Aopen%20is%3Apr%20user%3Agoogleapis%20label%3A%22${labelName}%22`
    )
    .reply(200, pr);
}

function removeMogLabel(label: string) {
  return nock('https://api.github.com')
    .delete(`/repos/testOwner/testRepo/issues/1/labels/${label}`)
    .reply(200);
}

function commentOnPR() {
  return nock('https://api.github.com')
    .post('/repos/testOwner/testRepo/issues/1/comments')
    .reply(200);
}

function removeReaction() {
  return nock('https://api.github.com')
    .delete('/repos/testOwner/testRepo/issues/1/reactions/1')
    .reply(204);
}
// general structure of tests: this file tests the merge-on-green logic,
// which wraps the merge logic itself. I have attempted to divide up the
// tests based on what its testing, but also based on sandbox scopes for
// mocking the different GCP functions. You'll see suite blocks for the
// different stubs for GCP functions, and describe blocks to describe the
// functionality of what it's actually testing
describe('merge-on-green wrapper logic', () => {
  let probot: Probot;
  let loggerStub: SinonStub;

  before(() => {
    loggerStub = sandbox.stub(logger, 'error').throwsArg(0);
  });

  after(() => {
    loggerStub.restore();
  });

  beforeEach(() => {
    probot = createProbot({
      overrides: {
        githubToken: 'abc123',
        Octokit: TestingOctokit,
      },
    });

    probot.load(handler);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('adding-a-PR-to-Datastore (addPR) method', async () => {
    let removePRStub: SinonStub;
    let getPRStub: SinonStub;

    beforeEach(() => {
      removePRStub = sandbox.stub(handler, 'removePR');
      getPRStub = sandbox.stub(handler, 'getPR');
    });

    afterEach(() => {
      removePRStub.restore();
      getPRStub.restore();
    });
    it('does not add a PR if no branch protection', async () => {
      loggerStub.restore();

      const scopes = [
        // we're purposefully calling an error here
        getBranchProtection('main', 400, []),
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

    it('adds a PR if branch protection when PR labeled', async () => {
      const addPRStub = sandbox.stub(handler, 'addPR').callsFake(async () => {
        await handler.checkForBranchProtection(
          'testOwner',
          'testRepo',
          1,
          'main',
          testingOctokitInstance
        );
      });
      const scopes = [getBranchProtection('main', 200, ['Special Check'])];
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
      addPRStub.restore();
    });

    //This function is supposed to respond with an error
    it('does not add a PR if branch protection errors and comments on PR when PR labeled', async () => {
      loggerStub.restore();

      const scopes = [getBranchProtection('main', 400, []), commentOnPR()];
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
  suite('stubbing all GCP functions', () => {
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
    describe('cleaning up PRs', () => {
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
    describe('picking up PRs', () => {
      it('does not add a PR if no labels were found under automerge or automerge exact', async () => {
        const scopes = [
          searchForPRs([], 'automerge'),
          searchForPRs([], 'automerge%3A%20exact'),
        ];

        await probot.receive({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          name: 'schedule.repository' as any,
          payload: {org: 'googleapis', find_hanging_prs: true},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
        assert(!addPRStub.called);
      });
    });

    describe('PRs when labeled', () => {
      handler.allowlist = ['testOwner'];
      it('adds a PR when label is added correctly', async () => {
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

        assert(addPRStub.called);
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
    });
  });

  suite(
    'PRs when closed, merged or unlabeled, testing getPR method (no stub)',
    () => {
      let addPRStub: SinonStub;
      let removePRStub: SinonStub;

      beforeEach(() => {
        addPRStub = sandbox.stub(handler, 'addPR');
        removePRStub = sandbox.stub(handler, 'removePR');
      });

      afterEach(() => {
        addPRStub.restore();
        removePRStub.restore();
      });
      it('deletes a PR from datastore if it was closed', async () => {
        const getPRStub = sandbox.stub(handler, 'getPR').resolves({
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
        const getPRStub = sandbox.stub(handler, 'getPR').resolves({
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
        getPRStub.restore();
      });

      it('does not delete a PR if PR merged is not in the table', async () => {
        const getPRStub = sandbox.stub(handler, 'getPR').resolves(undefined);

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
        getPRStub.restore();
      });

      it('adds a PR if the PR was not picked up by a webhook event w automerge label', async () => {
        const getPRStub = sandbox.stub(handler, 'getPR').resolves();
        const scopes = [
          searchForPRs(
            [
              {
                number: 1,
                owner: 'testOwner',
                repo: 'testRepo',
                state: 'continue',
                repository_url:
                  'https://api.github.com/repos/testOwner/testRepo',
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
          payload: {org: 'googleapis', find_hanging_prs: true},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
        assert(getPRStub.called);
        assert(addPRStub.called);
        getPRStub.restore();
      });

      it('adds a PR if the PR was not picked up by a webhook event w automerge: exact label', async () => {
        const getPRStub = sandbox.stub(handler, 'getPR').resolves();
        const scopes = [
          searchForPRs([], 'automerge'),
          searchForPRs(
            [
              {
                number: 1,
                owner: 'testOwner',
                repo: 'testRepo',
                state: 'continue',
                repository_url:
                  'https://api.github.com/repos/testOwner/testRepo',
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
          payload: {org: 'googleapis', find_hanging_prs: true},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
        assert(getPRStub.called);
        assert(addPRStub.called);
        getPRStub.restore();
      });

      it('does not add a PR if label is in Datastore already', async () => {
        const getPRStub = sandbox.stub(handler, 'getPR').resolves({
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
                repository_url:
                  'https://api.github.com/repos/testOwner/testRepo',
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
          payload: {org: 'googleapis', find_hanging_prs: true},
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
        assert(getPRStub.called);
        assert(!addPRStub.called);
        getPRStub.restore();
      });
    }
  );
});
