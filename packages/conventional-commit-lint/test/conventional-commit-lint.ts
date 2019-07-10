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

import myProbotApp from '../src/conventional-commit-lint';

import { expect } from 'chai';
import { resolve } from 'path';
import { Probot } from 'probot';
import nock from 'nock'

const fixturesPath = resolve(__dirname, '../../test/fixtures');

// const nock = require('nock');
nock.disableNetConnect();

// TODO: stop disabling warn once the following upstream patch is landed:
// https://github.com/probot/probot/pull/926
global.console.warn = () => {};

describe('ConventionalCommitLint', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({});

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

  it('creates a comment when an issue is opened', async () => {
    const payload = require(resolve(fixturesPath, './pull_request_synchronize'));
    const issueCreatedBody = { body: 'Thanks for opening this issue!' };

    nock('https://api.github.com')
      .post('/app/installations/2/access_tokens')
      .reply(200, { token: 'test' });

    nock('https://api.github.com')
      .post(
        '/repos/Codertocat/Hello-World/issues/1/comments',
        (body: object) => {
          expect(body).to.eql(issueCreatedBody);
          return true;
        }
      )
      .reply(200);

    await probot.receive({ name: 'issues', payload, id: 'abc123' });
  });
});
