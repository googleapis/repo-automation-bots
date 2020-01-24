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

import myProbotApp from '../src/auto-label';

import { resolve } from 'path';
import { Probot } from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';
import { expect } from 'chai';
import { u } from 'tar';


nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('auto-label', () => {
  let probot: Probot;

  const issueCreated = fs.readFileSync(
    resolve(fixturesPath, 'events', 'issue_created.json')
  );

  const labelApplied = fs.readFileSync(
    resolve(fixturesPath, 'events', 'issue_created.json')
  );

  const labelAdded = fs.readFileSync(
    resolve(fixturesPath, 'events', 'label_added.json')
  );

  const downloadedFile = fs.readFileSync(
    resolve(fixturesPath, 'events', 'downloadedFile.json')
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

  describe('responds to events', () => {
    it('responds to issues and creates appropriate labels', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened'
      ));

      const googleAuthentication = nock('https://googleapis.com')
        .get('/oath2/v4/token')
        .reply(200)
        .get('/storage/v1/b/devrel-dev-settings/o/public_repos.json?alt=media')
        .reply(200, downloadedFile)
        
        const storageAPIs = nock('https://googleapis.com')
        .get('/oath2/v4/token')
        .reply(200)
        .get('/storage/v1/b/devrel-dev-settings/o/public_repos.json?alt=media')
        .reply(200, downloadedFile)

      const ghRequests = nock('https://api.github.com')
        .post('/repos/testOwner/testRepo/labels')
        .reply(200, labelAdded)
        .post('/repos/testOwner/testRepo/issues/208045946/labels')
        .reply(200, labelApplied)


      await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
      //googleRequests.done();
      ghRequests.done();
    });

  });
});