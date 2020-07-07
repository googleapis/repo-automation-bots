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

import handler from '../src/blunderbuss';
import {describe, it, beforeEach, after} from 'mocha';
import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

// TODO: stop disabling warn once the following upstream patch is landed:
// https://github.com/probot/probot/pull/926
global.console.warn = () => {};

const originalSleep = handler.sleep;

describe('Blunderbuss', () => {
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
    handler.sleep = () => {
      return new Promise(resolve => setTimeout(resolve, 0));
    };
    probot.load(handler);
  });

  after(() => {
    handler.sleep = originalSleep;
  });

  describe('issue tests', () => {
    it('assigns opened issues with no assignees', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_no_assignees'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, {content: config.toString('base64')})
        .post('/repos/testOwner/testRepo/issues/5/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores opened issues when with assignee(s)', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_opened_with_assignees'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, {content: config.toString('base64')});

      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
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
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, {content: config.toString('base64')});

      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      requests.done();
    });

    it('assigns issue when correct label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_correct_label'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, {content: config.toString('base64')})
        .delete(
          '/repos/testOwner/testRepo/issues/4/labels/' +
            encodeURI('blunderbuss: assign')
        )
        .reply(200, {})
        .post('/repos/testOwner/testRepo/issues/4/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'issues.labeled', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores issue when wrong label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_wrong_label'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, {content: config.toString('base64')});

      await probot.receive({name: 'issues.labeled', payload, id: 'abc123'});
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
        .get('/repos/testOwner/.github/contents/.github/blunderbuss.yml')
        .reply(404, {})
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(404, {});
      await probot.receive({name: 'issues.labeled', payload, id: 'abc123'});
      requests.done();
    });

    it('assigns blunderbuss labeled issue by label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_correct_label'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'on_label.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, {content: config.toString('base64')})
        .delete(
          '/repos/testOwner/testRepo/issues/4/labels/' +
            encodeURI('blunderbuss: assign')
        )
        .reply(200, {})
        .post('/repos/testOwner/testRepo/issues/4/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get('/repos/testOwner/testRepo/issues/4/labels')
        .reply(200, [
          {
            id: 1515750275,
            node_id: 'MDU6TGFiZWwxNTE1NzUwMjc1',
            url:
              'https://api.github.com/repos/testOwner/testRepo/labels/blunderbuss:%20assign',
            name: 'blunderbuss: assign',
            color: 'f9d0c4',
            default: false,
          },
          {
            id: 1234,
            node_id: 'abc',
            url:
              'https://api.github.com/repos/testOwner/testRepo/labels/api:%20bar',
            name: 'api: bar',
            color: 'f9d0c4',
            default: false,
          },
        ]);

      await probot.receive({name: 'issues.labeled', payload, id: 'abc123'});
      requests.done();
    });

    it('assigns opened issue by label', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/issue_opened_no_assignees'
      ));
      payload.issue.labels = [{name: 'api: foo'}];
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'on_label.yml')
      );
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, {content: config.toString('base64')})
        .post('/repos/testOwner/testRepo/issues/5/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get('/repos/testOwner/testRepo/issues/5/labels')
        .reply(200, [{name: 'api: foo'}]);

      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      requests.done();
    });

    it('assigns labeled issue by label', async () => {
      const payload = require(resolve(fixturesPath, 'events', 'issue_labeled'));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'on_label.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, {content: config.toString('base64')})
        .post('/repos/testOwner/testRepo/issues/4/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get('/repos/testOwner/testRepo/issues/4/labels')
        .reply(200, [
          {
            id: 1515750275,
            node_id: 'MDU6TGFiZWwxNTE1NzUwMjc1',
            url:
              'https://api.github.com/repos/testOwner/testRepo/labels/blunderbuss:%20assign',
            name: 'api: baz',
            color: 'f9d0c4',
            default: false,
          },
        ]);

      await probot.receive({name: 'issues.labeled', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores labeled issues when with assignee(s)', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_labeled_with_assignees'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'on_label.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, {content: config.toString('base64')});

      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      requests.done();
    });
  });

  describe('pr tests', () => {
    it('assigns user to a PR when opened with no assignee', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_no_assignees'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, {content: config.toString('base64')})
        .post('/repos/testOwner/testRepo/issues/6/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('assigns user to a PR when opened with no assignee, ignoring assign_issues_by', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_no_assignees'
      ));
      payload.pull_request.labels = [{name: 'api: foo'}];
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'on_label.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, {content: config.toString('base64')})
        .post('/repos/testOwner/testRepo/issues/6/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request.opened',
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
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, {content: config.toString('base64')});

      await probot.receive({
        name: 'pull_request.opened',
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
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, {content: config.toString('base64')});

      await probot.receive({
        name: 'pull_request.opened',
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
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, {content: config.toString('base64')})
        .delete(
          '/repos/testOwner/testRepo/issues/6/labels/' +
            encodeURI('blunderbuss: assign')
        )
        .reply(200, {})
        .post('/repos/testOwner/testRepo/issues/6/assignees', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'issues.labeled', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores pr when wrong label', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_wrong_label'
      ));
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid.yml')
      );

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(200, {content: config.toString('base64')});

      await probot.receive({
        name: 'pull_request.labeled',
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
        .get('/repos/testOwner/testRepo/contents/.github/blunderbuss.yml')
        .reply(404, {})
        .get('/repos/testOwner/.github/contents/.github/blunderbuss.yml')
        .reply(404, {});

      await probot.receive({
        name: 'pull_request.labeled',
        payload,
        id: 'abc123',
      });
      requests.done();
    });
  });
});
