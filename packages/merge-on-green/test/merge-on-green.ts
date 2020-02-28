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

//import myProbotApp from '../src/merge-on-green';

import { resolve } from 'path';
import handler, { removePR } from '../src/merge-on-green';
import { Probot } from 'probot';
import nock from 'nock';
import * as fs from 'fs';
import {expect} from 'chai';
import { Datastore } from '@google-cloud/datastore';
import { mergeOnGreen } from '../src/merge-logic';

const path = require("path");

interface WatchPR {
  number: number;
  repo: string;
  owner: string;
  state: 'continue' | 'stop';
  url: string;
}

interface Label {
  name: string;
}

interface CheckStatus {
  context: string;
  state: string;
}
interface Reviews {
  user: {
    login: string;
  };
  state: string;
}

interface Content {
  content: string;
}

interface HeadSha {
  sha: string;
}

interface CheckRuns {
  check_runs: [{ name: string; conclusion: string }];
}

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/Fixtures');

const requiredChecks = fs.readFileSync(
  resolve(fixturesPath, 'config', 'required_checks.json')
);

const specialRequiredChecks = fs.readFileSync(
  resolve(fixturesPath, 'config', 'special_required_checks.json')
);

const nativeRequiredChecks = fs.readFileSync(
  resolve(fixturesPath, 'config', 'native_required_checks.json')
);

const map = fs.readFileSync(resolve(fixturesPath, 'config', 'map.json'));

const invalidmap = fs.readFileSync(
  resolve(fixturesPath, 'config', 'invalidmap.json')
);

function requiredChecksByLanguage(response: Content) {
  return nock('https://api.github.com')
    .get('/repos/googleapis/sloth/contents/required-checks.json')
    .reply(200, response);
}

function repoMap(response: Content) {
  return nock('https://api.github.com')
    .get('/repos/googleapis/sloth/contents/repos.json')
    .reply(200, response);
}

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
    .get(`/repos/testOwner/testRepo/commits/${ref}/statuses?per_page=100`)
    .reply(200, response);
}

function getRuns(ref: string, response: CheckRuns) {
  return nock('https://api.github.com')
    .get(`/repos/testOwner/testRepo/commits/${ref}/check-runs?per_page=100`)
    .reply(200, response);
}

function getMogLabel(response: Label[]) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/issues/1/labels')
    .reply(200, response);
}

function merge() {
  return nock('https://api.github.com')
    .put('/repos/testOwner/testRepo/pulls/1/merge')
    .reply(200);
}

async function awaitMerge() {
  return Promise.resolve(nock('https://api.github.com')
    .put('/repos/testOwner/testRepo/pulls/1/merge')
    .reply(200));
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

function getIfMerged(response: number) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/pulls/1/merge')
    .reply(response);
}

function getBranchProtection() {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/branches/master/protection')
    .reply(200, {
      required_status_checks: {
        contexts: ['Special Check'],
      },
    });
}

function getPR(mergeable: boolean, mergeableState: string) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/pulls/1')
    .reply(200, {
      mergeable,
      mergeable_state: mergeableState,
    });
}

