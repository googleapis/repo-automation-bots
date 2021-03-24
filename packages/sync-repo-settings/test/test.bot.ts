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

import {describe, it, beforeEach, afterEach} from 'mocha';
import nock from 'nock';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import {promises as fs} from 'fs';
import {handler, configFileName} from '../src/bot';
import assert from 'assert';
import * as sinon from 'sinon';
import {logger} from 'gcf-utils';

nock.disableNetConnect();

const org = 'googleapis';
let probot: Probot;

function nockLanguagesList(org: string, repo: string, data: {}) {
  return nock('https://api.github.com')
    .get(`/repos/${org}/${repo}/languages`)
    .reply(200, data);
}

function nockUpdateTeamMembership(team: string, org: string, repo: string) {
  return nock('https://api.github.com')
    .put(`/orgs/${org}/teams/${team}/repos/${org}/${repo}`)
    .reply(200);
}

function nockConfig404(org = 'googleapis', repo = 'api-common-java') {
  return nock('https://api.github.com')
    .get(`/repos/${org}/${repo}/contents/.github%2F${configFileName}`)
    .reply(404)
    .get(`/repos/${org}/.github/contents/.github%2F${configFileName}`)
    .reply(404);
}

function nockUpdateRepoSettings(
  repo: string,
  rebaseBoolean: boolean,
  squashBoolean: boolean
) {
  return nock('https://api.github.com')
    .patch(`/repos/googleapis/${repo}`, {
      name: `${repo}`,
      allow_merge_commit: false,
      allow_rebase_merge: rebaseBoolean,
      allow_squash_merge: squashBoolean,
      delete_branch_on_merge: true,
    })
    .reply(200);
}

function nockUpdateBranchProtection(
  repo: string,
  contexts: string[],
  requireUpToDateBranch: boolean,
  requireCodeOwners: boolean
) {
  return nock('https://api.github.com')
    .put(`/repos/googleapis/${repo}/branches/master/protection`, {
      required_pull_request_reviews: {
        required_approving_review_count: 1,
        dismiss_stale_reviews: false,
        require_code_owner_reviews: requireCodeOwners,
      },
      required_status_checks: {
        contexts,
        strict: requireUpToDateBranch,
      },
      enforce_admins: true,
      restrictions: null,
    })
    .reply(200);
}

async function receive(org: string, repo: string, cronOrg?: string) {
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
      cron_org: cronOrg || org,
    },
    id: 'abc123',
  });
}

const sandbox = sinon.createSandbox();

