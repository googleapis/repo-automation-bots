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
import * as chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import {describe, it, beforeEach} from 'mocha';
import {Probot, ProbotOctokit} from 'probot';

import {
  getConfig,
  getConfigWithDefault,
  ConfigChecker,
} from '../src/bot-config-utils';
import schema from './test-config-schema.json';

const fixturesPath = resolve(__dirname, '../../test/fixtures');
nock.disableNetConnect();
chai.use(chaiAsPromised);

interface TestConfig {
  testConfig: string;
}
const CONFIG_FILENAME = 'test.yaml';
const CONFIG_FILENAME_YML = 'test.yml';

const defaultConfig: TestConfig = {testConfig: 'defaultValue'};

let configFromConfigChecker: TestConfig | null;

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
      configFromConfigChecker = configChecker.getConfig();
    }
  );
};

// Test app 2
const app2 = (app: Probot) => {
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
        CONFIG_FILENAME_YML
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

function fetchFiles(responseFile: string) {
  const filesResponse = require(resolve(fixturesPath, responseFile));
  return nock('https://api.github.com')
    .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
    .reply(200, filesResponse);
}

function createCheck() {
  return nock('https://api.github.com')
    .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
      snapshot(body);
      return true;
    })
    .reply(200);
}

function fetchFile(responseFile: string) {
  const configResponse = require(resolve(fixturesPath, responseFile));
  return nock('https://api.github.com')
    .get(
      '/repos/tmatsuo/repo-automation-bots/git/blobs/223828dbd668486411b475665ab60855ba9898f3'
    )
    .reply(200, configResponse);
}

describe('config test app with config.yml', () => {
  let probot: Probot;
  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retru: {enabled: false},
        throttle: {enabled: false},
      }),
    });
    probot.load(app2);
  });
  afterEach(() => {
    nock.cleanAll();
  });
  describe('responds to PR', () => {
    it('creates a failing status check for a wrong file name', async () => {
      const payload = require(resolve(fixturesPath, 'pr_event'));

      const scopes = [fetchFiles('wrongFilesResponse2'), createCheck()];

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      for (const scope of scopes) {
        scope.done();
      }
    });
  });
});

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
    // It always start from null.
    configFromConfigChecker = null;
  });
  afterEach(() => {
    nock.cleanAll();
  });
  describe('responds to PR', () => {
    it('does not creates a failing status check for a correct config', async () => {
      const payload = require(resolve(fixturesPath, 'pr_event'));

      const scopes = [
        fetchFiles('filesResponse'),
        fetchFile('correctConfigResponse'),
      ];

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      for (const scope of scopes) {
        scope.done();
      }
      assert.strictEqual(configFromConfigChecker?.testConfig, 'testValue');
    });
    it('creates a failing status check for a wrong config', async () => {
      const payload = require(resolve(fixturesPath, 'pr_event'));

      const scopes = [
        fetchFiles('filesResponse'),
        fetchFile('wrongConfigResponse'),
        createCheck(),
      ];

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      for (const scope of scopes) {
        scope.done();
      }
      assert.strictEqual(configFromConfigChecker, null);
    });
    it('creates a failing status check for broken yaml file', async () => {
      const payload = require(resolve(fixturesPath, 'pr_event'));
      const scopes = [
        fetchFiles('filesResponse'),
        fetchFile('brokenConfigResponse'),
        createCheck(),
      ];
      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      for (const scope of scopes) {
        scope.done();
      }
      assert.strictEqual(configFromConfigChecker, null);
    });
    it('creates a failing status check for a wrong file name', async () => {
      const payload = require(resolve(fixturesPath, 'pr_event'));

      const scopes = [fetchFiles('wrongFilesResponse'), createCheck()];

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      for (const scope of scopes) {
        scope.done();
      }
      assert.strictEqual(configFromConfigChecker, null);
    });
  });
});

