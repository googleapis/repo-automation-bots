// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* eslint-disable @typescript-eslint/no-var-requires */

import blunderbuss from '../src/blunderbuss';
import * as utilsModule from '../src/utils';
import {CONFIGURATION_FILE_PATH} from '../src/config';
import {DatastoreLock} from '@google-automations/datastore-lock';
import * as configUtilsModule from '@google-automations/bot-config-utils';
import * as labelUtilsModule from '@google-automations/label-utils';
import {ConfigChecker} from '@google-automations/bot-config-utils';
import {describe, it, beforeEach, afterEach} from 'mocha';
import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Context, Probot, createProbot, ProbotOctokit} from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import yaml from 'js-yaml';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import assert from 'assert';

nock.disableNetConnect();
chai.use(chaiAsPromised);

const fixturesPath = resolve(__dirname, '../../test/fixtures');

// TODO: stop disabling warn once the following upstream patch is landed:
// https://github.com/probot/probot/pull/926
global.console.warn = () => {};

function loadConfig(configFile: string) {
  return yaml.load(
    fs.readFileSync(resolve(fixturesPath, 'config', configFile), 'utf-8')
  );
}

describe('Blunderbuss', () => {
  let probot: Probot;
  let datastoreLockAcquireStub: sinon.SinonStub;
  let datastoreLockReleaseStub: sinon.SinonStub;
  let sleepStub: sinon.SinonStub;
  let getConfigWithDefaultStub: sinon.SinonStub;
  let validateConfigStub: sinon.SinonStub;
  let syncLabelsStub: sinon.SinonStub;

  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    probot = createProbot({
      overrides: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
      },
    });

    probot.load(blunderbuss);
    datastoreLockAcquireStub = sandbox.stub(DatastoreLock.prototype, 'acquire');
    datastoreLockReleaseStub = sandbox.stub(DatastoreLock.prototype, 'release');
    sleepStub = sandbox.stub(utilsModule, 'sleep');
    getConfigWithDefaultStub = sandbox.stub(
      configUtilsModule,
      'getConfigWithDefault'
    );
    validateConfigStub = sandbox.stub(
      ConfigChecker.prototype,
      'validateConfigChanges'
    );
    syncLabelsStub = sandbox.stub(labelUtilsModule, 'syncLabels');
    datastoreLockAcquireStub.resolves(true);
    datastoreLockReleaseStub.resolves(true);
    // Sleep does nothing.
    sleepStub.resolves();
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  describe('scheduler handler', () => {
    it('calls syncLabels', async () => {
      await probot.receive({
        name: 'schedule.repository' as '*',
        payload: {
          repository: {
            name: 'testRepo',
            owner: {
              login: 'testOwner',
            },
          },
          organization: {
            login: 'googleapis',
          },
        },
        id: 'abc123',
      });
      sinon.assert.calledOnceWithExactly(
        syncLabelsStub,
        sinon.match.instanceOf(ProbotOctokit),
        'googleapis',
        'testRepo',
        sinon.match.array.deepEquals(utilsModule.BLUNDERBUSS_LABELS)
      );
    });
  });

  describe('issue tests', () => {
    it('assigns opened issues with no assignees', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_no_assignees'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('valid.yml'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/5')
        .reply(200, issue)
        .post('/repos/testOwner/testRepo/issues/5/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'issues', payload, id: 'abc123'});
      requests.done();
      sinon.assert.calledOnceWithExactly(
        getConfigWithDefaultStub,
        sinon.match.instanceOf(ProbotOctokit),
        'testOwner',
        'testRepo',
        CONFIGURATION_FILE_PATH,
        {}
      );
      sinon.assert.notCalled(validateConfigStub);
    });

    it('ignores opened issues when with assignee(s)', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_opened_with_assignees'
      ));
      const issue = require(resolve(fixturesPath, './issues/with_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('valid.yml'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/5')
        .reply(200, issue);

      await probot.receive({name: 'issues', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores when refreshed issues have assingnee(s)', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_opened_no_assignees'
      ));
      const issue = require(resolve(fixturesPath, './issues/with_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('valid.yml'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/5')
        .reply(200, issue);

      await probot.receive({name: 'issues', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores issue when not configured', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_opened_no_assignees'
      ));

      getConfigWithDefaultStub.resolves(loadConfig('no_issues.yml'));

      await probot.receive({name: 'issues', payload, id: 'abc123'});
    });

    it('assigns issue when correct label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_correct_label'
      ));
      const issue = require(resolve(fixturesPath, './issues/with_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('valid.yml'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/4')
        .reply(200, issue)
        .delete(
          '/repos/testOwner/testRepo/issues/4/labels/blunderbuss%3A%20assign'
        )
        .reply(200, {})
        .post('/repos/testOwner/testRepo/issues/4/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('ignores issue when wrong label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_wrong_label'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('valid.yml'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/4')
        .reply(200, issue);

      await probot.receive({name: 'issues', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores issue when no config', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_opened_no_assignees'
      ));
      getConfigWithDefaultStub.resolves({});

      await probot.receive({name: 'issues', payload, id: 'abc123'});
    });

    it('throws an error when failed to acquire the lock', async () => {
      datastoreLockAcquireStub.reset();
      datastoreLockAcquireStub.resolves(false);
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_correct_label'
      ));
      getConfigWithDefaultStub.resolves(loadConfig('valid.yml'));

      await chai
        .expect(probot.receive({name: 'issues', payload, id: 'abc123'}))
        .to.be.rejectedWith(Error);
    });

    it('assigns blunderbuss labeled issue by label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_correct_label'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('on_label.yml'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/4')
        .reply(200, issue)
        .delete(
          '/repos/testOwner/testRepo/issues/4/labels/blunderbuss%3A%20assign'
        )
        .reply(200, {})
        .post('/repos/testOwner/testRepo/issues/4/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'issues', payload, id: 'abc123'});
      requests.done();
    });

    it('assigns opened issue by label', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_no_assignees'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      payload.issue.labels = [{name: 'api: foo'}];
      getConfigWithDefaultStub.resolves(loadConfig('on_label.yml'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/5')
        .reply(200, issue)
        .post('/repos/testOwner/testRepo/issues/5/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200, [{name: 'api: foo'}]);

      await probot.receive({name: 'issues', payload, id: 'abc123'});
      requests.done();
    });

    it('assigns labeled issue by label', async () => {
      const payload = require(resolve(fixturesPath, 'events', 'issue_labeled'));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('on_label.yml'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/4')
        .reply(200, issue)
        .post('/repos/testOwner/testRepo/issues/4/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'issues', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores labeled issues when with assignee(s)', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_labeled_with_assignees'
      ));
      const issue = require(resolve(fixturesPath, './issues/with_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('on_label.yml'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/4')
        .reply(200, issue);

      await probot.receive({name: 'issues', payload, id: 'abc123'});
      requests.done();
    });

    it('expands teams for an issue', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_labeled_for_team'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('on_label.yml'));

      const scopes = [
        nock('https://api.github.com')
          .get('/repos/testOwner/testRepo/issues/4')
          .reply(200, issue),
        nock('https://api.github.com')
          .get('/orgs/googleapis/teams/team-awesome/members')
          .reply(200, [{login: 'user123'}]),
        nock('https://api.github.com')
          .post('/repos/testOwner/testRepo/issues/4/assignees', body => {
            snapshot(body);
            return true;
          })
          .reply(200),
      ];

      await probot.receive({name: 'issues', payload, id: 'abc123'});
      scopes.forEach(s => s.done());
    });

    it('should handle assign_issues_by with no assign_issues in config', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_opened_no_assignees'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('assign_by.yml'));

      const scopes = [
        nock('https://api.github.com')
          .get('/repos/testOwner/testRepo/issues/5')
          .reply(200, issue),
        nock('https://api.github.com')
          .get('/repos/testOwner/testRepo/issues/5/labels')
          .reply(200, []),
      ];

      await probot.receive({name: 'issues', payload, id: 'abc123'});
      scopes.forEach(s => s.done());
    });
  });

  describe('pr tests', () => {
    it('assigns user to a PR when opened with no assignee', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_no_assignees'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('valid.yml'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/6')
        .reply(200, issue)
        .post('/repos/testOwner/testRepo/issues/6/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      requests.done();
      sinon.assert.calledOnceWithExactly(
        validateConfigStub,
        sinon.match.instanceOf(ProbotOctokit),
        'testOwner',
        'testRepo',
        'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
        6
      );
    });

    it('expands teams for a PR', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_no_assignees'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('pr_with_team.yml'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/6')
        .reply(200, issue)
        .get('/orgs/googleapis/teams/team-awesome/members')
        .reply(200, [{login: 'user123'}])
        .post('/repos/testOwner/testRepo/issues/6/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'user123',
      });
      requests.done();
    });

    it('assigns user to a PR when opened with no assignee, ignoring assign_issues_by', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_no_assignees'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      payload.pull_request.labels = [{name: 'api: foo'}];
      getConfigWithDefaultStub.resolves(loadConfig('on_label.yml'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/6')
        .reply(200, issue)
        .post('/repos/testOwner/testRepo/issues/6/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request',
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
      const issue = require(resolve(fixturesPath, './issues/with_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('valid.yml'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/6')
        .reply(200, issue);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('ignores PR when in draft mode', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_draft'
      ));
      getConfigWithDefaultStub.resolves(loadConfig('valid.yml'));
      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
    });

    it('ignores PR when PR opened but assign_issues not in config', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_no_assignees'
      ));
      getConfigWithDefaultStub.resolves(loadConfig('no_prs.yml'));
      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
    });

    it('assigns issue when correct label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_correct_label'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('valid.yml'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/6')
        .reply(200, issue)
        .delete(
          '/repos/testOwner/testRepo/issues/6/labels/blunderbuss%3A%20assign'
        )
        .reply(200, {})
        .post('/repos/testOwner/testRepo/issues/6/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores pr when wrong label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_wrong_label'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('valid.yml'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/6')
        .reply(200, issue);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('ignores pr when no config', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_opened_no_assignees'
      ));
      getConfigWithDefaultStub.resolves({});

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
    });

    it('assigns pr by label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_no_assignees'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      getConfigWithDefaultStub.resolves(loadConfig('pr_on_label.yml'));
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/issues/6')
        .reply(200, issue)
        .get('/repos/testOwner/testRepo/issues/6/labels')
        .reply(200, [{name: 'samples'}])
        .post('/repos/testOwner/testRepo/issues/6/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      requests.done();
    });
  });
});