describe('Sync repo settings', () => {
  beforeEach(() => {
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
    sandbox.stub(logger, 'error').throwsArg(0);
    sandbox.stub(logger, 'info');
    sandbox.stub(logger, 'debug');
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  it('should ignore repos in ignored repos in required-checks.json', async () => {
    const repo = 'gax-ruby';
    const scopes = [
      nockConfig404(org, repo),
      nockLanguagesList(org, repo, {ruby: 1}),
      nockUpdateTeamMembership('yoshi-admins', org, repo),
      nockUpdateTeamMembership('yoshi-ruby-admins', org, repo),
      nockUpdateTeamMembership('yoshi-ruby', org, repo),
      nockUpdateTeamMembership('cloud-dpe', org, repo),
      nockUpdateTeamMembership('cloud-devrel-pgm', org, repo),
    ];
    await receive(org, repo);
    scopes.forEach(x => x.done());
  });

  it('should skip for the wrong context', async () => {
    await receive('googleapis', 'api-common-java', 'GoogleCloudPlatform');
  });

  it('should ignore repos not represented in required-checks.json', async () => {
    const org = 'Codertocat';
    const repo = 'Hello-World';
    const scopes = [
      nockConfig404(org, repo),
      nockLanguagesList(org, repo, {kotlin: 1}),
      nockUpdateTeamMembership('cloud-dpe', org, repo),
      nockUpdateTeamMembership('cloud-devrel-pgm', org, repo),
    ];
    await receive(org, repo);
    scopes.forEach(s => s.done());
  });

  it('should override master branch protection if the repo is overridden', async () => {
    const repo = 'python-bigtable';
    const scopes = [
      nockConfig404(org, repo),
      nockLanguagesList(org, repo, {python: 1}),
      nockUpdateRepoSettings(repo, true, true),
      nockUpdateBranchProtection(repo, ['Kokoro', 'cla/google'], false, false),
      nockUpdateTeamMembership('yoshi-admins', org, repo),
      nockUpdateTeamMembership('yoshi-python-admins', org, repo),
      nockUpdateTeamMembership('yoshi-python', org, repo),
      nockUpdateTeamMembership('python-samples-owners', org, repo),
      nockUpdateTeamMembership('cloud-dpe', org, repo),
      nockUpdateTeamMembership('cloud-devrel-pgm', org, repo),
    ];
    await receive(org, repo);
    scopes.forEach(s => s.done());
  });

  it('should update settings for a known repository', async () => {
    const repo = 'nodejs-dialogflow';
    const scopes = [
      nockConfig404(org, repo),
      nockLanguagesList(org, repo, {
        groovy: 33,
        typescript: 100,
        kotlin: 2,
      }),
      nockUpdateRepoSettings(repo, true, true),
      nockUpdateBranchProtection(
        repo,
        [
          'ci/kokoro: Samples test',
          'ci/kokoro: System test',
          'docs',
          'lint',
          'test (10)',
          'test (12)',
          'test (14)',
          'test (15)',
          'cla/google',
          'windows',
        ],
        true,
        true
      ),
      nockUpdateTeamMembership('yoshi-admins', org, repo),
      nockUpdateTeamMembership('yoshi-nodejs-admins', org, repo),
      nockUpdateTeamMembership('yoshi-nodejs', org, repo),
      nockUpdateTeamMembership('cloud-dpe', org, repo),
      nockUpdateTeamMembership('cloud-devrel-pgm', org, repo),
    ];
    await receive(org, repo);
    scopes.forEach(s => s.done());
  });

  it('should nope out if github returns no languages', async () => {
    const scopes = [
      nockConfig404('Codertocat', 'Hello-World'),
      nockLanguagesList('Codertocat', 'Hello-World', {}),
    ];
    await receive('Codertocat', 'Hello-World');
    scopes.forEach(x => x.done());
  });

  it('should use localized config if available', async () => {
    const org = 'googleapis';
    const repo = 'fake';
    const content = await fs.readFile('./test/fixtures/localConfig.yaml');
    const scopes = [
      nock('https://api.github.com')
        .get(`/repos/${org}/${repo}/contents/.github%2F${configFileName}`)
        .reply(200, content),
      nockUpdateRepoSettings(repo, false, true),
      nockUpdateBranchProtection(repo, ['check1', 'check2'], false, true),
      nockUpdateTeamMembership('team1', org, repo),
      nockUpdateTeamMembership('cloud-dpe', org, repo),
      nockUpdateTeamMembership('cloud-devrel-pgm', org, repo),
    ];
    await receive(org, repo);
    scopes.forEach(x => x.done());
  });

  it('should use localized config and skip branch protection', async () => {
    const org = 'googleapis';
    const repo = 'fake';
    const content = await fs.readFile(
      './test/fixtures/localConfigWithoutBranchProtection.yaml'
    );
    const scopes = [
      nock('https://api.github.com')
        .get(`/repos/${org}/${repo}/contents/.github%2F${configFileName}`)
        .reply(200, content),
      nockUpdateRepoSettings(repo, false, true),
      nockUpdateTeamMembership('team1', org, repo),
      nockUpdateTeamMembership('cloud-dpe', org, repo),
      nockUpdateTeamMembership('cloud-devrel-pgm', org, repo),
    ];
    await receive(org, repo);
    scopes.forEach(x => x.done());
  });

  it('should detect a valid schema', async () => {
    const org = 'googleapis';
    const repo = 'fake';
    const fileSha = 'bbcd538c8e72b8c175046e27cc8f907076331401';
    const headSha = 'abc123';
    const content = await fs.readFile(
      './test/fixtures/localConfig.yaml',
      'base64'
    );
    const scopes = [
      nock('https://api.github.com')
        .get(`/repos/${org}/${repo}/pulls/1/files?per_page=100`)
        .reply(200, [
          {
            sha: fileSha,
            filename: `.github/${configFileName}`,
            status: 'added',
          },
        ]),
      nock('https://api.github.com')
        .get(`/repos/${org}/${repo}/git/blobs/${fileSha}`)
        .reply(200, {content}),
      nock('https://api.github.com')
        .post(`/repos/${org}/${repo}/check-runs`, body => {
          assert.strictEqual(body.conclusion, 'success');
          return true;
        })
        .reply(200),
    ];
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'opened',
        repository: {
          name: repo,
          owner: {
            login: org,
          },
        },
        organization: {
          login: org,
        },
        number: 1,
        pull_request: {
          head: {
            sha: headSha,
          },
        },
      },
      id: 'abc123',
    });
    scopes.forEach(x => x.done());
  });

  it('should detect an invalid schema', async () => {
    const org = 'googleapis';
    const repo = 'fake';
    const fileSha = 'bbcd538c8e72b8c175046e27cc8f907076331401';
    const headSha = 'abc123';
    const content = await fs.readFile(
      './test/fixtures/bogusConfig.yaml',
      'base64'
    );
    const scopes = [
      nock('https://api.github.com')
        .get(`/repos/${org}/${repo}/pulls/1/files?per_page=100`)
        .reply(200, [
          {
            sha: fileSha,
            filename: `.github/${configFileName}`,
            status: 'added',
          },
        ]),
      nock('https://api.github.com')
        .get(`/repos/${org}/${repo}/git/blobs/${fileSha}`)
        .reply(200, {content}),
      nock('https://api.github.com')
        .post(`/repos/${org}/${repo}/check-runs`, body => {
          assert.strictEqual(body.conclusion, 'failure');

          return true;
        })
        .reply(200),
    ];
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'opened',
        repository: {
          name: repo,
          owner: {
            login: org,
          },
        },
        organization: {
          login: org,
        },
        number: 1,
        pull_request: {
          head: {
            sha: headSha,
          },
        },
      },
      id: 'abc123',
    });
    scopes.forEach(x => x.done());
  });

  it('should detect invalid yaml in the schema', async () => {
    const org = 'googleapis';
    const repo = 'fake';
    const fileSha = 'bbcd538c8e72b8c175046e27cc8f907076331401';
    const headSha = 'abc123';
    const content = await fs.readFile(
      './test/fixtures/invalidYamlConfig.yaml',
      'base64'
    );
    const scopes = [
      nock('https://api.github.com')
        .get(`/repos/${org}/${repo}/pulls/1/files?per_page=100`)
        .reply(200, [
          {
            sha: fileSha,
            filename: `.github/${configFileName}`,
            status: 'added',
          },
        ]),
      nock('https://api.github.com')
        .get(`/repos/${org}/${repo}/git/blobs/${fileSha}`)
        .reply(200, {content}),
      nock('https://api.github.com')
        .post(`/repos/${org}/${repo}/check-runs`, body => {
          assert.strictEqual(body.conclusion, 'failure');
          return true;
        })
        .reply(200),
    ];
    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'opened',
        repository: {
          name: repo,
          owner: {
            login: org,
          },
        },
        organization: {
          login: org,
        },
        number: 1,
        pull_request: {
          head: {
            sha: headSha,
          },
        },
      },
      id: 'abc123',
    });
    scopes.forEach(x => x.done());
  });

  it('should not sync settings for pushes with no changes to the config', async () => {
    const org = 'Codertocat';
    const repo = 'Hello-World';
    await probot.receive({
      name: 'push',
      payload: {
        ref: 'refs/head/main',
        repository: {
          name: repo,
          owner: {
            login: org,
          },
          default_branch: 'main',
        },
        organization: {
          login: org,
        },
        commits: [],
      },
      id: 'abc123',
    });
  });

  it('should not sync settings for pushes to non-default branches', async () => {
    const org = 'Codertocat';
    const repo = 'Hello-World';
    await probot.receive({
      name: 'push',
      payload: {
        ref: 'refs/head/not-default-lol',
        repository: {
          name: repo,
          owner: {
            login: org,
          },
          default_branch: 'main',
        },
        organization: {
          login: org,
        },
        commits: [],
      },
      id: 'abc123',
    });
  });

  it('should sync settings for pushes that modify the config', async () => {
    const org = 'Codertocat';
    const repo = 'Hello-World';
    const scopes = [
      nockConfig404(org, repo),
      nockLanguagesList(org, repo, {kotlin: 1}),
      nockUpdateTeamMembership('cloud-dpe', org, repo),
      nockUpdateTeamMembership('cloud-devrel-pgm', org, repo),
    ];
    await probot.receive({
      name: 'push',
      payload: {
        ref: 'refs/head/main',
        repository: {
          name: repo,
          owner: {
            login: org,
          },
          default_branch: 'main',
        },
        organization: {
          login: org,
        },
        commits: [
          {
            added: [`.github/${configFileName}`],
          },
        ],
      },
      id: 'abc123',
    });
    scopes.forEach(s => s.done());
  });
});
