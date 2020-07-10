// Copyright 2020 Google LLC
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

/* eslint-disable @typescript-eslint/no-var-requires */

// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
import {describe, it, beforeEach} from 'mocha';
import nock from 'nock';
import {expect} from 'chai';
import {resolve} from 'path';
import fs from 'fs';
import snapshot from 'snap-shot-it';

import handler, {autoDetectLabel} from '../src/auto-label';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

const downloadedFile = fs
  .readFileSync(
    resolve(__dirname, '../../test/fixtures/events/downloadedfile.json')
  )
  .toString();

const emptyFile = fs
  .readFileSync(
    resolve(__dirname, '../../test/fixtures/events/emptydownloadedfile.json')
  )
  .toString();

describe('auto-label', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      // use a bare instance of octokit, the default version
      // enables retries which makes testing difficult.
      // eslint-disable-next-line node/no-extraneous-require
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
    probot.load(handler);
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
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ])
        .get('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200)
        .post('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200, [
          {
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ]);
      handler.callStorage = async () => downloadedFile;
      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      ghRequests.done();
    });

    it('responds to issues and does not create labels if they are not needed', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/labels/myGitHubLabel')
        .reply(200, [
          {
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ])
        .get('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200, [
          {
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ]);
      handler.callStorage = async () => downloadedFile;
      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      ghRequests.done();
    });

    it('responds to issues and adds a label to an issue, even if the label already exists on the repo', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/labels/myGitHubLabel')
        .reply(200, [
          {
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ])
        .get('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200)
        .post('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200, [
          {
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ]);
      handler.callStorage = async () => downloadedFile;
      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      ghRequests.done();
    });

    it('ends execution if the JSON file is empty', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const ghRequests = nock('https://api.github.com');
      handler.callStorage = async () => emptyFile;
      expect(
        await handler.checkIfFileIsEmpty(
          await handler.callStorage('my-bucket', 'my-file')
        )
      ).to.be.a('null');

      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      ghRequests.done();
    });

    it('returns null if there is no match on the repo', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened'));
      const ghRequests = nock('https://api.github.com');
      handler.callStorage = async () => downloadedFile;
      expect(
        handler.checkIfElementIsInArray(
          [
            {
              github_label: '',
              repo: 'firebase/FirebaseUI-Android',
            },
          ],
          'notThere',
          'notThere'
        )
      ).to.be.an('undefined');

      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      ghRequests.done();
    });

    it('auto detects and labels a Spanner issue', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_spanner'
      ));

      const ghRequests = nock('https://api.github.com')
        .get('/repos/GoogleCloudPlatform/golang-samples/issues/5/labels')
        .reply(200)
        .post(
          '/repos/GoogleCloudPlatform/golang-samples/issues/5/labels',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200);
      handler.callStorage = async () => downloadedFile;
      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      ghRequests.done();
    });

    it('auto detects and labels a Cloud IoT issue', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_spanner'
      ));
      payload['issue']['title'] = 'Cloud IoT: TestDeploy failed';

      const ghRequests = nock('https://api.github.com')
        .get('/repos/GoogleCloudPlatform/golang-samples/issues/5/labels')
        .reply(200)
        .post(
          '/repos/GoogleCloudPlatform/golang-samples/issues/5/labels',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200);
      handler.callStorage = async () => downloadedFile;
      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      ghRequests.done();
    });

    it('does not re-label an issue', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_spanner'
      ));
      payload['issue']['title'] = 'spanner: this is actually about App Engine';

      const ghRequests = nock('https://api.github.com')
        .get('/repos/GoogleCloudPlatform/golang-samples/issues/5/labels')
        .reply(200, [
          {
            name: 'api: appengine',
          },
        ]);
      handler.callStorage = async () => downloadedFile;
      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      ghRequests.done();
    });
  });

  describe('schedule repository', () => {
    it('responds to a scheduled event', async () => {
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [{
          number: 1,
        }])
        .get('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200)
        .get('/repos/testOwner/testRepo/labels/myGitHubLabel')
        .reply(200)
        .post('/repos/testOwner/testRepo/labels', {
          name: 'myGitHubLabel',
          color: 'FEFEFA',
        })
        .reply(201, [
          {
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ])
        .post('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200, [
          {
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ]);
      handler.callStorage = async () => downloadedFile;
      await probot.receive({
        name: 'schedule.repository',
        payload: {
          organization: {login: 'testOwner'},
          repository: {name: 'testRepo'},
          cron_org: 'testOwner',
        },
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('deletes extraneous labels', async () => {
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [{
          number: 1,
        }])
        .get('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200, [{name: 'api:theWrongLabel'}])
        .get('/repos/testOwner/testRepo/labels/myGitHubLabel')
        .reply(200)
        .post('/repos/testOwner/testRepo/labels', {
          name: 'myGitHubLabel',
          color: 'FEFEFA',
        })
        .reply(201, [
          {
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ])
        .post('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200, [
          {
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ])
        .delete('/repos/testOwner/testRepo/issues/1/labels/api:theWrongLabel')
        .reply(200, [
          {
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ]);

      handler.callStorage = async () => downloadedFile;
      await probot.receive({
        name: 'schedule.repository',
        payload: {
          organization: {login: 'testOwner'},
          repository: {name: 'testRepo'},
          cron_org: 'testOwner',
        },
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('will not create labels that already exist', async () => {
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [{
          number: 1,
        }])
        .get('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200)
        .get('/repos/testOwner/testRepo/labels/myGitHubLabel')
        .reply(200, {name: 'myGithubLabel'})
        .post('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200, [
          {
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ]);

      handler.callStorage = async () => downloadedFile;
      await probot.receive({
        name: 'schedule.repository',
        payload: {
          organization: {login: 'testOwner'},
          repository: {name: 'testRepo'},
          cron_org: 'testOwner',
        },
        id: 'abc123',
      });
      ghRequests.done();
    });
  });

  describe('installation', async () => {
    it('responds to an installation event', async () => {
      const payload = require(resolve(fixturesPath, './events/installation'));

      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, {
          number: 1,
        })
        .get('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200)
        .get('/repos/testOwner/testRepo/labels/myGitHubLabel')
        .reply(200)
        .post('/repos/testOwner/testRepo/labels', {
          name: 'myGitHubLabel',
          color: 'FEFEFA',
        })
        .reply(201, [
          {
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ])
        .post('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200, [
          {
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ]);
      handler.callStorage = async () => downloadedFile;
      await probot.receive({
        name: 'installation.created',
        payload,
        id: 'abc123',
      });
      ghRequests.done();
    });
  });

  describe('autoDetectLabel', () => {
    it('finds the right label', () => {
      const data = JSON.parse(downloadedFile).repos;
      const tests = [
        {title: 'spanner: ignored', want: 'api: spanner'},
        {title: 'spanner/ignored', want: 'api: spanner'},
        {title: 'spanner.ignored', want: 'api: spanner'},
        {title: 'SPANNER.IGNORED', want: 'api: spanner'},
        {title: 'SPAN ner: ignored', want: 'api: spanner'},
        {title: 'iot: ignored', want: 'api: cloudiot'},
        {title: 'unknown: ignored', want: undefined},
        {title: 'spanner with no separator', want: undefined},
      ];
      for (const test of tests) {
        expect(autoDetectLabel(data, test.title)).to.equal(test.want);
      }
    });
  });
});