// Emulate getContent and getBlob.
function createConfigResponse(configFile: string) {
  const config = fs.readFileSync(resolve(fixturesPath, 'config', configFile));
  const base64Config = config.toString('base64');
  return {
    size: base64Config.length,
    content: base64Config,
    encoding: 'base64',
  };
}

function fetchConfig(configFile: string) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
    .reply(200, createConfigResponse(configFile));
}

// Because we change how to fetch the config, test it with the
// real config file.
describe('Blunderbuss getConfigWithDefault', () => {
  let probot: Probot;
  let datastoreLockAcquireStub: sinon.SinonStub;
  let datastoreLockReleaseStub: sinon.SinonStub;
  let sleepStub: sinon.SinonStub;
  let assignStub: sinon.SinonStub;
  let validateConfigStub: sinon.SinonStub;

  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    probot = createProbot({
      overrides: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
      },
    });

    probot.load(blunderbuss);
    datastoreLockAcquireStub = sandbox.stub(DatastoreLock.prototype, 'acquire');
    datastoreLockReleaseStub = sandbox.stub(DatastoreLock.prototype, 'release');
    sleepStub = sandbox.stub(utilsModule, 'sleep');
    assignStub = sandbox.stub(utilsModule, 'assign');
    validateConfigStub = sandbox.stub(
      ConfigChecker.prototype,
      'validateConfigChanges'
    );
    datastoreLockAcquireStub.resolves(true);
    datastoreLockReleaseStub.resolves(true);
    // Sleep does nothing.
    sleepStub.resolves();
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  it('fetch a simple config', async () => {
    const payload = require(resolve(
      fixturesPath,
      'events',
      'pull_request_opened_no_assignees'
    ));
    const scope = fetchConfig('valid.yml');

    await probot.receive({
      name: 'pull_request',
      payload,
      id: 'abc123',
    });

    scope.done();

    sinon.assert.calledOnceWithExactly(
      validateConfigStub,
      sinon.match.instanceOf(ProbotOctokit),
      'testOwner',
      'testRepo',
      'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
      6
    );
    sinon.assert.calledOnceWithExactly(
      assignStub,
      sinon.match.instanceOf(Context),
      {
        assign_issues: sinon.match.array.deepEquals(['issues1']),
        assign_prs: sinon.match.array.deepEquals(['prs1']),
      }
    );
  });
  it('fetch a real world config(python-docs-samples)', async () => {
    const payload = require(resolve(
      fixturesPath,
      'events',
      'pull_request_opened_no_assignees'
    ));
    const scope = fetchConfig('python-docs-samples.yml');

    await probot.receive({
      name: 'pull_request',
      payload,
      id: 'abc123',
    });

    scope.done();

    sinon.assert.calledOnceWithExactly(
      validateConfigStub,
      sinon.match.instanceOf(ProbotOctokit),
      'testOwner',
      'testRepo',
      'c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a',
      6
    );
    sinon.assert.calledOnceWithExactly(
      assignStub,
      sinon.match.instanceOf(Context),
      sinon.match.any
    );
    const config = assignStub.getCall(0).args[1];
    assert.strictEqual(config.assign_issues_by[0].labels[0], 'api: appengine');
    assert.strictEqual(config.assign_issues_by[0].to[0], 'engelke');
  });
});

