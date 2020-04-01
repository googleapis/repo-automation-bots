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

import handler from '../src/sync-repo-settings';
import nock from 'nock';
import { Probot } from 'probot';

nock.disableNetConnect();
const repos = require('../../test/fixtures/repos.json');

function nockRepoList() {
  return nock('https://raw.githubusercontent.com')
    .get('/googleapis/sloth/master/repos.json')
    .reply(200, repos);
}

function nockUpdateTeamMembership(team: string, org: string, repo: string) {
  return nock('https://api.github.com')
    .put(`/orgs/${org}/teams/${team}/repos/${org}/${repo}`)
    .reply(200);
}

function nockUpdateRepoSettings() {
  return nock('https://api.github.com')
    .patch(`/repos/googleapis/nodejs-dialogflow`, {
      name: 'nodejs-dialogflow',
      allow_merge_commit: false,
      allow_rebase_merge: true,
      allow_squash_merge: true,
    })
    .reply(200);
}

function nockUpdateBranchProtection() {
  return nock('https://api.github.com')
    .put('/repos/googleapis/nodejs-dialogflow/branches/master/protection', {
      required_pull_request_reviews: {
        dismiss_stale_reviews: false,
        require_code_owner_reviews: false,
      },
      required_status_checks: {
        contexts: [
          'ci/kokoro: Samples test',
          'ci/kokoro: System test',
          'docs',
          'lint',
          'test (10)',
          'test (12)',
          'test (13)',
          'cla/google',
          'windows',
        ],
        strict: true,
      },
      enforce_admins: true,
      restrictions: null,
    })
    .reply(200);
}

describe('Sync repo settings', () => {
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

  it('should ignore repos not in repos.json', async () => {
    const scopes = [nockRepoList()];
    await probot.receive({
      name: 'schedule.repository',
      payload: {
        repository: {
          name: 'fake',
        },
        organization: {
          login: 'news',
        },
      },
      id: 'abc123',
    });
    scopes.forEach(s => s.done());
  });

  it('should ignore repos not represented in required-checks.json', async () => {
    const scopes = [
      nockUpdateTeamMembership('yoshi-admins', 'Codertocat', 'Hello-World'),
      nockUpdateTeamMembership(
        'yoshi-kotlin-admins',
        'Codertocat',
        'Hello-World'
      ),
      nockUpdateTeamMembership('yoshi-kotlin', 'Codertocat', 'Hello-World'),
    ];
    await probot.receive({
      name: 'schedule.repository',
      payload: {
        repository: {
          name: 'Hello-World',
        },
        organization: {
          login: 'Codertocat',
        },
        cron_org: 'Codertocat'
      },
      id: 'abc123',
    });
    scopes.forEach(s => s.done());
  });

  it('should update settings for a known repository', async () => {
    const scopes = [
      nockUpdateRepoSettings(),
      nockUpdateBranchProtection(),
      nockUpdateTeamMembership(
        'yoshi-admins',
        'googleapis',
        'nodejs-dialogflow'
      ),
      nockUpdateTeamMembership(
        'yoshi-nodejs-admins',
        'googleapis',
        'nodejs-dialogflow'
      ),
      nockUpdateTeamMembership(
        'yoshi-nodejs',
        'googleapis',
        'nodejs-dialogflow'
      ),
    ];
    await probot.receive({
      name: 'schedule.repository',
      payload: {
        repository: {
          name: 'nodejs-dialogflow',
        },
        organization: {
          login: 'googleapis',
        },
        cron_org: 'googleapis'
      },
      id: 'abc123',
    });
    scopes.forEach(s => s.done());
  });
});
