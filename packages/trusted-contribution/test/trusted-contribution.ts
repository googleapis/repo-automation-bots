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

import myProbotApp from '../src/trusted-contribution';

import { resolve } from 'path';
import { Probot } from 'probot';
import snapshot from 'snap-shot-it';
import Webhooks from '@octokit/webhooks';

import nock from 'nock';
nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

// TODO: stop disabling warn once the following upstream patch is landed:
// https://github.com/probot/probot/pull/926
global.console.warn = () => {};

describe('TrustedContributionTestRunner', () => {
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

  describe('opened pull request', () => {
    let payload: Webhooks.WebhookPayloadPullRequest;

    beforeEach(() => {
      payload = require(resolve(fixturesPath, './pull_request_opened'));
    });

    it('sets a label on PR, if PR author is a trusted contributor', async () => {
      const requests = nock('https://api.github.com')
        .post(
          '/repos/chingor13/google-auth-library-java/issues/3/labels',
          (body: object) => {
            return true;
          }
        )
        .reply(200);

      await probot.receive({ name: 'pull_request', payload, id: 'abc123' });
      requests.done();
    });

    it('does not set a label on PR, if PR author is not a trusted contributor', async () => {
      payload.pull_request.user.login = 'notauthorized';
      const requests = nock('https://api.github.com');
      await probot.receive({ name: 'pull_request', payload, id: 'abc123' });
      requests.done();
    });
  });

  describe('updated pull request', () => {
    let payload: Webhooks.WebhookPayloadPullRequest;

    before(() => {
      payload = require(resolve(fixturesPath, './pull_request_synchronized'));
    });

    it('sets a label on PR, if PR author is a trusted contributor', async () => {
      const requests = nock('https://api.github.com')
        .post(
          '/repos/chingor13/google-auth-library-java/issues/3/labels',
          (body: object) => {
            return true;
          }
        )
        .reply(200);

      await probot.receive({ name: 'pull_request', payload, id: 'abc123' });
      requests.done();
    });

    it('does not set a label on PR, if PR author is not a trusted contributor', async () => {
      payload.pull_request.user.login = 'notauthorized';
      const requests = nock('https://api.github.com');
      await probot.receive({ name: 'pull_request', payload, id: 'abc123' });
      requests.done();
    });
  });
});
