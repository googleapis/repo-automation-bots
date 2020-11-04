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
//

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable node/no-extraneous-import */

import myProbotApp from '../src/snippet-bot';

import {resolve} from 'path';
import {Probot, createProbot} from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';
import assert from 'assert';
import {describe, it, beforeEach, afterEach} from 'mocha';

// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {config} from '@probot/octokit-plugin-config';
const TestingOctokit = Octokit.plugin(config);

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('snippet-bot', () => {
  let probot: Probot;

  const config = fs.readFileSync(
    resolve(fixturesPath, 'config', 'valid-config.yml')
  );

  const tarBall = fs.readFileSync(
    resolve(fixturesPath, 'tmatsuo-python-docs-samples-abcde.tar.gz')
  );

  const diffResponse = fs.readFileSync(resolve(fixturesPath, 'diff.txt'));

  beforeEach(() => {
    probot = createProbot({
      githubToken: 'abc123',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Octokit: TestingOctokit as any,
    });
    probot.load(myProbotApp);
  });

  afterEach(() => {
    nock.cleanAll();
  });

  describe('reads the config file', () => {
    it('confirms the value in the config file', async () => {
      assert(config.toString().includes('ignore.py'));
    });
  });

  describe('responds to PR', () => {
    it('quits early', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(fixturesPath, './pr_event'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/.github%2Fsnippet-bot.yml'
        )
        .reply(200, config)
        .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
        .reply(404, {});

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
    });

    it('sets a "failure" context on PR', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const changedFiles = require(resolve(fixturesPath, './pr_files_added'));
      const payload = require(resolve(fixturesPath, './pr_event'));
      const blob = require(resolve(fixturesPath, './failure_blob'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/.github%2Fsnippet-bot.yml'
        )
        .reply(200, config)
        .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
        .reply(200, changedFiles)
        .get(
          '/repos/tmatsuo/repo-automation-bots/git/blobs/223828dbd668486411b475665ab60855ba9898f3'
        )
        .reply(200, blob)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments?per_page=50'
        )
        .reply(200, [])
        .post(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, diffResponse);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
      diffRequests.done();
    });

    it('quits early for normal labels', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(
        fixturesPath,
        './pr_event_label_ignored'
      ));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/.github%2Fsnippet-bot.yml'
        )
        .reply(200, config);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
    });

    it('responds to snippet-bot:force-run label', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const changedFiles = require(resolve(fixturesPath, './pr_files_added'));
      const payload = require(resolve(fixturesPath, './pr_event_label_added'));
      const blob = require(resolve(fixturesPath, './failure_blob'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/.github%2Fsnippet-bot.yml'
        )
        .reply(200, config)
        .delete(
          // For removing the label.
          '/repos/tmatsuo/repo-automation-bots/issues/14/labels/snippet-bot%3Aforce-run'
        )
        .reply(200)
        .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
        .reply(200, changedFiles)
        .get(
          '/repos/tmatsuo/repo-automation-bots/git/blobs/223828dbd668486411b475665ab60855ba9898f3'
        )
        .reply(200, blob)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments?per_page=50'
        )
        .reply(200, [])
        .post(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, diffResponse);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
      diffRequests.done();
    });

    it('does not submit a check on PR if there are no region tags', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const changedFiles = require(resolve(fixturesPath, './pr_files_added'));
      const payload = require(resolve(fixturesPath, './pr_event'));
      const blob = require(resolve(fixturesPath, './blob_no_region_tags'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/.github%2Fsnippet-bot.yml'
        )
        .reply(200, config)
        .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
        .reply(200, changedFiles)
        .get(
          '/repos/tmatsuo/repo-automation-bots/git/blobs/223828dbd668486411b475665ab60855ba9898f3'
        )
        .reply(200, blob);
      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, '');

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
      diffRequests.done();
    });

    it('exits early when it failed to read the config', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(fixturesPath, './pr_event'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/.github%2Fsnippet-bot.yml'
        )
        .reply(403, {content: 'Permission denied'});

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
    });

    it('does not submit a check on PR by ignoreFile', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const changedFiles = require(resolve(fixturesPath, './pr_files_added'));
      const payload = require(resolve(fixturesPath, './pr_event'));

      const ignoreConfig = fs.readFileSync(
        resolve(fixturesPath, 'config', 'ignore-config.yml')
      );

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/.github%2Fsnippet-bot.yml'
        )
        .reply(200, ignoreConfig)
        .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
        .reply(200, changedFiles);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, '');

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
      diffRequests.done();
    });

    it('does not submit a check on PR because the file was just deleted', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const changedFiles = require(resolve(fixturesPath, './pr_files_deleted'));
      const payload = require(resolve(fixturesPath, './pr_event'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/.github%2Fsnippet-bot.yml'
        )
        .reply(200, config)
        .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
        .reply(200, changedFiles);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, '');

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
      diffRequests.done();
    });

    it('quits early if there is no config file', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(fixturesPath, './pr_event'));

      // probot tries to fetch the org's config too.
      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/.github%2Fsnippet-bot.yml'
        )
        .reply(404, 'Not Found')
        .get('/repos/tmatsuo/.github/contents/.github%2Fsnippet-bot.yml')
        .reply(404, 'Not Found');

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
    });
  });

  describe('responds to issue', () => {
    it('quits early because issue title does not contain the command', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(fixturesPath, './issue_event_no_scan'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/python-docs-samples/contents/.github%2Fsnippet-bot.yml'
        )
        .reply(200, config);

      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });

      requests.done();
    });
    it('reports failure upon download failure', async () => {
      const payload = require(resolve(fixturesPath, './issue_event'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/python-docs-samples/contents/.github%2Fsnippet-bot.yml'
        )
        .reply(200, config)
        .patch('/repos/tmatsuo/python-docs-samples/issues/10', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      const tarBallRequests = nock('https://github.com')
        .get('/tmatsuo/python-docs-samples/tarball/master')
        .reply(403, 'Error');

      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });

      requests.done();
      tarBallRequests.done();
    });
    it('reports the scan result', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(fixturesPath, './issue_event'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/python-docs-samples/contents/.github%2Fsnippet-bot.yml'
        )
        .reply(200, config)
        .patch('/repos/tmatsuo/python-docs-samples/issues/10', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      const tarBallRequests = nock('https://github.com')
        .get('/tmatsuo/python-docs-samples/tarball/master')
        .reply(200, tarBall, {
          'Content-Type': 'application/tar+gzip',
        });

      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });

      requests.done();
      tarBallRequests.done();
    });
  });
});
