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

import myProbotApp from '../src/blunderbuss';

import { resolve } from 'path';
import { Probot } from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

// TODO: stop disabling warn once the following upstream patch is landed:
// https://github.com/probot/probot/pull/926
global.console.warn = () => {};

describe('Blunderbuss', () => {
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

  describe('issue tests', () => {
    it('assigns opened issues with no assignees', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_no_assignees'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, { content: config })
        .post('/repos/testOwner/testRepo/issues/5/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
      requests.done();
    });

    it('ignores opened issues when with assignee(s)', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_opened_with_assignees'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, { content: config });

      await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
      requests.done();
    });

    it('ignores issue when not configured', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_opened_no_assignees'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'no_issues.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, { content: config });

      await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
      requests.done();
    });

    it('assigns issue when correct label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_correct_label'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, { content: config })
        .delete(
          '/repos/testOwner/testRepo/issues/4/labels/' +
            encodeURI('blunderbuss: assign')
        )
        .reply(200, {})
        .post('/repos/testOwner/testRepo/issues/4/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({ name: 'issues.labeled', payload, id: 'abc123' });
      requests.done();
    });

    it('ignores issue when wrong label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_wrong_label'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, { content: config });

      await probot.receive({ name: 'issues.labeled', payload, id: 'abc123' });
      requests.done();
    });
  });

  describe('pr tests', () => {
    it('assigns user to a PR when opened with no assignee', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_no_assignees'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, { content: config })
        .post('/repos/testOwner/testRepo/issues/6/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('ignores PR when PR opened with assignee(s)', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_with_assignees'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, { content: config });

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('ignores PR when PR opened but assign_issues not in config', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_no_assignees'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'no_prs.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, { content: config });

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('assigns issue when correct label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_correct_label'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, { content: config })
        .delete(
          '/repos/testOwner/testRepo/issues/6/labels/' +
            encodeURI('blunderbuss: assign')
        )
        .reply(200, {})
        .post('/repos/testOwner/testRepo/issues/6/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({ name: 'issues.labeled', payload, id: 'abc123' });
      requests.done();
    });

    it('ignores issue when wrong label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_wrong_label'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, { content: config });

      await probot.receive({ name: 'issues.labeled', payload, id: 'abc123' });
      requests.done();
    });
  });
});
