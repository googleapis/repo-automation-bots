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
import nock from 'nock';
import { expect } from 'chai';
import handler from '../src/auto-label';
import { resolve } from 'path';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('auto-label', () => {
  let probot: Probot;

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
      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/labels/myGitHubLabel')
        .reply(200)
        .post('/repos/testOwner/testRepo/labels')
        .reply(200, [
          {
            id: 1811802233,
            node_id: 'MDU6TGFiZWwxODExODAyMjMz',
            url:
              'https://api.github.com/repos/sofisl/mergeOnGreenTest/labels/anotherLabel',
            name: 'myGitHubLabel',
            color: 'C9FFE5',
            default: false,
            description: null,
          },
        ])
        .get('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200)
        .post('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200, [
          {
            id: 1811802233,
            node_id: 'MDU6TGFiZWwxODExODAyMjMz',
            url:
              'https://api.github.com/repos/sofisl/mergeOnGreenTest/labels/anotherLabel',
            name: 'myGitHubLabel',
            color: 'C9FFE5',
            default: false,
            description: null,
          },
        ]);

      handler.callStorage = async () => {
        return resolve(fixturesPath, 'events', 'downloadedFile.json');
      };

      await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
      ghRequests.done();
    });

    it('responds to issues and does not create labels if they are not needed', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/labels/myGitHubLabel')
        .reply(200, [
          {
            id: 1811802233,
            node_id: 'MDU6TGFiZWwxODExODAyMjMz',
            url:
              'https://api.github.com/repos/sofisl/mergeOnGreenTest/labels/anotherLabel',
            name: 'myGitHubLabel',
            color: 'C9FFE5',
            default: false,
            description: null,
          },
        ])
        .get('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200, [
          {
            id: 1811802233,
            node_id: 'MDU6TGFiZWwxODExODAyMjMz',
            url:
              'https://api.github.com/repos/sofisl/mergeOnGreenTest/labels/anotherLabel',
            name: 'myGitHubLabel',
            color: 'C9FFE5',
            default: false,
            description: null,
          },
        ]);

      handler.callStorage = async () => {
        return resolve(fixturesPath, 'events', 'downloadedFile.json');
      };

      await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
      ghRequests.done();
    });

    it('responds to issues and adds a label to an issue, even if the label already exists on the repo', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/labels/myGitHubLabel')
        .reply(200, [
          {
            id: 1811802233,
            node_id: 'MDU6TGFiZWwxODExODAyMjMz',
            url:
              'https://api.github.com/repos/sofisl/mergeOnGreenTest/labels/anotherLabel',
            name: 'myGitHubLabel',
            color: 'C9FFE5',
            default: false,
            description: null,
          },
        ])
        .get('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200)
        .post('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200, [
          {
            id: 1811802233,
            node_id: 'MDU6TGFiZWwxODExODAyMjMz',
            url:
              'https://api.github.com/repos/sofisl/mergeOnGreenTest/labels/anotherLabel',
            name: 'myGitHubLabel',
            color: 'C9FFE5',
            default: false,
            description: null,
          },
        ]);

      handler.callStorage = async () => {
        return resolve(fixturesPath, 'events', 'downloadedFile.json');
      };

      await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
      ghRequests.done();
    });

    it('ends execution if the JSON file is empty', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const ghRequests = nock('https://api.github.com');

      handler.callStorage = async () => {
        return resolve(fixturesPath, 'events', 'emptydownloadedfile.json');
      };

      expect(
        await handler.checkIfFileIsEmpty(
          await handler.callStorage('my-bucket', 'my-file', 'my-other-file')
        )
      ).to.be.a('null');

      await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
      ghRequests.done();
    });

    it('returns null if there is no match on the repo', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const ghRequests = nock('https://api.github.com');

      handler.callStorage = async () => {
        return resolve(fixturesPath, 'events', 'downloadedFile.json');
      };

      expect(
        handler.checkIfElementIsInArray(
          [
            {
              num_total_prs: 0,
              num_open_p1s: 0,
              num_open_questions: 0,
              num_open_p0s: 0,
              language: 'ANDROID_JAVA',
              api_shortname: '',
              github_label: '',
              num_open_p2s: 0,
              is_tracking_issues: true,
              repo: 'firebase/FirebaseUI-Android',
              is_tracking_samples: false,
              num_open_issues: 0,
              num_total_issues: 0,
              num_open_prs: 0,
              issue_score: 100,
              num_slo_violations: -1,
              num_commits: 1541,
            },
          ],
          'notThere',
          'notThere'
        )
      ).to.be.an('undefined');

      await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
      ghRequests.done();
    });
  });
});
