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


import { Probot } from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';
import { expect } from 'chai';
import handler from '../src/auto-label';
import { resolve } from 'path';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('auto-label', () => {
  let probot: Probot;

  const getSingleLabel = fs.readFileSync(
    resolve(fixturesPath, 'events', 'get_single_label.json')
  );

  const labelAdded = fs.readFileSync(
    resolve(fixturesPath, 'events', 'label_added.json')
  );

  const labelCreated = fs.readFileSync(
    resolve(fixturesPath, 'events', 'label_created.json')
  );
  

  beforeEach(() => {
    probot = new Probot({
      // use a bare instance of octokit, the default version
      // enables retries which makes testing difficult.
      Octokit: require('@octokit/rest'),
    });
    const app = probot.load(handler);
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
    it('responds to issues and creates appropriate labels when there are no labels', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened'
      ));

      const ghRequests = nock('https://api.github.com').log(console.log)
        .get('/repos/testOwner/testRepo/labels/myGitHubLabel')
        .reply(200)
        .post('/repos/testOwner/testRepo/labels')
        .reply(200, labelCreated)
        .get('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200)
        .post('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200, labelAdded);

        handler.callStorage = async () => {
          return resolve(fixturesPath, 'events', 'downloadedFile.json');
        }
      
      await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
      ghRequests.done();
    });

    it('responds to issues and does not create labels if they are not needed', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened'
      ));

      const ghRequests = nock('https://api.github.com').log(console.log)
        .get('/repos/testOwner/testRepo/labels/myGitHubLabel')
        .reply(200, getSingleLabel)
        .get('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200, getSingleLabel)

        handler.callStorage = async () => {
          return resolve(fixturesPath, 'events', 'downloadedFile.json');
        }
      
      await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
      ghRequests.done();
    });

    it('responds to issues and adds a label to an issue, even if the label already exists on the repo', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened'
      ));

      const ghRequests = nock('https://api.github.com').log(console.log)
        .get('/repos/testOwner/testRepo/labels/myGitHubLabel')
        .reply(200, getSingleLabel)
        .get('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200)
        .post('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200, labelAdded);

        handler.callStorage = async () => {
          return resolve(fixturesPath, 'events', 'downloadedFile.json');
        }
      
      await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
      ghRequests.done();
    });

    //TODO: finish test if file is empty && if there is no match in the array

    // it('ends execution if the JSON file is empty', async () => {
    //   const payload = require(resolve(
    //     fixturesPath,
    //     './events/issue_opened'
    //   ));

    //   const ghRequests = nock('https://api.github.com')

    //     handler.callStorage = async () => {
    //       return resolve(fixturesPath, 'events', 'emptydownloadedfile.json');
    //     }
      
    //   await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
    //   ghRequests.done();
    // });

  });
});