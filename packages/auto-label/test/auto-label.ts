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
import {Probot, ProbotOctokit} from 'probot';
import {describe, it, beforeEach, afterEach} from 'mocha';
import nock from 'nock';
import * as assert from 'assert';
import {resolve} from 'path';
import fs from 'fs';
import snapshot from 'snap-shot-it';
import * as sinon from 'sinon';
import {handler} from '../src/auto-label';
import {
  DEFAULT_CONFIGS,
  autoDetectLabel,
  DriftRepo,
  DriftApi,
} from '../src/helper';
import {loadConfig} from './test-helper';
import {logger} from 'gcf-utils';
import * as botConfigModule from '@google-automations/bot-config-utils';
import {ConfigChecker} from '@google-automations/bot-config-utils';
nock.disableNetConnect();
const sandbox = sinon.createSandbox();

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
  let getConfigWithDefaultStub: sinon.SinonStub;
  let validateConfigStub: sinon.SinonStub;

  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      }),
    });

    probot.load(handler);

    // throw and fail the test if we're writing
    errorStub = sandbox.stub(logger, 'error').throwsArg(0);
    repoStub = sandbox.stub(handler, 'getDriftRepos').resolves(driftRepos);
    getConfigWithDefaultStub = sandbox.stub(
      botConfigModule,
      'getConfigWithDefault'
    );
    validateConfigStub = sandbox.stub(
      ConfigChecker.prototype,
      'validateConfigChanges'
    );
    // We test the config schema compatibility in config-compatibility.ts
    validateConfigStub.resolves();
    sandbox.stub(handler, 'getDriftApis').resolves(driftApis);
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('responds to events', () => {
    it('responds to issues and creates appropriate labels when there are no labels', async () => {
      const config = loadConfig('valid-config.yml');
      getConfigWithDefaultStub.resolves(config);
      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      const ghRequests = nock('https://api.github.com')
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
      const config = loadConfig('valid-config.yml');
      getConfigWithDefaultStub.resolves(config);
      const fileStub = sandbox.stub(handler, 'getDriftFile').resolves('');
      const payload = require(resolve(fixturesPath, './events/issue_opened'));
      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });
      fileStub.restore();
      const loggerArg = errorStub.firstCall.args[0];
      assert.ok(loggerArg instanceof Error);
      assert.strictEqual(
        loggerArg.message,
        'public_repos.json downloaded from Cloud Storage was empty'
      );
    });

    it('returns null if there is no match on the repo', async () => {
      const config = loadConfig('valid-config.yml');
      getConfigWithDefaultStub.resolves(config);
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_no_match_repo'
      ));
      const ghRequests = nock('https://api.github.com')
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
      const config = loadConfig('valid-config-not-enabled.yml');
      getConfigWithDefaultStub.resolves(config);

      const payload = require(resolve(fixturesPath, './events/issue_opened'));

      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });
    });

    it('does nothing if api: N/A label is on an issue', async () => {
      const config = loadConfig('valid-config.yml');
      getConfigWithDefaultStub.resolves(config);

      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_spanner'
      ));

      const ghRequests = nock('https://api.github.com')
        .get('/repos/GoogleCloudPlatform/golang-samples/issues/5/labels')
        .reply(200, [{name: 'api: N/A'}]);
      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('auto detects and labels a Spanner issue', async () => {
      const config = loadConfig('valid-config.yml');
      getConfigWithDefaultStub.resolves(config);

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
        .reply(200)
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
      const config = loadConfig('valid-config.yml');
      getConfigWithDefaultStub.resolves(config);

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
        .reply(200)
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
      const config = loadConfig('valid-config.yml');
      getConfigWithDefaultStub.resolves(config);

      const payload = require(resolve(
        fixturesPath,
        './events/pr_opened_no_match_repo'
      ));

      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/notThere/issues/12/labels')
        .reply(200)
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
      sinon.assert.calledOnceWithExactly(
        validateConfigStub,
        sinon.match.instanceOf(ProbotOctokit),
        'testOwner',
        'notThere',
        '19f6a66851125917fa07615dcbc0cd13dad56981',
        12
      );
    });

    it('labels a pull request with correct size', async () => {
      const config = loadConfig('valid-config-pr-size.yml');
      getConfigWithDefaultStub.resolves(config);
      const pr_opened_payload = require(resolve(
        fixturesPath,
        './events/pr_opened.json'
      ));
      const pr_files_payload = require(resolve(
        fixturesPath,
        './events/pr_opened_files.json'
      ));
      const expected_labels = {
        labels: ['size: s'],
      };
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/12/files')
        .reply(200, pr_files_payload)
        // Mock issues.addlabels adding size label
        .post('/repos/testOwner/testRepo/issues/12/labels', body => {
          assert.deepStrictEqual(body, expected_labels);
          return true;
        })
        .reply(200)
        .get('/repos/testOwner/testRepo/issues/12/labels')
        .reply(200, [
          {
            name: 'size: s',
          },
        ])
        .post('/repos/testOwner/testRepo/issues/12/labels')
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload: pr_opened_payload,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('re-labels a pull request with correct size after size change', async () => {
      const config = loadConfig('valid-config-pr-size.yml');
      getConfigWithDefaultStub.resolves(config);
      const pr_opened_payload = require(resolve(
        fixturesPath,
        './events/pr_updates_size_change.json'
      ));
      const pr_files_payload = require(resolve(
        fixturesPath,
        './events/pr_opened_files.json'
      ));
      const expected_labels = {
        labels: ['size: s'],
      };
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/12/files')
        .reply(200, pr_files_payload)
        .delete('/repos/testOwner/testRepo/issues/12/labels/size%3A%20xxl')
        .reply(200, [
          {
            name: 'size: xxl',
            color: 'C9FFE5',
          },
        ])
        // Mock issues.addlabels adding size label
        .post('/repos/testOwner/testRepo/issues/12/labels', body => {
          assert.deepStrictEqual(body, expected_labels);
          return true;
        })
        .reply(200)
        .get('/repos/testOwner/testRepo/issues/12/labels')
        .reply(200, [
          {
            name: 'size: s',
          },
        ])
        .post('/repos/testOwner/testRepo/issues/12/labels')
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload: pr_opened_payload,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('does not re-labels a pull request when size was not changed', async () => {
      const config = loadConfig('valid-config-pr-size.yml');
      getConfigWithDefaultStub.resolves(config);
      const pr_opened_payload = require(resolve(
        fixturesPath,
        './events/pr_updates_size_change.json'
      ));
      const pr_files_payload = require(resolve(
        fixturesPath,
        './events/pr_opened_files_xxl_size.json'
      ));
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/12/files')
        .reply(200, pr_files_payload)
        .get('/repos/testOwner/testRepo/issues/12/labels')
        .reply(200)
        .post('/repos/testOwner/testRepo/issues/12/labels')
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload: pr_opened_payload,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('does not re-label an issue', async () => {
      const config = loadConfig('valid-config.yml');
      getConfigWithDefaultStub.resolves(config);
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
      const config = loadConfig('valid-config.yml');
      getConfigWithDefaultStub.resolves(config);

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
      const config = loadConfig('valid-config.yml');
      getConfigWithDefaultStub.resolves(config);
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [
          {
            number: 1,
          },
        ])
        .get('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200)
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('deletes extraneous labels', async () => {
      const config = loadConfig('valid-config.yml');
      getConfigWithDefaultStub.resolves(config);
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [
          {
            number: 1,
          },
        ])
        .get('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200, [{name: 'api:theWrongLabel'}])
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('will not create labels that already exist', async () => {
      const config = loadConfig('valid-config.yml');
      getConfigWithDefaultStub.resolves(config);
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
        ]);

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          organization: {login: 'testOwner'},
          repository: {name: 'testRepo', owner: {login: 'testOwner'}},
          cron_org: 'testOwner',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('will add a samples tag for a samples repo', async () => {
      const config = loadConfig('valid-config.yml');
      getConfigWithDefaultStub.resolves(config);
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo-samples/issues')
        .reply(200, [
          {
            number: 1,
            title: 'spanner: ignored',
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('will add a samples tag for a samples issue', async () => {
      const config = loadConfig('valid-config.yml');
      getConfigWithDefaultStub.resolves(config);
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [
          {
            number: 1,
            title: 'samples.spanner: ignored',
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('will run by default if there is no auto-label config file', async () => {
      // TODO: Migrate to a test without the config stub.
      getConfigWithDefaultStub.resolves(DEFAULT_CONFIGS);
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [
          {
            number: 1,
            title: 'samples.spanner: ignored',
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('does not updates staleness labels when same', async () => {
      const config = loadConfig('valid-config-staleness.yml');
      getConfigWithDefaultStub.resolves(config);
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [
          {
            number: 5,
            created_at: '2021-10-06T16:45:18Z',
            labels: [
              {
                name: 'stale: extraold',
                color: 'C9FFE5',
              },
            ],
            pull_request: {
              url: 'https://api.github.com/repos/testOwner/testRepo/issues/5',
            },
          },
        ])
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, []);

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          organization: {login: 'testOwner'},
          repository: {name: 'testRepo', owner: {login: 'testOwner'}},
          cron_org: 'testOwner',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('updates old staleness label to extraold', async () => {
      const config = loadConfig('valid-config-staleness.yml');
      getConfigWithDefaultStub.resolves(config);
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [
          {
            number: 5,
            created_at: '2021-10-06T16:45:18Z',
            labels: [
              {
                name: 'stale: old',
                color: 'C9FFE5',
              },
            ],
            pull_request: {
              url: 'https://api.github.com/repos/testOwner/testRepo/issues/5',
            },
          },
        ])
        .delete('/repos/testOwner/testRepo/issues/5/labels/stale%3A%20old')
        .reply(200, [
          {
            name: 'stale: old',
            color: 'C9FFE5',
          },
        ])
        .post('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200, [
          {
            name: 'stale: extraold',
            color: 'A9FFE5',
          },
        ])
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, []);

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          organization: {login: 'testOwner'},
          repository: {name: 'testRepo', owner: {login: 'testOwner'}},
          cron_org: 'testOwner',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('adds staleness label', async () => {
      const config = loadConfig('valid-config-staleness.yml');
      getConfigWithDefaultStub.resolves(config);
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [
          {
            number: 5,
            created_at: '2021-10-06T16:45:18Z',
            labels: [],
            pull_request: {
              url: 'https://api.github.com/repos/testOwner/testRepo/issues/5',
            },
          },
        ])
        .post('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200, [
          {
            name: 'stale: extraold',
            color: 'C9FFE5',
          },
        ])
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [
          {
            number: 1,
          },
        ])
        .get('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200, [{name: 'api:theWrongLabel'}])
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('does not adds staleness label for stale pull request with config disabled', async () => {
      const config = loadConfig('valid-config.yml');
      getConfigWithDefaultStub.resolves(config);
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [
          {
            number: 1,
            // return stale pull request to make sure it will be ignored due to disabled config
            created_at: '2010-10-01T16:45:18Z',
            labels: [],
            pull_request: {
              url: 'https://api.github.com/repos/testOwner/testRepo/issues/1',
            },
          },
        ])
        .get('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200, [{name: 'api:theWrongLabel'}])
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('adds staleness labels when feature enabled with default config values', async () => {
      const config = loadConfig('valid-config-staleness-defaults.yml');
      getConfigWithDefaultStub.resolves(config);
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [
          {
            number: 5,
            created_at: '2010-10-06T16:45:18Z',
            pull_request: {
              url: 'https://api.github.com/repos/testOwner/testRepo/issues/5',
            },
          },
        ])
        .post('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200, [
          {
            name: 'stale: extraold',
            color: 'C9FFE5',
          },
        ])
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, []);

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          organization: {login: 'testOwner'},
          repository: {name: 'testRepo', owner: {login: 'testOwner'}},
          cron_org: 'testOwner',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      ghRequests.done();
    });
  });

  describe('installation', async () => {
    it('responds to an installation event', async () => {
      const payload = require(resolve(fixturesPath, './events/installation'));
      getConfigWithDefaultStub.resolves({product: true});
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues')
        .reply(200, [
          {
            number: 1,
          },
        ])
        .get('/repos/testOwner/testRepo/issues/1/labels')
        .reply(200)
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
