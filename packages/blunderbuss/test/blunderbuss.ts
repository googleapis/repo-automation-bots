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

import {resolve} from 'path';
import {Probot} from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

// TODO: stop disabling warn once the following upstream patch is landed:
// https://github.com/probot/probot/pull/926
global.console.warn = () => {
};

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


  describe('opened issue', () => {
    it('assigns user to an issue when opened with no assignee', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened_no_assignees'));
      const validConfig = fs.readFileSync(resolve(fixturesPath, 'config/valid.yml'));

      const requests = nock('https://api.github.com')
          .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
          .reply(200, {content: validConfig})
          .post('/repos/testOwner/testRepo/issues/5/assignees', body => {
            snapshot(body);
            return true;
          })
          .reply(200);

      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores issue when issue opened with assignee(s)', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened_with_assignees'));
      const validConfig = fs.readFileSync(resolve(fixturesPath, 'config/valid.yml'));

      const requests = nock('https://api.github.com')
          .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
          .reply(200, {content: validConfig});

      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores issue when issue opened but assign_issues not in config', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened_no_assignees'));
      const validConfig = fs.readFileSync(resolve(fixturesPath, 'config/no_issues.yml'));

      const requests = nock('https://api.github.com')
          .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
          .reply(200, {content: validConfig});

      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      requests.done();
    });
  });
});


