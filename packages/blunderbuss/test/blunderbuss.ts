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
import {ConfigChecker} from '@google-automations/bot-config-utils';
import {describe, it, beforeEach, afterEach} from 'mocha';
import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import {Octokit} from '@octokit/rest';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as sinon from 'sinon';
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

nock.disableNetConnect();
chai.use(chaiAsPromised);

const fixturesPath = resolve(__dirname, '../../test/fixtures');

// TODO: stop disabling warn once the following upstream patch is landed:
// https://github.com/probot/probot/pull/926
global.console.warn = () => {};

describe('Blunderbuss', () => {
  let probot: Probot;
  let datastoreLockAcquireStub: sinon.SinonStub;
  let datastoreLockReleaseStub: sinon.SinonStub;
  let sleepStub: sinon.SinonStub;
  let getConfigWithDefaultStub: sinon.SinonStub;
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
    getConfigWithDefaultStub = sandbox.stub(
      configUtilsModule,
      'getConfigWithDefault'
    );
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

  const validConfig = {
    assign_issues: ['issues1'],
    assign_prs: ['prs1'],
  };

  const noIssuesConfig = {
    assign_prs: ['prs1'],
  };

  const onLabelConfig = {
    assign_issues_by: [
      {
        labels: ['api: foo'],
        to: ['foo_user'],
      },
      {
        labels: ['api: bar', 'api: baz'],
        to: ['bar_baz_user'],
      },
      {
        labels: ['api: team'],
        to: ['googleapis/team-awesome'],
      },
    ],
    assign_prs: ['prs1'],
  };

  const assignByConfig = {
    assign_issues_by: [
      {
        labels: ['api: logging'],
        to: ['not-a-real-github-username-i-hope'],
      },
    ],
  };

  const prWithTeamConfig = {
    assign_prs: ['googleapis/team-awesome'],
  };

  const noPRsConfig = {
    assign_issues: ['issues1'],
  };

  describe('issue tests', () => {
    it('assigns opened issues with no assignees', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_no_assignees'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      getConfigWithDefaultStub.resolves(validConfig);

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
      getConfigWithDefaultStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'testOwner',
        'testRepo',
        CONFIGURATION_FILE_PATH
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
      getConfigWithDefaultStub.resolves(validConfig);

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
      getConfigWithDefaultStub.resolves(validConfig);

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

      getConfigWithDefaultStub.resolves(noIssuesConfig);

      await probot.receive({name: 'issues', payload, id: 'abc123'});
    });

    it('assigns issue when correct label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_correct_label'
      ));
      const issue = require(resolve(fixturesPath, './issues/with_assignees'));
      getConfigWithDefaultStub.resolves(validConfig);

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
      getConfigWithDefaultStub.resolves(validConfig);

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
      getConfigWithDefaultStub.resolves(validConfig);

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
      getConfigWithDefaultStub.resolves(onLabelConfig);

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
      getConfigWithDefaultStub.resolves(onLabelConfig);

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
      getConfigWithDefaultStub.resolves(onLabelConfig);

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
      getConfigWithDefaultStub.resolves(onLabelConfig);

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
      getConfigWithDefaultStub.resolves(onLabelConfig);

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
      getConfigWithDefaultStub.resolves(assignByConfig);

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
      getConfigWithDefaultStub.resolves(validConfig);

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
      validateConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
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
      getConfigWithDefaultStub.resolves(prWithTeamConfig);

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
      getConfigWithDefaultStub.resolves(onLabelConfig);

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
      getConfigWithDefaultStub.resolves(validConfig);

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
      getConfigWithDefaultStub.resolves(validConfig);
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
      getConfigWithDefaultStub.resolves(noPRsConfig);
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
      getConfigWithDefaultStub.resolves(validConfig);

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
      getConfigWithDefaultStub.resolves(validConfig);

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
      const PROnLabelConfig = {
        assign_prs_by: [
          {
            labels: ['samples'],
            to: ['java-samples-reviewers'],
          },
        ],
        assign_prs: ['prs1'],
      };
      getConfigWithDefaultStub.resolves(PROnLabelConfig);
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
