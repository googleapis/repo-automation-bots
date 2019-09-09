/**
 * Copyright 2019 Google LLC
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

import myProbotApp from '../src/release-please';
import { Runner } from '../src/runner';

import { resolve } from 'path';
import { Probot } from 'probot';
import snapshot from 'snap-shot-it';
import Webhooks from '@octokit/webhooks';

import nock from 'nock';
import * as fs from 'fs';
import assert, { fail } from 'assert';
import { ReleasePR } from 'release-please/build/src/release-pr';
import { JavaYoshi } from 'release-please/build/src/releasers/java-yoshi';

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
      Runner.runner = (pr: ReleasePR) => {
        assert(pr instanceof JavaYoshi);
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github/release-please.yml'
        )
        .reply(200, { content: config });

      await probot.receive({ name: 'push', payload, id: 'abc123' });
      requests.done();
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
        .reply(200, { content: config });

      await probot.receive({ name: 'push', payload, id: 'abc123' });
      requests.done();
    });

    it('should create the PR if the branch is the configured primary branch', async () => {
      Runner.runner = (pr: ReleasePR) => {
        assert(pr instanceof JavaYoshi);
      };
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'feature_branch_as_primary.yml')
      );
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github/release-please.yml'
        )
        .reply(200, { content: config });

      await probot.receive({ name: 'push', payload, id: 'abc123' });
      requests.done();
    });
  });

  // describe('push to non-master branch', () => {
  //   let payload: Webhooks.WebhookPayloadPullRequest;

  //   beforeEach(() => {
  //     payload = require(resolve(fixturesPath, './push_to_feature'));
  //   });

  //   it('sets a "failure" context on PR, if new source file is missing license', async () => {
  //     const invalidFiles = require(resolve(
  //       fixturesPath,
  //       './missing_license_added'
  //     ));
  //     const blob = require(resolve(fixturesPath, './missing_license'));
  //     const requests = nock('https://api.github.com')
  //       .get(
  //         '/repos/chingor13/google-auth-library-java/contents/.bots/header-checker-lint.json?ref=header-check-test'
  //       )
  //       .reply(404)
  //       .get(
  //         '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
  //       )
  //       .reply(200, invalidFiles)
  //       .get(
  //         '/repos/chingor13/google-auth-library-java/git/blobs/5b414a072e40622c177c72a58efb74ff9faadd0d'
  //       )
  //       .reply(200, blob)
  //       .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
  //         snapshot(body);
  //         return true;
  //       })
  //       .reply(200);

  //     await probot.receive({ name: 'pull_request', payload, id: 'abc123' });
  //     requests.done();
  //   });
  // });
});