function fetchFilesInPR(configFile: string) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
    .reply(200, [
      {
        filename: `.github/${CONFIGURATION_FILE_PATH}`,
        sha: '8a533f7e4e551f2b8da1c31b02225cd98c01cb51',
      },
    ])
    .get(
      '/repos/testOwner/testRepo/git/blobs/8a533f7e4e551f2b8da1c31b02225cd98c01cb51'
    )
    .reply(200, createConfigResponse(configFile));
}

// Because we start creating failing checks on PRs
// for config schema validation, we test it with
// real config file.
describe('Blunderbuss validateConfigChanges', () => {
  let probot: Probot;
  let datastoreLockAcquireStub: sinon.SinonStub;
  let datastoreLockReleaseStub: sinon.SinonStub;
  let sleepStub: sinon.SinonStub;
  let assignStub: sinon.SinonStub;
  let getConfigWithDefaultStub: sinon.SinonStub;

  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    probot = createProbot({
      overrides: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
      },
    });

    probot.load(blunderbuss);
    datastoreLockAcquireStub = sandbox.stub(DatastoreLock.prototype, 'acquire');
    datastoreLockReleaseStub = sandbox.stub(DatastoreLock.prototype, 'release');
    sleepStub = sandbox.stub(utilsModule, 'sleep');
    assignStub = sandbox.stub(utilsModule, 'assign');
    getConfigWithDefaultStub = sandbox.stub(
      configUtilsModule,
      'getConfigWithDefault'
    );
    datastoreLockAcquireStub.resolves(true);
    datastoreLockReleaseStub.resolves(true);
    getConfigWithDefaultStub.resolves({});
    assignStub.resolves();
    // Sleep does nothing.
    sleepStub.resolves();
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  it('does not create a failing status check for a correct config', async () => {
    const payload = require(resolve(
      fixturesPath,
      'events',
      'pull_request_opened_no_assignees'
    ));
    const scope = fetchFilesInPR('python-docs-samples.yml');
    await probot.receive({
      name: 'pull_request',
      payload,
      id: 'abc123',
    });
    scope.done();
    sinon.assert.calledOnceWithExactly(
      assignStub,
      sinon.match.instanceOf(Context),
      sinon.match.any
    );
  });
  it('creates a failing status check for a broken config', async () => {
    const payload = require(resolve(
      fixturesPath,
      'events',
      'pull_request_opened_no_assignees'
    ));
    const scope = fetchFilesInPR('python-docs-samples-broken.yml');
    scope
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
    sinon.assert.calledOnceWithExactly(
      assignStub,
      sinon.match.instanceOf(Context),
      sinon.match.any
    );
  });
});
