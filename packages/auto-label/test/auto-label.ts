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
import {handler} from '../src/auto-label';
import {autoDetectLabel, DriftRepo, DriftApi} from '../src/helper';
import {logger} from 'gcf-utils';
import {createProbotAuth} from 'octokit-auth-probot';
nock.disableNetConnect();
const sandbox = sinon.createSandbox();

// We provide our own GitHub instance, similar to
// the one used by gcf-utils, this allows us to turn off
// methods like retry, and to use @octokit/rest
// as the base class:
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import {config} from '@probot/octokit-plugin-config';
const TestingOctokit = Octokit.plugin(config).defaults({
  authStrategy: createProbotAuth,
});

const fixturesPath = resolve(__dirname, '../../test/fixtures');
const driftRepos = JSON.parse(
  fs.readFileSync(
    resolve(__dirname, '../../test/fixtures/events/downloadedfile.json'),
    'utf8'
  )
).repos as DriftRepo[];
const driftApis = JSON.parse(
  fs.readFileSync(
    resolve(__dirname, '../../test/fixtures/events/downloadedfile.json'),
    'utf8'
  )
).repos as DriftApi[];

describe('auto-label', () => {
  let probot: Probot;
  let errorStub: sinon.SinonStub;
  let repoStub: sinon.SinonStub;

  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Octokit: TestingOctokit as any,
    });

    probot.load(handler);

    // throw and fail the test if we're writing
    errorStub = sandbox.stub(logger, 'error').throwsArg(0);
    repoStub = sandbox.stub(handler, 'getDriftRepos').resolves(driftRepos);
    sandbox.stub(handler, 'getDriftApis').resolves(driftApis);
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('responds to events', () => {
    it('responds to issues and creates appropriate labels when there are no labels', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );
      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-label.yaml')
        .reply(200, config)
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
      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });
      ghRequests.done();
    });

    //should get a 422 error when creating the label on the repo, we're mocking it already exists
    it('responds to issues and does not create labels if they are not needed', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );
      const payload = require(resolve(fixturesPath, './events/issue_opened'));
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-label.yaml')
        .reply(200, config)
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
      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });
      ghRequests.done();
    });

    //should get a 422 error when creating the label on the repo, we're mocking it already exists
    it('responds to issues and adds a label to an issue, even if the label already exists on the repo', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );
      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-label.yaml')
        .reply(200, config)
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
      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('ends execution if the repo JSON file is empty', async () => {
      errorStub.restore();
      errorStub = sandbox.stub(logger, 'error');
      repoStub.restore();
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );
      const fileStub = sandbox.stub(handler, 'getDriftFile').resolves('');
      const payload = require(resolve(fixturesPath, './events/issue_opened'));
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-label.yaml')
        .reply(200, config);
      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });
      ghRequests.done();
      fileStub.restore();
      const loggerArg = errorStub.firstCall.args[0];
      assert.ok(loggerArg instanceof Error);
      assert.strictEqual(
        loggerArg.message,
        'public_repos.json downloaded from Cloud Storage was empty'
      );
    });

    it('returns null if there is no match on the repo', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_no_match_repo'
      ));
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/notThere/contents/.github%2Fauto-label.yaml')
        .reply(200, config)
        .get('/repos/testOwner/notThere/issues/5/labels')
        .reply(200);
      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('ignores repos that are not enabled', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config-not-enabled.yml')
      );

      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-label.yaml')
        .reply(200, config);

      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('auto detects and labels a Spanner issue', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );

      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_spanner'
      ));

      const ghRequests = nock('https://api.github.com')
        .get(
          '/repos/GoogleCloudPlatform/golang-samples/contents/.github%2Fauto-label.yaml'
        )
        .reply(200, config)
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
      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('auto detects and labels a Cloud IoT issue', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );

      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_spanner'
      ));
      payload['issue']['title'] = 'Cloud IoT: TestDeploy failed';

      const ghRequests = nock('https://api.github.com')
        .get(
          '/repos/GoogleCloudPlatform/golang-samples/contents/.github%2Fauto-label.yaml'
        )
        .reply(200, config)
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
      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('auto detects and labels a Spanner pull request', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );

      const payload = require(resolve(
        fixturesPath,
        './events/pr_opened_no_match_repo'
      ));

      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/notThere/contents/.github%2Fauto-label.yaml')
        .reply(200, config)
        .get('/repos/testOwner/notThere/issues/12/labels')
        .reply(200)
        .post('/repos/testOwner/notThere/labels')
        .reply(200, [
          {
            name: 'api: spanner',
          },
        ])
        .post('/repos/testOwner/notThere/issues/12/labels', body => {
          snapshot(body);
          return true;
        })
        .reply(200);
      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('does not re-label an issue', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_spanner'
      ));
      payload['issue']['title'] = 'spanner: this is actually about App Engine';

      const ghRequests = nock('https://api.github.com')
        .get(
          '/repos/GoogleCloudPlatform/golang-samples/contents/.github%2Fauto-label.yaml'
        )
        .reply(200, config)
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

      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('does not label a docs issue', async () => {
      assert.notStrictEqual(
        driftApis.find(api => api.github_label === 'api: docs'),
        undefined,
        'expected an `api: docs` repo in downloadedfile.json'
      );
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );

      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_spanner'
      ));

      const titles = [
        'docs: they are awesome',
        'fix(docs): still awesome',
        'build(foo): still never flake',
        'ci(build): never flake',
      ];

      for (const title of titles) {
        payload['issue']['title'] = title;

        const ghRequests = nock('https://api.github.com')
          .get(
            '/repos/GoogleCloudPlatform/golang-samples/contents/.github%2Fauto-label.yaml'
          )
          .reply(200, config)
          .get('/repos/GoogleCloudPlatform/golang-samples/issues/5/labels')
          .reply(200, [
            {
              name: 'samples',
            },
          ]);
        await probot.receive({
          name: 'issues',
          payload,
          id: 'abc123',
        });
        ghRequests.done();
      }
    });
  });

  describe('schedule repository', () => {
    it('responds to a scheduled event', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-label.yaml')
        .reply(200, config)
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          organization: {login: 'testOwner'},
          repository: {name: 'testRepo', owner: {login: 'testOwner'}},
          cron_org: 'testOwner',
        },
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('deletes extraneous labels', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-label.yaml')
        .reply(200, config)
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
        .delete('/repos/testOwner/testRepo/issues/1/labels/api%3AtheWrongLabel')
        .reply(200, [
          {
            name: 'myGitHubLabel',
            color: 'C9FFE5',
          },
        ]);

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          organization: {login: 'testOwner'},
          repository: {name: 'testRepo', owner: {login: 'testOwner'}},
          cron_org: 'testOwner',
        },
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('will not create labels that already exist', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-label.yaml')
        .reply(200, config)
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          organization: {login: 'testOwner'},
          repository: {name: 'testRepo', owner: {login: 'testOwner'}},
          cron_org: 'testOwner',
        },
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('will add a samples tag for a samples repo', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );
      const ghRequests = nock('https://api.github.com')
        .get(
          '/repos/testOwner/testRepo-samples/contents/.github%2Fauto-label.yaml'
        )
        .reply(200, config)
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          organization: {login: 'testOwner'},
          repository: {name: 'testRepo-samples', owner: {login: 'testOwner'}},
          cron_org: 'testOwner',
        },
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('will add a samples tag for a samples issue', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-label.yaml')
        .reply(200, config)
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [
          {
            number: 1,
            title: 'samples.spanner: ignored',
          },
        ])
        .post('/repos/testOwner/testRepo/labels')
        .reply(201, [
          {
            name: 'api: spanner',
            color: 'C9FFE5',
          },
        ])
        .get('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200)
        .post('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200, [
          {
            name: 'api: spanner',
            color: 'C9FFE5',
          },
        ])
        .post('/repos/testOwner/testRepo/labels')
        .reply(201, [
          {
            name: 'samples',
          },
        ])
        .post('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200, [
          {
            name: 'samples',
          },
        ]);
      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          organization: {login: 'testOwner'},
          repository: {name: 'testRepo', owner: {login: 'testOwner'}},
          cron_org: 'testOwner',
        },
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('will run by default if there is no auto-label config file', async () => {
      const config = undefined;
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-label.yaml')
        .reply(200, config)
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [
          {
            number: 1,
            title: 'samples.spanner: ignored',
          },
        ])
        .post('/repos/testOwner/testRepo/labels')
        .reply(201, [
          {
            name: 'api: spanner',
            color: 'C9FFE5',
          },
        ])
        .get('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200)
        .post('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200, [
          {
            name: 'api: spanner',
            color: 'C9FFE5',
          },
        ])
        .post('/repos/testOwner/testRepo/labels')
        .reply(201, [
          {
            name: 'samples',
          },
        ])
        .post('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200, [
          {
            name: 'samples',
          },
        ]);
      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          organization: {login: 'testOwner'},
          repository: {name: 'testRepo', owner: {login: 'testOwner'}},
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
      const product_config = Buffer.from('product: true', 'binary').toString(
        'base64'
      );
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-label.yaml')
        .reply(200, {
          content: product_config,
        })
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
        name: 'installation',
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
        {title: 'spanner_ignored: ignored', want: 'api: spanner'},
        {title: 'feat(spanner): ignored', want: 'api: spanner'},
        {title: 'fix(spanner/helper): ignored', want: 'api: spanner'},
        {title: 'fix(/spanner/helper): ignored', want: 'api: spanner'},
        {title: 'iot: ignored', want: 'api: cloudiot'},
        {title: 'com.example.spanner: ignored', want: 'api: spanner'},
        {title: 'com.google.spanner.helper: ignored', want: 'api: spanner'},
        {title: 'fix(snippets.spanner.helper): ignored', want: 'api: spanner'},
        {title: 'snippets.video: ignored', want: 'api: videointelligence'},
        {
          title: 'video-intelligence.ignored: ignored',
          want: 'api: videointelligence',
        },
        {title: 'unknown: ignored', want: undefined},
        {title: 'spanner with no separator', want: undefined},
        {title: 'fix(unknown): ignored', want: undefined},
        {title: 'feat(): ignored', want: undefined},
      ];
      for (const test of tests) {
        // driftRepos has the same format as apis.json. No need for a different
        // test file.
        assert.strictEqual(autoDetectLabel(driftRepos, test.title), test.want);
      }
    });
  });
});
