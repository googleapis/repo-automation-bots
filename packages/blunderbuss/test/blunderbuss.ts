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

import * as blunderbuss from '../src/blunderbuss';
import {DatastoreLock} from '@github-automations/datastore-lock';
import {describe, it, beforeEach, afterEach, after} from 'mocha';
import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';
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
  const sandbox = sinon.createSandbox();

  const datastoreLockAcquireStub = sandbox.stub(
    DatastoreLock.prototype,
    'acquire'
  );
  const datastoreLockReleaseStub = sandbox.stub(
    DatastoreLock.prototype,
    'release'
  );
  const sleepStub = sandbox.stub(blunderbuss, 'sleep');
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

    probot.load(blunderbuss.blunderbuss);
    // By default, DatastoreLock stubs just suceeds.
    datastoreLockAcquireStub.resolves(true);
    datastoreLockReleaseStub.resolves(true);
    // Sleep does nothing.
    sleepStub.resolves();
  });

  afterEach(() => {
    sandbox.reset();
    nock.cleanAll();
  });

  after(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  //FYI: Probot upgrades usually break the config reply. Check there when updating
  //Probot.
  describe('issue tests', () => {
    it('assigns opened issues with no assignees', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_no_assignees'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
        .get('/repos/testOwner/testRepo/issues/5')
        .reply(200, issue)
        .post('/repos/testOwner/testRepo/issues/5/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'issues', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores opened issues when with assignee(s)', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_opened_with_assignees'
      ));
      const issue = require(resolve(fixturesPath, './issues/with_assignees'));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
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
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
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

      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'no_issues.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config);

      await probot.receive({name: 'issues', payload, id: 'abc123'});
      requests.done();
    });

    it('assigns issue when correct label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_correct_label'
      ));
      const issue = require(resolve(fixturesPath, './issues/with_assignees'));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
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
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
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

      const requests = nock('https://api.github.com')
        // This second stub is required as octokit does a second attempt on a different endpoint
        .get('/repos/testOwner/.github/contents/.github%2Fblunderbuss.yml')
        .reply(404, {})
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(404, {});

      await probot.receive({name: 'issues', payload, id: 'abc123'});
      requests.done();
    });

    it('throws an error when failed to acquire the lock', async () => {
      datastoreLockAcquireStub.reset();
      datastoreLockAcquireStub.resolves(false);
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_correct_label'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'on_label.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config);

      await chai
        .expect(probot.receive({name: 'issues', payload, id: 'abc123'}))
        .to.be.rejectedWith(Error);
      requests.done();
    });

    it('assigns blunderbuss labeled issue by label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_correct_label'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'on_label.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
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
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'on_label.yml')
      );
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
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
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'on_label.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
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
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'on_label.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
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
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'on_label.yml')
      );

      const scopes = [
        nock('https://api.github.com')
          .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
          .reply(200, config)
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
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'assign_by.yml')
      );

      const scopes = [
        nock('https://api.github.com')
          .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
          .reply(200, config)
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
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
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

    it('expands teams for a PR', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_no_assignees'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'pr_with_team.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
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
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'on_label.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
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
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
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
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config);
      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('ignores PR when PR opened but assign_issues not in config', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_no_assignees'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'no_prs.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('assigns issue when correct label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_correct_label'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
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
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
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

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(404, {})
        .get('/repos/testOwner/.github/contents/.github%2Fblunderbuss.yml')
        .reply(404, {});

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('assigns pr by label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_no_assignees'
      ));
      const issue = require(resolve(fixturesPath, './issues/no_assignees'));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'pr_on_label.yml')
      );
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fblunderbuss.yml')
        .reply(200, config)
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

      await probot.receive({name: 'issues', payload, id: 'abc123'});
      requests.done();
    });
  });
});
