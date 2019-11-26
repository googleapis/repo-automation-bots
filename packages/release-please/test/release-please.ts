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
import { Runner } from '../src/runner';

import { resolve } from 'path';
import { Probot } from 'probot';
import Webhooks from '@octokit/webhooks';

import nock from 'nock';
import * as fs from 'fs';
import assert, { fail } from 'assert';
import { GitHubRelease } from 'release-please/build/src/github-release';
import { ReleasePR } from 'release-please/build/src/release-pr';
import { JavaYoshi } from 'release-please/build/src/releasers/java-yoshi';
import { Ruby } from 'release-please/build/src/releasers/ruby';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

// TODO: stop disabling warn once the following upstream patch is landed:
// https://github.com/probot/probot/pull/926
global.console.warn = () => {};

describe('ReleasePleaseBot', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      // use a bare instance of octokit, the default version
      // enables retries which makes testing difficult.
      Octokit: require('@octokit/rest'),
    });

    const app = probot.load(myProbotApp);
    app.app = {
      getSignedJsonWebToken() {
        return 'abc123';
      },
      getInstallationAccessToken(): Promise<string> {
        return Promise.resolve('abc123');
      },
    };
  });

  describe('push to master branch', () => {
    let payload: Webhooks.WebhookPayloadPush;

    beforeEach(() => {
      payload = require(resolve(fixturesPath, './push_to_master'));
    });

    it('should build a release PR', async () => {
      let executed = false;
      Runner.runner = (pr: ReleasePR) => {
        assert(pr instanceof JavaYoshi);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github/release-please.yml'
        )
        .reply(200, { content: config.toString('base64') });

      await probot.receive({ name: 'push', payload, id: 'abc123' });
      requests.done();
      assert(executed, 'should have executed the runner');
    });

    it('should handle GitHub releases, if configured', async () => {
      let runnerExecuted = false;
      let releaserExecuted = false;
      Runner.runner = (pr: ReleasePR) => {
        assert(pr instanceof JavaYoshi);
        runnerExecuted = true;
      };
      Runner.releaser = (pr: GitHubRelease) => {
        assert(pr instanceof GitHubRelease);
        releaserExecuted = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid_handle_gh_release.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github/release-please.yml'
        )
        .reply(200, { content: config.toString('base64') });

      await probot.receive({ name: 'push', payload, id: 'abc123' });
      requests.done();
      assert(runnerExecuted, 'should have executed the runner');
      assert(releaserExecuted, 'GitHub release should have run');
    });

    it('should ignore if the branch is the configured primary branch', async () => {
      Runner.runner = (pr: ReleasePR) => {
        fail('should not be running a release');
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'feature_branch_as_primary.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github/release-please.yml'
        )
        .reply(200, { content: config.toString('base64') });

      await probot.receive({ name: 'push', payload, id: 'abc123' });
      requests.done();
    });

    it('should allow overriding the release strategy from configuration', async () => {
      let executed = false;
      Runner.runner = (pr: ReleasePR) => {
        assert(pr instanceof Ruby);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'ruby_release.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github/release-please.yml'
        )
        .reply(200, { content: config.toString('base64') });

      await probot.receive({ name: 'push', payload, id: 'abc123' });
      requests.done();
      assert(executed, 'should have executed the runner');
    });

    it('should allow overriding the package-name from configuration', async () => {
      let executed = false;
      Runner.runner = (pr: ReleasePR) => {
        assert.deepStrictEqual(pr.packageName, '@google-cloud/foo');
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'ruby_release_alternate_pkg_name.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github/release-please.yml'
        )
        .reply(200, { content: config.toString('base64') });

      await probot.receive({ name: 'push', payload, id: 'abc123' });
      requests.done();
      assert(executed, 'should have executed the runner');
    });

    it('should allow overriding the release tags from configuration', async () => {
      let executed = false;
      Runner.runner = (pr: ReleasePR) => {
        assert.deepStrictEqual(pr.labels, ['foo', 'bar']);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github/release-please.yml'
        )
        .reply(200, { content: config.toString('base64') });

      await probot.receive({ name: 'push', payload, id: 'abc123' });
      requests.done();
      assert(executed, 'should have executed the runner');
    });

    it('should ignore webhook if not configured', async () => {
      Runner.runner = (pr: ReleasePR) => {
        fail('should not be running a release');
      };
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github/release-please.yml'
        )
        .reply(404)
        .get(
          // FIXME(#68): why is this necessary?
          '/repos/chingor13/.github/contents/.github/release-please.yml'
        )
        .reply(404);

      await probot.receive({ name: 'push', payload, id: 'abc123' });
      requests.done();
    });

    it('should allow an empty config file with the defaults', async () => {
      let executed = false;
      Runner.runner = (pr: ReleasePR) => {
        assert(pr instanceof JavaYoshi);
        executed = true;
      };
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github/release-please.yml'
        )
        .reply(200, { content: Buffer.from('').toString('base64') });

      await probot.receive({ name: 'push', payload, id: 'abc123' });
      requests.done();
      assert(executed, 'should have executed the runner');
    });

    it('should allow configuring minor bump for breaking change pre 1.0', async () => {
      let executed = false;
      Runner.runner = (pr: ReleasePR) => {
        assert(pr instanceof JavaYoshi);
        assert(pr.bumpMinorPreMajor);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'minor_pre_major.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github/release-please.yml'
        )
        .reply(200, { content: config.toString('base64') });

      await probot.receive({ name: 'push', payload, id: 'abc123' });
      requests.done();
      assert(executed, 'should have executed the runner');
    });
  });

  describe('push to non-master branch', () => {
    let payload: Webhooks.WebhookPayloadPush;

    beforeEach(() => {
      payload = require(resolve(fixturesPath, './push_to_non_master'));
    });

    it('should ignore the webhook', async () => {
      Runner.runner = (pr: ReleasePR) => {
        fail('should not be running a release');
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github/release-please.yml'
        )
        .reply(200, { content: config.toString('base64') });

      await probot.receive({ name: 'push', payload, id: 'abc123' });
      requests.done();
    });

    it('should create the PR if the branch is the configured primary branch', async () => {
      let executed = false;
      Runner.runner = (pr: ReleasePR) => {
        assert(pr instanceof JavaYoshi);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'feature_branch_as_primary.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github/release-please.yml'
        )
        .reply(200, { content: config.toString('base64') });

      await probot.receive({ name: 'push', payload, id: 'abc123' });
      requests.done();
      assert(executed, 'should have executed the runner');
    });
  });

  describe('release published event', () => {
    let payload: Webhooks.WebhookPayloadRelease;

    beforeEach(() => {
      payload = require(resolve(fixturesPath, './release_published'));
    });

    it('should try to create a snapshot', async () => {
      let executed = false;
      Runner.runner = (pr: ReleasePR) => {
        assert(pr instanceof Ruby);
        executed = true;
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/Codertocat/Hello-World/contents/.github/release-please.yml'
        )
        .reply(200, { content: config.toString('base64') });

      await probot.receive({
        name: 'release.published',
        payload,
        id: 'abc123',
      });
      requests.done();
      assert(executed, 'should have executed the runner');
    });
  });

  describe('release non-publish event', () => {
    let payload: Webhooks.WebhookPayloadRelease;

    beforeEach(() => {
      payload = require(resolve(fixturesPath, './release_unpublished'));
    });

    it('should be ignored', async () => {
      Runner.runner = (pr: ReleasePR) => {
        fail('should not be running a release');
      };
      await probot.receive({
        name: 'release.published',
        payload,
        id: 'abc123',
      });
    });
  });
});