describe('merge-on-green', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      Octokit: require('@octokit/rest'),
    });

    probot.app = {
      getSignedJsonWebToken() {
        return 'abc123';
      },
      getInstallationAccessToken(): Promise<string> {
        return Promise.resolve('abc123');
      },
    };
    probot.load(handler);
  });

  describe('merge-logic', () => {
  it('merges a PR on green', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          url: 'github.com/foo/bar',
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    const scopes = [
      getIfMerged(404),
      getReviewsCompleted([{ user: { login: 'octocat' }, state: 'APPROVED' }]),
      getLatestCommit([{ sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' }]),
      getMogLabel([{ name: 'automerge' }]),
      getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
        { state: 'success', context: 'Kokoro - Test: Binary Compatibility' },
      ]),
      requiredChecksByLanguage({ content: requiredChecks.toString('base64') }),
      repoMap({ content: map.toString('base64') }),
      merge(),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: { org: 'testOwner' },
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });

  it('fails when a review has not been approved', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          url: 'github.com/foo/bar',
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    const scopes = [
      getIfMerged(404),
      getReviewsCompleted([
        { user: { login: 'octocat' }, state: 'APPROVED' },
        { user: { login: 'octokitten' }, state: 'CHANGES_REQUESTED' },
      ]),
      getLatestCommit([{ sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' }]),
      getMogLabel([{ name: 'automerge' }]),
      getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
        { state: 'success', context: 'Kokoro - Test: Binary Compatibility' },
      ]),
      requiredChecksByLanguage({ content: requiredChecks.toString('base64') }),
      repoMap({ content: map.toString('base64') }),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: { org: 'testOwner' },
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });

  it('fails if there is no commit', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          url: 'github.com/foo/bar',
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    const scopes = [
      getIfMerged(404),
      getReviewsCompleted([{ user: { login: 'octocat' }, state: 'APPROVED' }]),
      getLatestCommit([]),
      getMogLabel([{ name: 'automerge' }]),
      getStatusi('', [
        { state: 'success', context: 'Kokoro - Test: Binary Compatibility' },
      ]),
      requiredChecksByLanguage({ content: requiredChecks.toString('base64') }),
      repoMap({ content: map.toString('base64') }),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: { org: 'testOwner' },
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });

  it('fails if there is no MOG label', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          url: 'github.com/foo/bar',
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    const scopes = [
      getIfMerged(404),
      getReviewsCompleted([{ user: { login: 'octocat' }, state: 'APPROVED' }]),
      getLatestCommit([{ sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' }]),
      getMogLabel([{ name: 'this is not the label you are looking for' }]),
      getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
        { state: 'success', context: 'Kokoro - Test: Binary Compatibility' },
      ]),
      requiredChecksByLanguage({ content: requiredChecks.toString('base64') }),
      repoMap({ content: map.toString('base64') }),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: { org: 'testOwner' },
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });

  it('fails if there are no status checks', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          url: 'github.com/foo/bar',
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    const scopes = [
      getIfMerged(404),
      getReviewsCompleted([{ user: { login: 'octocat' }, state: 'APPROVED' }]),
      getLatestCommit([{ sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' }]),
      getMogLabel([{ name: 'automerge' }]),
      getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
      requiredChecksByLanguage({ content: requiredChecks.toString('base64') }),
      repoMap({ content: map.toString('base64') }),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: { org: 'testOwner' },
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });

  it('fails if the status checks have failed', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          url: 'github.com/foo/bar',
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    const scopes = [
      getIfMerged(404),
      getReviewsCompleted([{ user: { login: 'octocat' }, state: 'APPROVED' }]),
      getLatestCommit([{ sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' }]),
      getMogLabel([{ name: 'automerge' }]),
      getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
        { state: 'failure', context: 'Kokoro - Test: Binary Compatibility' },
      ]),
      requiredChecksByLanguage({ content: requiredChecks.toString('base64') }),
      repoMap({ content: map.toString('base64') }),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: { org: 'testOwner' },
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });

  it('submits a comment on the PR if the flag is set to stop and the merge has failed', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'stop',
          url: 'github.com/foo/bar',
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    const scopes = [
      getIfMerged(404),
      getReviewsCompleted([{ user: { login: 'octocat' }, state: 'APPROVED' }]),
      getLatestCommit([{ sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' }]),
      getMogLabel([{ name: 'this is not the label you are looking for' }]),
      getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
        { state: 'failure', context: 'Kokoro - Test: Binary Compatibility' },
      ]),
      requiredChecksByLanguage({ content: requiredChecks.toString('base64') }),
      repoMap({ content: map.toString('base64') }),
      commentOnPR(),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: { org: 'testOwner' },
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });

  it('fails when it cannot find a match in repos.json', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          url: 'github.com/foo/bar',
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    const scopes = [
      getIfMerged(404),
      getReviewsCompleted([{ user: { login: 'octocat' }, state: 'APPROVED' }]),
      getLatestCommit([{ sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' }]),
      getMogLabel([{ name: 'automerge' }]),
      getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', [
        { state: 'success', context: 'Kokoro - Test: Binary Compatibility' },
      ]),
      requiredChecksByLanguage({ content: requiredChecks.toString('base64') }),
      repoMap({ content: invalidmap.toString('base64') }),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: { org: 'testOwner' },
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });

  it('passes if checks are actually check runs', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          url: 'github.com/foo/bar',
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    const scopes = [
      getIfMerged(404),
      getReviewsCompleted([{ user: { login: 'octocat' }, state: 'APPROVED' }]),
      getLatestCommit([{ sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' }]),
      getMogLabel([{ name: 'automerge' }]),
      getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
      getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
        check_runs: [
          {
            name: 'Kokoro - Test: Binary Compatibility',
            conclusion: 'success',
          },
        ],
      }),
      requiredChecksByLanguage({ content: requiredChecks.toString('base64') }),
      repoMap({ content: map.toString('base64') }),
      merge(),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: { org: 'testOwner' },
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });

  it('fails if no one has reviewed the PR', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          url: 'github.com/foo/bar',
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    const scopes = [
      getIfMerged(404),
      getReviewsCompleted([]),
      getLatestCommit([{ sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' }]),
      getMogLabel([{ name: 'automerge' }]),
      getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
      getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
        check_runs: [
          {
            name: 'Kokoro - Test: Binary Compatibility',
            conclusion: 'success',
          },
        ],
      }),
      requiredChecksByLanguage({ content: requiredChecks.toString('base64') }),
      repoMap({ content: map.toString('base64') }),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: { org: 'testOwner' },
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });

  it('passes when special checks are passed', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          url: 'github.com/foo/bar',
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    const scopes = [
      getIfMerged(404),
      getReviewsCompleted([{ user: { login: 'octocat' }, state: 'APPROVED' }]),
      getLatestCommit([{ sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' }]),
      getMogLabel([{ name: 'automerge' }]),
      getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
      requiredChecksByLanguage({
        content: specialRequiredChecks.toString('base64'),
      }),
      getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
        check_runs: [
          {
            name: 'Special Check',
            conclusion: 'success',
          },
        ],
      }),
      repoMap({ content: map.toString('base64') }),
      merge(),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: { org: 'testOwner' },
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });

  it('updates a branch if merge returns error', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          url: 'github.com/foo/bar',
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    const scopes = [
      getIfMerged(404),
      getReviewsCompleted([{ user: { login: 'octocat' }, state: 'APPROVED' }]),
      getLatestCommit([{ sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' }]),
      getMogLabel([{ name: 'automerge' }]),
      getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
      requiredChecksByLanguage({
        content: specialRequiredChecks.toString('base64'),
      }),
      getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
        check_runs: [
          {
            name: 'Special Check',
            conclusion: 'success',
          },
        ],
      }),
      repoMap({ content: map.toString('base64') }),
      getPR(false, 'behind'),
      mergeWithError(),
      updateBranch(),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: { org: 'testOwner' },
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });

  it('comments on PR if branch is dirty', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          url: 'github.com/foo/bar',
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    const scopes = [
      getIfMerged(404),
      getReviewsCompleted([{ user: { login: 'octocat' }, state: 'APPROVED' }]),
      getLatestCommit([{ sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' }]),
      getMogLabel([{ name: 'automerge' }]),
      getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
      requiredChecksByLanguage({
        content: specialRequiredChecks.toString('base64'),
      }),
      getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
        check_runs: [
          {
            name: 'Special Check',
            conclusion: 'success',
          },
        ],
      }),
      repoMap({ content: map.toString('base64') }),
      getPR(false, 'dirty'),
      mergeWithError(),
      commentOnPR(),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: { org: 'testOwner' },
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });

  it('fails if PR was merged', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          url: 'github.com/foo/bar',
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    const scopes = [getIfMerged(204)];

    await probot.receive({
      name: 'schedule.repository',
      payload: { org: 'testOwner' },
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });

  it('passes when native branch protection is called', async () => {
    handler.listPRs = async () => {
      const watchPr: WatchPR[] = [
        {
          number: 1,
          repo: 'testRepo',
          owner: 'testOwner',
          state: 'continue',
          url: 'github.com/foo/bar',
        },
      ];
      return watchPr;
    };

    handler.removePR = async () => {
      return Promise.resolve(undefined);
    };

    const scopes = [
      getIfMerged(404),
      getReviewsCompleted([{ user: { login: 'octocat' }, state: 'APPROVED' }]),
      getLatestCommit([{ sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' }]),
      getMogLabel([{ name: 'automerge' }]),
      getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
      requiredChecksByLanguage({
        content: nativeRequiredChecks.toString('base64'),
      }),
      getBranchProtection(),
      getRuns('6dcb09b5b57875f334f61aebed695e2e4193db5e', {
        check_runs: [
          {
            name: 'Special Check',
            conclusion: 'success',
          },
        ],
      }),
      repoMap({ content: map.toString('base64') }),
      merge(),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: { org: 'testOwner' },
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });
  })

  describe('merge-on-green', () => {
    it('lists Datastore entries into an array of PRs', async () => {
      handler.getDatastore = async() => {
        return [[{repo: 'testRepo', number: 1, owner: 'testOwner', created: Date.now()}]]
      }
      let result = await handler.listPRs();
      console.log(result);
      let expectation = {number: 1, repo: "testRepo", owner: 'testOwner', state: 'continue', url: 'github.com/foo/bar'}
      expect(result[0]).to.include(expectation);

    })

    it('removes a PR when merged', async () => {

      handler.listPRs = async () => {
        const watchPr: WatchPR[] = [
          {
            number: 1,
            repo: 'testRepo',
            owner: 'testOwner',
            state: 'continue',
            url: 'github.com/foo/bar',
          },
        ];
        return watchPr;
      };

      handler.removePR = async () => {
        return undefined;
      };

      mergeOnGreen.checkReviews = async () => {
        return true;
      }

      mergeOnGreen.statusesForRef = async () => {
        return true;
      }

      mergeOnGreen.merge = async() => {
        return {sha: "123", merged: true, message: "in a bottle"}
      }

      mergeOnGreen.checkPRMerged = async() => {
        return false;
      }
  
      expect(await handler.removePR('string')).to.be.an('undefined');

      await probot.receive({
        name: 'schedule.repository',
        payload: { org: 'testOwner' },
        id: 'abc123',
      });
  
    });

    it('adds a PR when label is added correctly', async () => {
      handler.listPRs = async () => {
        const watchPr: WatchPR[] = [
          {
            number: 1,
            repo: 'testRepo',
            owner: 'testOwner',
            state: 'continue',
            url: 'github.com/foo/bar',
          },
        ];
        return watchPr;
      };

      handler.removePR = async () => {
        return undefined;
      };

      handler.addPR = async() => {
        return undefined;
      }

      mergeOnGreen.checkReviews = async () => {
        return true;
      }

      mergeOnGreen.statusesForRef = async () => {
        return true;
      }

      mergeOnGreen.merge = async() => {
        return {sha: "123", merged: true, message: "in a bottle"}
      }

      mergeOnGreen.checkPRMerged = async() => {
        return false;
      }
  
      expect(await handler.addPR({
        number: 1,
        repo: 'testRepo',
        owner: 'testOwner',
        state: 'continue',
        url: 'github.com/foo/bar',
      }, "string")).to.be.an('undefined');

      await probot.receive({
        name: 'issue.labeled',
        payload: require(path.resolve(fixturesPath, './events/pull_request_labeled.json')),
        id: 'abc123',
      });
  
    });


  })


})

