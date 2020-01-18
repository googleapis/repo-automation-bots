// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

import myProbotApp from '../src/alwaysGreen';

import { resolve } from 'path';
import { Probot } from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';
import { expect } from 'chai';


nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('alwaysGreen', () => {
  let probot: Probot;

  const config = fs.readFileSync(
    resolve(fixturesPath, 'config', 'valid-config.yml')
  );

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

  describe('shows an example of how to use chai library', () => {
    it('confirms the random boolean is true', async () => {
       expect(config.toString()).to.include('true');
    })
  }); 

  describe('responds to events', () => {
    it('responds to a PR', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened'
      ));


      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/alwaysGren.yml')
        .reply(200, { content: config.toString('base64') })


      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123'
      });

      requests.done();
    });

    it('responds to issues', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened'
      ));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/alwaysGren.yml')
        .reply(200, { content: config.toString('base64') })


      await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
      requests.done();
    });

  });
});