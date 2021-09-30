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
import {resolve} from 'path';
import nock from 'nock';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import {PullRequestOpenedEvent} from '@octokit/webhooks-types';
import {promises as fs} from 'fs';
import yaml from 'js-yaml';
import * as botConfigModule from '@google-automations/bot-config-utils';
import assert from 'assert';
import * as sinon from 'sinon';
import {logger} from 'gcf-utils';

import {handler} from '../src/bot';
import {CONFIG_FILE_NAME} from '../src/config';

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
    .put(`/repos/googleapis/${repo}/branches/main/protection`, {
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
      required_linear_history: true,
      restrictions: null,
    })
    .reply(200);
}

function nockDefaultBranch(repo: string, branch: string) {
  return nock('https://api.github.com')
    .get(`/repos/${repo}`)
    .reply(200, {default_branch: branch});
}

async function receive(org: string, repo: string, cronOrg?: string) {
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
      cron_org: cronOrg || org,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any,
    id: 'abc123',
  });
}

const fixturesPath = resolve(__dirname, '../../test/fixtures');

async function loadConfig(configFile: string) {
  return yaml.load(
    await fs.readFile(resolve(fixturesPath, configFile), 'utf-8')
  );
}

const sandbox = sinon.createSandbox();

describe('Sync repo settings', () => {
  let getConfigStub: sinon.SinonStub;
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
    getConfigStub = sandbox.stub(botConfigModule, 'getConfig');
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  it('should skip for the wrong context', async () => {
    await receive('googleapis', 'api-common-java', 'GoogleCloudPlatform');
  });

  it('should ignore repos not represented in required-checks.json', async () => {
    const org = 'Codertocat';
    const repo = 'Hello-World';
    getConfigStub.resolves(null);
    const scopes = [
      nockLanguagesList(org, repo, {kotlin: 1}),
      nockUpdateTeamMembership('cloud-dpe', org, repo),
      nockUpdateTeamMembership('cloud-devrel-pgm', org, repo),
      nockDefaultBranch('Codertocat/Hello-World', 'main'),
    ];
    await receive(org, repo);
    scopes.forEach(s => s.done());
  });

  it('should update settings for a known repository', async () => {
    const repo = 'nodejs-dialogflow';
    getConfigStub.resolves(null);
    const scopes = [
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
          'OwlBot Post Processor',
        ],
        true,
        true
      ),
      nockUpdateTeamMembership('yoshi-admins', org, repo),
      nockUpdateTeamMembership('yoshi-nodejs-admins', org, repo),
      nockUpdateTeamMembership('yoshi-nodejs', org, repo),
      nockUpdateTeamMembership('cloud-dpe', org, repo),
      nockUpdateTeamMembership('cloud-devrel-pgm', org, repo),
      nockDefaultBranch('googleapis/nodejs-dialogflow', 'main'),
    ];
    await receive(org, repo);
    scopes.forEach(s => s.done());
  });

  it('should nope out if github returns no languages', async () => {
    getConfigStub.resolves(null);
    const scopes = [nockLanguagesList('Codertocat', 'Hello-World', {})];
    await receive('Codertocat', 'Hello-World');
    scopes.forEach(x => x.done());
  });

  it('should use localized config if available', async () => {
    const org = 'googleapis';
    const repo = 'fake';
    getConfigStub.resolves(await loadConfig('localConfig.yaml'));
    const scopes = [
      nockUpdateRepoSettings(repo, false, true),
      nockUpdateBranchProtection(repo, ['check1', 'check2'], false, true),
      nockUpdateTeamMembership('team1', org, repo),
      nockUpdateTeamMembership('cloud-dpe', org, repo),
      nockUpdateTeamMembership('cloud-devrel-pgm', org, repo),
      nockDefaultBranch('googleapis/fake', 'main'),
    ];
    await receive(org, repo);
    scopes.forEach(x => x.done());
  });

  it('should use localized config and skip branch protection', async () => {
    const org = 'googleapis';
    const repo = 'fake';
    getConfigStub.resolves(
      await loadConfig('localConfigWithoutBranchProtection.yaml')
    );
    const scopes = [
      nockUpdateRepoSettings(repo, false, true),
      nockUpdateTeamMembership('team1', org, repo),
      nockUpdateTeamMembership('cloud-dpe', org, repo),
      nockUpdateTeamMembership('cloud-devrel-pgm', org, repo),
      nockDefaultBranch('googleapis/fake', 'main'),
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
            filename: `.github/${CONFIG_FILE_NAME}`,
            status: 'added',
          },
        ]),
      nock('https://api.github.com')
        .get(`/repos/${org}/${repo}/git/blobs/${fileSha}`)
        .reply(200, {content}),
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
        pull_request: {
          number: 1,
          head: {
            sha: headSha,
          },
        },
      } as PullRequestOpenedEvent,
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
            filename: `.github/${CONFIG_FILE_NAME}`,
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
        pull_request: {
          number: 1,
          head: {
            sha: headSha,
          },
        },
      } as PullRequestOpenedEvent,
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
            filename: `.github/${CONFIG_FILE_NAME}`,
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
        pull_request: {
          number: 1,
          head: {
            sha: headSha,
          },
        },
      } as PullRequestOpenedEvent,
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
        ref: 'refs/heads/main',
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
  });

  it('should not sync settings for pushes to non-default branches', async () => {
    const org = 'Codertocat';
    const repo = 'Hello-World';
    await probot.receive({
      name: 'push',
      payload: {
        ref: 'refs/heads/not-default-lol',
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
  });

  it('should sync settings for pushes that modify the config', async () => {
    const org = 'Codertocat';
    const repo = 'Hello-World';
    getConfigStub.resolves(null);
    const scopes = [
      nockLanguagesList(org, repo, {kotlin: 1}),
      nockUpdateTeamMembership('cloud-dpe', org, repo),
      nockUpdateTeamMembership('cloud-devrel-pgm', org, repo),
      nockDefaultBranch('Codertocat/Hello-World', 'main'),
    ];
    await probot.receive({
      name: 'push',
      payload: {
        ref: 'refs/heads/main',
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
            added: [`.github/${CONFIG_FILE_NAME}`],
          },
        ],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    scopes.forEach(s => s.done());
  });

  it('should sync settings for a newly transferred repo', async () => {
    const org = 'Codertocat';
    const repo = 'Hello-World';
    getConfigStub.resolves(null);
    const scopes = [
      nockLanguagesList(org, repo, {kotlin: 1}),
      nockUpdateTeamMembership('cloud-dpe', org, repo),
      nockUpdateTeamMembership('cloud-devrel-pgm', org, repo),
      nockDefaultBranch('Codertocat/Hello-World', 'main'),
    ];
    const payload = require(resolve(fixturesPath, 'repository_transferred'));
    await probot.receive({
      name: 'repository',
      payload,
      id: 'abc123',
    });
    scopes.forEach(s => s.done());
  });
});