function getConfigFile(
  filename: string,
  owner: string,
  repo: string,
  status: number,
  responseFile?: string
) {
  const response = {
    name: '',
    path: '',
    sha: '',
    size: 48,
    url: '',
    html_url: '',
    git_url: '',
    download_url: '',
    type: 'file',
    content: '',
    encoding: 'base64',
    _links: {
      self: '',
      git: '',
      html: '',
    },
  };
  if (status === 200) {
    if (responseFile) {
      const config = fs.readFileSync(resolve(fixturesPath, responseFile));
      const content = config.toString('base64');
      response.name = responseFile;
      response.path = `.github/${responseFile}`;
      response.content = content;
      response.size = content.length;
      return nock('https://api.github.com')
        .get(`/repos/${owner}/${repo}/contents/.github%2F${filename}`)
        .reply(200, response);
    } else {
      throw Error('responseFile is needed for status 200');
    }
  } else {
    return nock('https://api.github.com')
      .get(`/repos/${owner}/${repo}/contents/.github%2F${filename}`)
      .reply(status);
  }
}

describe('config', () => {
  const octokit = new ProbotOctokit(
    ProbotOctokit.defaults({
      retry: {enabled: false},
      throttle: {enabled: false},
    })
  );

  beforeEach(() => {});

  describe('getConfig', () => {
    it('fetch the config file from the repo', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 200, 'config.yaml'),
      ];

      const fetchedConfig = await getConfig<TestConfig>(
        octokit,
        owner,
        repo,
        filename
      );
      assert.strictEqual(fetchedConfig?.testConfig, 'testValue');
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('throws an error upon non 404 errors', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [getConfigFile('flakybot.yaml', owner, repo, 403)];

      await chai
        .expect(getConfig<TestConfig>(octokit, owner, repo, filename))
        .to.be.rejectedWith(Error);
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('fetch the config file from the org .github repo', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 404),
        getConfigFile('flakybot.yaml', owner, '.github', 200, 'config.yaml'),
      ];

      const fetchedConfig = await getConfig<TestConfig>(
        octokit,
        owner,
        repo,
        filename
      );
      assert.strictEqual(fetchedConfig?.testConfig, 'testValue');
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('returns null when there is no config file', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 404),
        getConfigFile('flakybot.yaml', owner, '.github', 404),
      ];

      const fetchedConfig = await getConfig<TestConfig>(
        octokit,
        owner,
        repo,
        filename
      );
      assert.strictEqual(fetchedConfig, null);
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('throws an error upon non 404 errors for the org config', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 404),
        getConfigFile('flakybot.yaml', owner, '.github', 403),
      ];

      await chai
        .expect(getConfig<TestConfig>(octokit, owner, repo, filename))
        .to.be.rejectedWith(Error);
      for (const scope of scopes) {
        scope.done();
      }
    });
  });
  describe('getConfigWithDefault', () => {
    it('fetch the config file from the repo', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 200, 'config.yaml'),
      ];

      const fetchedConfig = await getConfigWithDefault<TestConfig>(
        octokit,
        owner,
        repo,
        filename,
        defaultConfig
      );
      assert.strictEqual(fetchedConfig?.testConfig, 'testValue');
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('throws an error upon non 404 errors', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [getConfigFile('flakybot.yaml', owner, repo, 403)];

      await chai
        .expect(
          getConfigWithDefault<TestConfig>(
            octokit,
            owner,
            repo,
            filename,
            defaultConfig
          )
        )
        .to.be.rejectedWith(Error);
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('fetch the config file from the org .github repo', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 404),
        getConfigFile('flakybot.yaml', owner, '.github', 200, 'config.yaml'),
      ];

      const fetchedConfig = await getConfigWithDefault<TestConfig>(
        octokit,
        owner,
        repo,
        filename,
        defaultConfig
      );
      assert.strictEqual(fetchedConfig?.testConfig, 'testValue');
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('fetch the config file from the default config', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 404),
        getConfigFile('flakybot.yaml', owner, '.github', 404),
      ];

      const fetchedConfig = await getConfigWithDefault<TestConfig>(
        octokit,
        owner,
        repo,
        filename,
        defaultConfig
      );
      assert.strictEqual(fetchedConfig?.testConfig, 'defaultValue');
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('throws an error upon non 404 errors for the org config', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 404),
        getConfigFile('flakybot.yaml', owner, '.github', 403),
      ];

      await chai
        .expect(
          getConfigWithDefault<TestConfig>(
            octokit,
            owner,
            repo,
            filename,
            defaultConfig
          )
        )
        .to.be.rejectedWith(Error);
      for (const scope of scopes) {
        scope.done();
      }
    });
  });
});
