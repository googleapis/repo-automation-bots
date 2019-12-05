/**
 * Copyright 2019 Google LLC. All Rights Reserved.
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

import myProbotApp from '../src/mergeOnGreen';

import { resolve } from 'path';
import { Probot } from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('mergeOnGreen', () => {
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

  describe('responds to events', () => {
    const config = fs.readFileSync(
      resolve(fixturesPath, 'config', 'valid-config.yml')
    );

    it('responds to a PR', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened'
      ));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/mergeOnGreen.yml')
        .reply(200, { content: config.toString('base64') });

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });

      requests.done();
    });

    it('responds to issues', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/mergeOnGreen.yml')
        .reply(200, { content: config.toString('base64') })
        .log(console.log);

      await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
      requests.done();
    });
  });
});
