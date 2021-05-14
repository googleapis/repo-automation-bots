// Copyright 2021 Google LLC
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

import {resolve} from 'path';
import nock from 'nock';
import * as fs from 'fs';
import snapshot from 'snap-shot-it';
import * as assert from 'assert';
import {describe, it, beforeEach} from 'mocha';
import {Probot, ProbotOctokit} from 'probot';

import {Config} from '../src/flakybot';
import {getConfig, ConfigChecker} from '../src/config';

const fixturesPath = resolve(__dirname, '../../test/fixtures');
nock.disableNetConnect();

interface TestConfig {
  testConfig: string;
}
const CONFIG_FILENAME = 'test.yaml';
import schema from './test-config-schema.json';

// Test app
const app = (app: Probot) => {
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.edited',
      'pull_request.synchronize',
    ],
    async context => {
      const configChecker = new ConfigChecker<TestConfig>(
        schema,
        CONFIG_FILENAME
      );
      await configChecker.validateConfigChanges(
        context.octokit,
        context.payload.pull_request.head.user.login,
        context.payload.repository.name,
        context.payload.pull_request.head.sha,
        context.payload.pull_request.number
      );
    }
  );
};

describe('config test app', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retru: {enabled: false},
        throttle: {enabled: false},
      }),
    });
    probot.load(app);
  });

  afterEach(() => {
    nock.cleanAll();
  });
  describe('responds to PR', () => {
    it('does not creates a failing status check for a correct config', async () => {
      const payload = require(resolve(fixturesPath, 'pr_event'));
      const filesResponse = require(resolve(fixturesPath, 'filesResponse'));
      const configResponse = require(resolve(
        fixturesPath,
        'correctConfigResponse'
      ));
      const scope = nock('https://api.github.com')
        .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
        .reply(200, filesResponse)
        .get(
          '/repos/tmatsuo/repo-automation-bots/git/blobs/223828dbd668486411b475665ab60855ba9898f3'
        )
        .reply(200, configResponse);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      scope.done();
    });
    it('creates a failing status check for a wrong config', async () => {
      const payload = require(resolve(fixturesPath, 'pr_event'));
      const filesResponse = require(resolve(fixturesPath, 'filesResponse'));
      const configResponse = require(resolve(
        fixturesPath,
        'wrongConfigResponse'
      ));
      const scope = nock('https://api.github.com')
        .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
        .reply(200, filesResponse)
        .get(
          '/repos/tmatsuo/repo-automation-bots/git/blobs/223828dbd668486411b475665ab60855ba9898f3'
        )
        .reply(200, configResponse)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
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
    });
    it('creates a failing status check for a wrong file name', async () => {
      const payload = require(resolve(fixturesPath, 'pr_event'));
      const filesResponse = require(resolve(
        fixturesPath,
        'wrongFilesResponse'
      ));
      const scope = nock('https://api.github.com')
        .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
        .reply(200, filesResponse)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
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
    });
  });
});

describe('config', () => {
  const octokit = new ProbotOctokit(
    ProbotOctokit.defaults({
      retry: {enabled: false},
      throttle: {enabled: false},
    })
  );
  const config = fs.readFileSync(
    resolve(fixturesPath, 'testdata', 'config.yaml')
  );

  beforeEach(() => {});

  describe('getConfig', () => {
    it('fetch the config file from the repo', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scope = nock('https://api.github.com')
        .get(
          '/repos/googleapis/repo-automation-bots/contents/.github%2Fflakybot.yaml'
        )
        .reply(200, Buffer.from(config).toString('base64'));

      const fetchedConfig = await getConfig<Config>(
        octokit,
        owner,
        repo,
        filename
      );
      assert.strictEqual(fetchedConfig?.issuePriority, 'p2');
      scope.done();
    });
    it('fetch the config file from the org .github repo', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scope = nock('https://api.github.com')
        .get(
          '/repos/googleapis/repo-automation-bots/contents/.github%2Fflakybot.yaml'
        )
        .reply(404)
        .get('/repos/googleapis/.github/contents/.github%2Fflakybot.yaml')
        .reply(200, Buffer.from(config).toString('base64'));

      const fetchedConfig = await getConfig<Config>(
        octokit,
        owner,
        repo,
        filename
      );
      assert.strictEqual(fetchedConfig?.issuePriority, 'p2');
      scope.done();
    });
  });
});
