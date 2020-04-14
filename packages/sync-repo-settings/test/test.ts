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

import {describe, it, beforeEach} from 'mocha';
import nock from 'nock';
// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
import handler from '../src/sync-repo-settings';

nock.disableNetConnect();
// eslint-disable-next-line @typescript-eslint/no-var-requires
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

function nockUpdateRepoSettings(
  repo: string,
  rebaseBoolean: boolean,
  squashBoolean: boolean
) {
  return nock('https://api.github.com')
    .log(console.log)
    .patch(`/repos/googleapis/${repo}`, {
      name: `${repo}`,
      allow_merge_commit: false,
      allow_rebase_merge: rebaseBoolean,
      allow_squash_merge: squashBoolean,
    })
    .reply(200);
}

function nockUpdateBranchProtection(
  repo: string,
  contexts: string[],
  requireUpToDateBranch: boolean
) {
  return nock('https://api.github.com')
    .put(`/repos/googleapis/${repo}/branches/master/protection`, {
      required_pull_request_reviews: {
        dismiss_stale_reviews: false,
        require_code_owner_reviews: false,
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

describe('Sync repo settings', () => {
  let probot: Probot;
  beforeEach(() => {
    probot = new Probot({
      // eslint-disable-next-line node/no-extraneous-require
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
        cron_org: 'news',
      },
      id: 'abc123',
    });
    scopes.forEach(s => s.done());
  });

  it('should ignore repos in ignored repos in required-checks.json', async () => {
    await probot.receive({
      name: 'schedule.repository',
      payload: {
        repository: {
          name: 'api-common-java',
        },
        organization: {
          login: 'googleapis',
        },
        cron_org: 'googleapis',
      },
      id: 'abc123',
    });
  });

  it('should skip for the wrong context', async () => {
    await probot.receive({
      name: 'schedule.repository',
      payload: {
        repository: {
          name: 'api-common-java',
        },
        organization: {
          login: 'googleapis',
        },
        cron_org: 'GoogleCloudPlatform',
      },
      id: 'abc123',
    });
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
        cron_org: 'Codertocat',
      },
      id: 'abc123',
    });
    scopes.forEach(s => s.done());
  });

  it('should override master branch protection if the repo is overridden', async () => {
    const scopes = [
      nockUpdateRepoSettings('google-api-java-client-services', false, true),
      nockUpdateBranchProtection(
        'google-api-java-client-services',
        ['Kokoro - Test: Java 8', 'cla/google'],
        false
      ),
      nockUpdateTeamMembership(
        'yoshi-admins',
        'googleapis',
        'google-api-java-client-services'
      ),
      nockUpdateTeamMembership(
        'yoshi-java-admins',
        'googleapis',
        'google-api-java-client-services'
      ),
      nockUpdateTeamMembership(
        'yoshi-java',
        'googleapis',
        'google-api-java-client-services'
      ),
    ];
    await probot.receive({
      name: 'schedule.repository',
      payload: {
        repository: {
          name: 'google-api-java-client-services',
        },
        organization: {
          login: 'googleapis',
        },
        cron_org: 'googleapis',
      },
      id: 'abc123',
    });
    scopes.forEach(s => s.done());
  });

  it('should update settings for a known repository', async () => {
    const scopes = [
      nockUpdateRepoSettings('nodejs-dialogflow', true, true),
      nockUpdateBranchProtection(
        'nodejs-dialogflow',
        [
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
        true
      ),
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
        cron_org: 'googleapis',
      },
      id: 'abc123',
    });
    scopes.forEach(s => s.done());
  });
});
