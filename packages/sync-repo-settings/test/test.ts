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
import {handler} from '../src/sync-repo-settings';

nock.disableNetConnect();

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
      Octokit: require('@octokit/rest').Octokit,
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

  it('should ignore repos in ignored repos in required-checks.json', async () => {
    const org = 'googleapis';
    const repo = 'api-common-java';
    const scopes = [
      nockLanguagesList(org, repo, {java: 1}),
      nockUpdateTeamMembership('yoshi-admins', org, repo),
      nockUpdateTeamMembership('yoshi-java-admins', org, repo),
      nockUpdateTeamMembership('yoshi-java', org, repo),
      nockUpdateTeamMembership('java-samples-reviewers', org, repo),
    ];
    await probot.receive({
      name: 'schedule.repository',
      payload: {
        repository: {
          name: repo,
        },
        organization: {
          login: org,
        },
        cron_org: org,
      },
      id: 'abc123',
    });
    scopes.forEach(x => x.done());
  });

  it('should skip for the wrong context', async () => {
    const scope = nockLanguagesList('googleapis', 'api-common-java', {java: 1});
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
    scope.done();
  });

  it('should ignore repos not represented in required-checks.json', async () => {
    const scopes = [
      nockLanguagesList('Codertocat', 'Hello-World', {kotlin: 1}),
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
    const org = 'googleapis';
    const repo = 'google-api-java-client';
    const scopes = [
      nockLanguagesList(org, repo, {java: 1}),
      nockUpdateRepoSettings(repo, false, true),
      nockUpdateBranchProtection(
        repo,
        [
          'Kokoro - Test: Binary Compatibility',
          'Kokoro - Test: Java 11',
          'Kokoro - Test: Java 7',
          'Kokoro - Test: Java 8',
          'Kokoro - Test: Linkage Monitor',
          'cla/google',
        ],
        false
      ),
      nockUpdateTeamMembership('yoshi-admins', org, repo),
      nockUpdateTeamMembership('yoshi-java-admins', org, repo),
      nockUpdateTeamMembership('yoshi-java', org, repo),
      nockUpdateTeamMembership('java-samples-reviewers', org, repo),
    ];
    await probot.receive({
      name: 'schedule.repository',
      payload: {
        repository: {
          name: 'google-api-java-client',
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
      nockLanguagesList('googleapis', 'nodejs-dialogflow', {
        groovy: 33,
        typescript: 100,
        kotlin: 2,
      }),
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

  it('should add extra teams specified in teams.json', async () => {
    const scopes = [
      nockLanguagesList('googleapis', 'java-asset', {java: 1}),
      nockUpdateRepoSettings('java-asset', false, true),
      nockUpdateBranchProtection(
        'java-asset',
        [
          'dependencies (8)',
          'dependencies (11)',
          'linkage-monitor',
          'lint',
          'clirr',
          'units (7)',
          'units (8)',
          'units (11)',
          'Kokoro - Test: Integration',
          'cla/google',
        ],
        false
      ),
      nockUpdateTeamMembership('yoshi-admins', 'googleapis', 'java-asset'),
      nockUpdateTeamMembership('yoshi-java-admins', 'googleapis', 'java-asset'),
      nockUpdateTeamMembership('yoshi-java', 'googleapis', 'java-asset'),
      nockUpdateTeamMembership(
        'java-samples-reviewers',
        'googleapis',
        'java-asset'
      ),
    ];
    await probot.receive({
      name: 'schedule.repository',
      payload: {
        repository: {
          name: 'java-asset',
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
  it('should nope out if github returns no languages', async () => {
    const scope = nockLanguagesList('Codertocat', 'Hello-World', {});
    await probot.receive({
      name: 'schedule.repository',
      payload: {
        repository: {
          name: 'Hello-World',
        },
        organization: {
          login: 'Codertocat',
        },
        cron_org: 'googleapis',
      },
      id: 'abc123',
    });
    scope.done();
  });
});
