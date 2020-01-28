/**
 * Copyright 2020 Google LLC. All Rights Reserved.
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

import myProbotApp from '../src/merge-on-green';

import { resolve } from 'path';
import { Probot } from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/Fixtures');

const commits = require(resolve(fixturesPath, 'events', 'commits.json'));

const config = fs.readFileSync(
  resolve(fixturesPath, 'config', 'valid-config.yml')
);

const invalidConfig = fs.readFileSync(
  resolve(fixturesPath, 'config', 'invalid-config.yml')
);

const validConfigOneTest = fs.readFileSync(
  resolve(fixturesPath, 'config', 'valid-config-oneTest.yml')
);

const payload = require(resolve(fixturesPath, 'events', 'pull_request_opened'));

const branchProtection = require(resolve(
  fixturesPath,
  'events',
  'branch_protection.json'
));

const branchProtectionNotEnough = require(resolve(
  fixturesPath,
  'events',
  'branch_protection_lessthan3.json'
));

describe('merge-on-green', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      // use a bare instance of octokit, the default version
      // enables retries which makes testing difficult.
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
    probot.load(myProbotApp);
  });

  describe('responds to pull requests', () => {
    it('gets branch information when a pull request is opened, responds with a failed status check for no branch protection', async () => {
      const scope = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/merge-on-green.yml')
        .reply(200, { content: config.toString('base64') })
        .get('/repos/testOwner/testRepo/branches/master/protection')
        .reply(200)
        .get('/repos/testOwner/testRepo/pulls/6/commits?per_page=100')
        .reply(200, commits)
        .post('/repos/testOwner/testRepo/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      scope.done();
    });

    it('gets branch information when a pull request is opened, responds with a passed status check', async () => {
      const scope = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/merge-on-green.yml')
        .reply(200, { content: config.toString('base64') })
        .get('/repos/testOwner/testRepo/branches/master/protection')
        .reply(200, branchProtection)
        .get('/repos/testOwner/testRepo/pulls/6/commits?per_page=100')
        .reply(200, commits)
        .post('/repos/testOwner/testRepo/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      scope.done();
    });

    it('gets branch information when a pull request is opened, responds with a failed status check because there are less than 3 tests', async () => {
      const scope = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/merge-on-green.yml')
        .reply(200, { content: validConfigOneTest.toString('base64') })
        .get('/repos/testOwner/testRepo/branches/master/protection')
        .reply(200, branchProtectionNotEnough)
        .get('/repos/testOwner/testRepo/pulls/6/commits?per_page=100')
        .reply(200, commits)
        .post('/repos/testOwner/testRepo/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      scope.done();
    });

    it('gets branch information when a pull request is opened, responds with a failed status check because branch protection does not match config', async () => {
      const scope = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/merge-on-green.yml')
        .reply(200, { content: invalidConfig.toString('base64') })
        .get('/repos/testOwner/testRepo/branches/master/protection')
        .reply(200, branchProtection)
        .get('/repos/testOwner/testRepo/pulls/6/commits?per_page=100')
        .reply(200, commits)
        .post('/repos/testOwner/testRepo/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      scope.done();
    });
  });
});
