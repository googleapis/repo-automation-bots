// Copyright 2019 Google LLC
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

import myProbotApp from '../src/release-please';
import {Runner} from '../src/runner';
import {describe, it, beforeEach} from 'mocha';
import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import * as fs from 'fs';
import assert, {fail} from 'assert';
import {GitHubRelease, ReleasePR} from 'release-please';
import nock from 'nock';

nock.disableNetConnect();
const fixturesPath = resolve(__dirname, '../../test/fixtures');

// helper to get the name of the releaser
function getReleaserName(pr: ReleasePR): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (pr.constructor as any).releaserName;
}

function assertReleaserType(expectedType: string, pr: ReleasePR) {
  const releaserName = getReleaserName(pr);
  assert(
    expectedType === releaserName,
    `expected to find ${expectedType}, found ${releaserName}`
  );
}

describe('ReleasePleaseBot', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = createProbot({
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      }),
    });
    probot.load(myProbotApp);
  });

  describe('push to master branch', () => {
    let payload: {};

    beforeEach(() => {
      payload = require(resolve(fixturesPath, './push_to_master'));
    });

    it('should build a release PR', async () => {
      let executed = false;
      Runner.runner = async (pr: ReleasePR) => {
        assertReleaserType('java-yoshi', pr);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Frelease-please.yml'
        )
        .reply(200, {content: config.toString('base64')});

      await probot.receive({name: 'push', payload, id: 'abc123'});
      requests.done();
      assert(executed, 'should have executed the runner');
    });

    it('should handle GitHub releases, if configured', async () => {
      let runnerExecuted = false;
      let releaserExecuted = false;
      Runner.runner = async (pr: ReleasePR) => {
        assertReleaserType('java-yoshi', pr);
        runnerExecuted = true;
      };
      Runner.releaser = async (pr: GitHubRelease) => {
        assert(pr instanceof GitHubRelease);
        releaserExecuted = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid_handle_gh_release.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Frelease-please.yml'
        )
        .reply(200, config);

      await probot.receive({name: 'push', payload, id: 'abc123'});
      requests.done();
      assert(runnerExecuted, 'should have executed the runner');
      assert(releaserExecuted, 'GitHub release should have run');
    });

    it('should ignore if the branch is the configured primary branch', async () => {
      Runner.runner = async () => {
        fail('should not be running a release');
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'feature_branch_as_primary.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Frelease-please.yml'
        )
        .reply(200, config);

      await probot.receive({name: 'push', payload, id: 'abc123'});
      requests.done();
    });

    it('should allow overriding the release strategy from configuration', async () => {
      let executed = false;
      Runner.runner = async (pr: ReleasePR) => {
        assertReleaserType('ruby', pr);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'ruby_release.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Frelease-please.yml'
        )
        .reply(200, config);

      await probot.receive({name: 'push', payload, id: 'abc123'});
      requests.done();
      assert(executed, 'should have executed the runner');
    });

    it('should allow overriding the package-name from configuration', async () => {
      let executed = false;
      Runner.runner = async (pr: ReleasePR) => {
        assert.deepStrictEqual(pr.packageName, '@google-cloud/foo');
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'ruby_release_alternate_pkg_name.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Frelease-please.yml'
        )
        .reply(200, config);

      await probot.receive({name: 'push', payload, id: 'abc123'});
      requests.done();
      assert(executed, 'should have executed the runner');
    });

    it('should allow overriding the release tags from configuration', async () => {
      let executed = false;
      Runner.runner = async (pr: ReleasePR) => {
        assert.deepStrictEqual(pr.labels, ['foo', 'bar']);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Frelease-please.yml'
        )
        .reply(200, config);

      await probot.receive({name: 'push', payload, id: 'abc123'});
      requests.done();
      assert(executed, 'should have executed the runner');
    });

    it('should ignore webhook if not configured', async () => {
      Runner.runner = async () => {
        fail('should not be running a release');
      };
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Frelease-please.yml'
        )
        .reply(404)
        .get(
          // we check both an org level .github, and a project level .github.
          '/repos/chingor13/.github/contents/.github%2Frelease-please.yml'
        )
        .reply(404);

      await probot.receive({name: 'push', payload, id: 'abc123'});
      requests.done();
    });

    it('should allow an empty config file with the defaults', async () => {
      let executed = false;
      Runner.runner = async (pr: ReleasePR) => {
        assertReleaserType('java-yoshi', pr);
        executed = true;
      };
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Frelease-please.yml'
        )
        .reply(200, Buffer.from(''));

      await probot.receive({name: 'push', payload, id: 'abc123'});
      requests.done();
      assert(executed, 'should have executed the runner');
    });

    it('should allow configuring minor bump for breaking change pre 1.0', async () => {
      let executed = false;
      Runner.runner = async (pr: ReleasePR) => {
        assertReleaserType('java-yoshi', pr);
        assert(pr.bumpMinorPreMajor);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'minor_pre_major.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Frelease-please.yml'
        )
        .reply(200, config);

      await probot.receive({name: 'push', payload, id: 'abc123'});
      requests.done();
      assert(executed, 'should have executed the runner');
    });

    it('should detect the default branch if not specified in configuration', async () => {
      let executed = false;
      Runner.runner = async (pr: ReleasePR) => {
        assertReleaserType('node', pr);
        assert('master' === pr.defaultBranch);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'release_type_no_primary_branch.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Frelease-please.yml'
        )
        .reply(200, config);

      await probot.receive({name: 'push', payload, id: 'abc123'});
      requests.done();
      assert(executed, 'should have executed the runner');
    });
  });

  describe('push to non-master branch', () => {
    let payload: {};

    beforeEach(() => {
      payload = require(resolve(fixturesPath, './push_to_non_master'));
    });

    it('should ignore the webhook', async () => {
      Runner.runner = async () => {
        fail('should not be running a release');
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Frelease-please.yml'
        )
        .reply(200, config);

      await probot.receive({name: 'push', payload, id: 'abc123'});
      requests.done();
    });

    it('should create the PR if the branch is the configured primary branch', async () => {
      let executed = false;
      Runner.runner = async (pr: ReleasePR) => {
        assertReleaserType('java-yoshi', pr);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'feature_branch_as_primary.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Frelease-please.yml'
        )
        .reply(200, config);

      await probot.receive({name: 'push', payload, id: 'abc123'});
      requests.done();
      assert(executed, 'should have executed the runner');
    });

    it('should create the PR if the branch is configured as an alternate branch', async () => {
      let executed = false;
      Runner.runner = async (pr: ReleasePR) => {
        assertReleaserType('java-yoshi', pr);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'multi_branch.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Frelease-please.yml'
        )
        .reply(200, config);

      await probot.receive({name: 'push', payload, id: 'abc123'});
      requests.done();
      assert(executed, 'should have executed the runner');
    });
  });

  describe('nightly event', () => {
    it('should try to create a snapshot', async () => {
      let executed = false;
      const payload = {
        repository: {
          name: 'Hello-World',
          full_name: 'Codertocat/Hello-World',
          owner: {
            login: 'Codertocat',
          },
        },
        organization: {
          login: 'Codertocat',
        },
        cron_org: 'Codertocat',
      };
      Runner.runner = async (pr: ReleasePR) => {
        assertReleaserType('java-yoshi', pr);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );
      const repository = require(resolve(fixturesPath, './repository'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/Codertocat/Hello-World/contents/.github%2Frelease-please.yml'
        )
        .reply(200, config)
        .get('/repos/Codertocat/Hello-World')
        .reply(200, repository);

      await probot.receive({
        // See: https://github.com/octokit/webhooks.js/issues/277
        name: 'schedule.repository' as '*',
        payload,
        id: 'abc123',
      });
      requests.done();
      assert(executed, 'should have executed the runner');
    });

    it('should try to create a snapshot on multiple branches', async () => {
      const executedBranches: Map<string, string> = new Map();
      const payload = {
        repository: {
          name: 'Hello-World',
          full_name: 'Codertocat/Hello-World',
          owner: {
            login: 'Codertocat',
          },
        },
        organization: {
          login: 'Codertocat',
        },
        cron_org: 'Codertocat',
      };
      Runner.runner = async (pr: ReleasePR) => {
        executedBranches.set(pr.defaultBranch!, getReleaserName(pr));
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'multi_branch.yml')
      );
      const repository = require(resolve(fixturesPath, './repository'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/Codertocat/Hello-World/contents/.github%2Frelease-please.yml'
        )
        .reply(200, config)
        .get('/repos/Codertocat/Hello-World')
        .reply(200, repository);

      await probot.receive({
        // See: https://github.com/octokit/webhooks.js/issues/277
        name: 'schedule.repository' as '*',
        payload,
        id: 'abc123',
      });
      requests.done();
      assert(executedBranches.get('master') === 'java-bom');
      assert(executedBranches.get('feature-branch') === 'java-yoshi');
    });
  });

  describe('pull-request labeled event', () => {
    let payload: {};

    it('should try to create a release', async () => {
      payload = require(resolve(fixturesPath, './pull_request_labeled'));
      let executed = false;
      Runner.runner = async (pr: ReleasePR) => {
        assertReleaserType('java-yoshi', pr);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/Codertocat/Hello-World/contents/.github%2Frelease-please.yml'
        )
        .reply(200, config)
        .delete(
          '/repos/Codertocat/Hello-World/issues/2/labels/release-please%3Aforce-run'
        )
        .reply(200);

      await probot.receive({
        name: 'pull_request.labeled',
        payload,
        id: 'abc123',
      });
      requests.done();
      assert(executed, 'should have executed the runner');
    });

    it('should try to create a release on an alternate branch', async () => {
      payload = require(resolve(
        fixturesPath,
        './pull_request_labeled_feature_branch'
      ));
      let executed = false;
      Runner.runner = async (pr: ReleasePR) => {
        assertReleaserType('java-yoshi', pr);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'multi_branch.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/Codertocat/Hello-World/contents/.github%2Frelease-please.yml'
        )
        .reply(200, config)
        .delete(
          '/repos/Codertocat/Hello-World/issues/2/labels/release-please%3Aforce-run'
        )
        .reply(200);

      await probot.receive({
        name: 'pull_request.labeled',
        payload,
        id: 'abc123',
      });
      requests.done();
      assert(executed, 'should have executed the runner');
    });

    it('should ignore other labels', async () => {
      payload = require(resolve(fixturesPath, './pull_request_labeled_other'));
      Runner.runner = async () => {
        fail('should not be running a release');
      };

      await probot.receive({
        name: 'pull_request.labeled',
        payload,
        id: 'abc123',
      });
    });
  });
});
