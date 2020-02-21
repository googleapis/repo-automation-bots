/**
 * Copyright 2020 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

//import myProbotApp from '../src/merge-on-green';

import { resolve } from 'path';
import handler from '../src/merge-on-green';
import { Probot } from 'probot';
import nock from 'nock';
import * as fs from 'fs';

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

interface ReviewRequests {
  users: string[];
  teams: string[];
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
      payload: {},
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
      payload: {},
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
      payload: {},
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
      payload: {},
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
      getReviewsCompleted([{ user: { login: 'octocat' }, state: 'APPROVED' }]),
      getLatestCommit([{ sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e' }]),
      getMogLabel([{ name: 'automerge' }]),
      getStatusi('6dcb09b5b57875f334f61aebed695e2e4193db5e', []),
      requiredChecksByLanguage({ content: requiredChecks.toString('base64') }),
      repoMap({ content: map.toString('base64') }),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: {},
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
      payload: {},
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
      payload: {},
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
      payload: {},
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
      payload: {},
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
      payload: {},
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
      payload: {},
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
      mergeWithError(),
      updateBranch(),
    ];

    await probot.receive({
      name: 'schedule.repository',
      payload: {},
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });
});
