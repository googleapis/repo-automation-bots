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
import {describe, it, beforeEach, afterEach} from 'mocha';
import nock from 'nock';
import * as assert from 'assert';
import {resolve} from 'path';
import fs from 'fs';
import snapshot from 'snap-shot-it';
import * as sinon from 'sinon';
import {autoDetectLabel, handler, DriftRepo} from '../src/auto-label';
import {logger} from 'gcf-utils';

nock.disableNetConnect();
const sandbox = sinon.createSandbox();

const fixturesPath = resolve(__dirname, '../../test/fixtures');
const driftRepos = JSON.parse(
  fs.readFileSync(
    resolve(__dirname, '../../test/fixtures/events/downloadedfile.json'),
    'utf8'
  )
).repos as DriftRepo[];

describe('auto-label', () => {
  let probot: Probot;
  let errorStub: sinon.SinonStub;
  let repoStub: sinon.SinonStub;

  beforeEach(() => {
    probot = new Probot({
      // use a bare instance of octokit, the default version
      // enables retries which makes testing difficult.
      // eslint-disable-next-line node/no-extraneous-require
      Octokit: require('@octokit/rest').Octokit,
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

    // throw and fail the test if we're writing
    errorStub = sandbox.stub(logger, 'error').throwsArg(0);
    repoStub = sandbox.stub(handler, 'getDriftRepos').resolves(driftRepos);
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('responds to events', () => {
    it('responds to issues and creates appropriate labels when there are no labels', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const ghRequests = nock('https://api.github.com')
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
      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      ghRequests.done();
    });

    //should get a 422 error when creating the label on the repo, we're mocking it already exists
    it('responds to issues and does not create labels if they are not needed', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened'));
      const ghRequests = nock('https://api.github.com')
        .post('/repos/testOwner/testRepo/labels')
        .reply(422, [
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
      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      ghRequests.done();
    });

    //should get a 422 error when creating the label on the repo, we're mocking it already exists
    it('responds to issues and adds a label to an issue, even if the label already exists on the repo', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const ghRequests = nock('https://api.github.com')
        .post('/repos/testOwner/testRepo/labels')
        .reply(422, [
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
      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      ghRequests.done();
    });

    it('ends execution if the JSON file is empty', async () => {
      errorStub.restore();
      errorStub = sandbox.stub(logger, 'error');
      repoStub.restore();
      repoStub = sandbox.stub(handler, 'getDriftReposFile').resolves('');
      const payload = require(resolve(fixturesPath, './events/issue_opened'));
      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      const loggerArg = errorStub.firstCall.args[0];
      assert.ok(loggerArg instanceof Error);
      assert.strictEqual(
        loggerArg.message,
        'JSON file downloaded from Cloud Storage was empty'
      );
    });

    it('returns null if there is no match on the repo', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_no_match_repo'
      ));
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/notThere/issues/5/labels')
        .reply(200);
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
        .post('/repos/GoogleCloudPlatform/golang-samples/labels')
        .reply(200, [
          {
            name: 'api: spanner',
          },
        ])
        .post(
          '/repos/GoogleCloudPlatform/golang-samples/issues/5/labels',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200)
        .post('/repos/GoogleCloudPlatform/golang-samples/labels')
        .reply(200, [
          {
            name: 'sample',
          },
        ])
        .post('/repos/GoogleCloudPlatform/golang-samples/issues/5/labels')
        .reply(200, [
          {
            name: 'sample',
          },
        ]);
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
        .post('/repos/GoogleCloudPlatform/golang-samples/labels')
        .reply(200, [
          {
            name: 'api: spanner',
          },
        ])
        .post(
          '/repos/GoogleCloudPlatform/golang-samples/issues/5/labels',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200)
        .post('/repos/GoogleCloudPlatform/golang-samples/labels')
        .reply(200, [
          {
            name: 'sample',
          },
        ])
        .post('/repos/GoogleCloudPlatform/golang-samples/issues/5/labels')
        .reply(200, [
          {
            name: 'sample',
          },
        ]);
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
            name: 'api: spanner',
          },
        ])
        .post('/repos/GoogleCloudPlatform/golang-samples/labels')
        .reply(200, [
          {
            name: 'api: spanner',
          },
        ])
        .post('/repos/GoogleCloudPlatform/golang-samples/labels')
        .reply(200, [
          {
            name: 'sample',
          },
        ])
        .post('/repos/GoogleCloudPlatform/golang-samples/issues/5/labels')
        .reply(200, [
          {
            name: 'sample',
          },
        ]);

      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      ghRequests.done();
    });
  });

  describe('schedule repository', () => {
    it('responds to a scheduled event', async () => {
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [
          {
            number: 1,
          },
        ])
        .get('/repos/testOwner/testRepo/issues/1/labels')
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
        .reply(200, [
          {
            number: 1,
          },
        ])
        .get('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200, [{name: 'api:theWrongLabel'}])
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
        .reply(200, [
          {
            number: 1,
          },
        ])
        .get('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200, [
          {
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ])
        .post('/repos/testOwner/testRepo/labels')
        .reply(422);

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

    it('will add a samples tag for a samples repo', async () => {
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo-samples/issues')
        .reply(200, [
          {
            number: 1,
            title: 'spanner: ignored',
          },
        ])
        .post('/repos/testOwner/testRepo-samples/labels')
        .reply(201, [
          {
            name: 'api: spanner',
            color: 'C9FFE5',
          },
        ])
        .get('/repos/testOwner/testRepo-samples/issues/1/labels')
        .reply(200)
        .post('/repos/testOwner/testRepo-samples/issues/1/labels')
        .reply(200, [
          {
            name: 'api: spanner',
            color: 'C9FFE5',
          },
        ])
        .post('/repos/testOwner/testRepo-samples/labels')
        .reply(201, [
          {
            name: 'sample',
          },
        ])
        .post('/repos/testOwner/testRepo-samples/issues/1/labels')
        .reply(200, [
          {
            name: 'sample',
          },
        ]);
      await probot.receive({
        name: 'schedule.repository',
        payload: {
          organization: {login: 'testOwner'},
          repository: {name: 'testRepo-samples'},
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
        .reply(200, [
          {
            number: 1,
          },
        ])
        .get('/repos/testOwner/testRepo/issues/1/labels')
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
      const tests = [
        {title: 'spanner: ignored', want: 'api: spanner'},
        {title: 'spanner/ignored', want: 'api: spanner'},
        {title: 'spanner.ignored', want: 'api: spanner'},
        {title: 'SPANNER.IGNORED', want: 'api: spanner'},
        {title: 'SPAN ner: ignored', want: 'api: spanner'},
        {title: 'feat(spanner): ignored', want: 'api: spanner'},
        {title: 'fix(spanner/helper): ignored', want: 'api: spanner'},
        {title: 'fix(/spanner/helper): ignored', want: 'api: spanner'},
        {title: 'iot: ignored', want: 'api: cloudiot'},
        {title: 'unknown: ignored', want: undefined},
        {title: 'spanner with no separator', want: undefined},
        {title: 'fix(unknown): ignored', want: undefined},
        {title: 'feat(): ignored', want: undefined},
      ];
      for (const test of tests) {
        assert.strictEqual(autoDetectLabel(driftRepos, test.title), test.want);
      }
    });
  });
});
