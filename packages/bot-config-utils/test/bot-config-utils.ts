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
// eslint-disable-next-line node/no-extraneous-import
import {Probot, ProbotOctokit} from 'probot';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';

import {
  getConfig,
  getConfigWithDefault,
  ConfigChecker,
} from '../src/bot-config-utils';
import schema from './test-config-schema.json';
import listSchema from './test-config-use-external-id.json';

const fixturesPath = resolve(__dirname, '../../test/fixtures');

interface TestConfig {
  testConfig: string;
}

interface ListConfig {
  [index: number]: TestConfig;
}
const CONFIG_FILENAME = 'test.yaml';
const CONFIG_FILENAME_YML = 'test.yml';

const defaultConfig: TestConfig = {testConfig: 'defaultValue'};

let configFromConfigChecker: TestConfig | null;
let listConfigFromConfigChecker: ListConfig | null;

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

// Test app with multiple schema files.
const app3 = (app: Probot) => {
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.edited',
      'pull_request.synchronize',
    ],
    async context => {
      const configChecker = new ConfigChecker<ListConfig>(
        listSchema,
        CONFIG_FILENAME,
        [schema]
      );
      await configChecker.validateConfigChanges(
        context.octokit,
        context.payload.pull_request.head.user.login,
        context.payload.repository.name,
        context.payload.pull_request.head.sha,
        context.payload.pull_request.number
      );
      listConfigFromConfigChecker = configChecker.getConfig();
    }
  );
};

function createCheck() {
  return nock('https://api.github.com')
    .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
      snapshot(body);
      return true;
    })
    .reply(200);
}

// Emulate getContent and getBlob.
function createConfigResponse(configFile: string) {
  const config = fs.readFileSync(resolve(fixturesPath, configFile));
  const base64Config = config.toString('base64');
  return {
    size: base64Config.length,
    content: base64Config,
    encoding: 'base64',
  };
}

// Emulate fetching the file list.
function fetchFileList(fileName: string) {
  return nock('https://api.github.com')
    .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
    .reply(200, [
      {
        filename: `.github/${fileName}`,
        sha: 'testsha',
      },
    ]);
}

// Emulate the given config file is modified in the PR.
function fetchFilesInPR(configFile: string, fileName: string) {
  return nock('https://api.github.com')
    .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
    .reply(200, [
      {
        filename: `.github/${fileName}`,
        sha: 'testsha',
      },
    ])
    .get('/repos/tmatsuo/repo-automation-bots/git/blobs/testsha')
    .reply(200, createConfigResponse(configFile));
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
  beforeEach(() => {
    nock.disableNetConnect();
  });
  afterEach(() => {
    nock.cleanAll();
  });
  describe('responds to PR', () => {
    it('creates a failing status check for a wrong file name', async () => {
      const payload = require(resolve(fixturesPath, 'pr_event'));

      const scopes = [fetchFileList(CONFIG_FILENAME), createCheck()];

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
    nock.disableNetConnect();
  });
  afterEach(() => {
    nock.cleanAll();
  });
  describe('responds to PR', () => {
    it('does not die upon 404 github api responses', async () => {
      const payload = require(resolve(fixturesPath, 'pr_event'));

      const scope = nock('https://api.github.com')
        .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
        .reply(404);
      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      scope.done();
      assert.strictEqual(configFromConfigChecker, null);
    });
    it('does not creates a failing status check for a correct config', async () => {
      const payload = require(resolve(fixturesPath, 'pr_event'));

      const scopes = [fetchFilesInPR('config.yaml', CONFIG_FILENAME)];

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
        fetchFilesInPR('wrong.yaml', CONFIG_FILENAME),
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
        fetchFilesInPR('broken.yaml', CONFIG_FILENAME),
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

      const scopes = [fetchFileList(CONFIG_FILENAME_YML), createCheck()];

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

describe('config test app with multiple schema files', () => {
  let probot: Probot;
  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retru: {enabled: false},
        throttle: {enabled: false},
      }),
    });
    probot.load(app3);
    // It always start from null.
    listConfigFromConfigChecker = null;
    nock.disableNetConnect();
  });
  afterEach(() => {
    nock.cleanAll();
  });
  describe('responds to PR', () => {
    it('does not creates a failing status check for a correct config', async () => {
      const payload = require(resolve(fixturesPath, 'pr_event'));

      const scopes = [fetchFilesInPR('list-config.yaml', CONFIG_FILENAME)];

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      for (const scope of scopes) {
        scope.done();
      }
      assert.strictEqual(
        listConfigFromConfigChecker![0].testConfig,
        'testValue'
      );
    });
    it('creates a failing status check for a wrong config', async () => {
      const payload = require(resolve(fixturesPath, 'pr_event'));

      const scopes = [
        fetchFilesInPR('config.yaml', CONFIG_FILENAME),
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
  });
});

function getConfigFile(
  filename: string,
  owner: string,
  repo: string,
  status: number,
  responseFile?: string,
  branch?: string
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
  const ref = branch ? `?ref=${branch}` : '';

  if (status === 200) {
    if (responseFile) {
      const config = fs.readFileSync(resolve(fixturesPath, responseFile));
      const content = config.toString('base64');
      response.name = responseFile;
      response.path = `.github/${responseFile}`;
      response.content = content;
      response.size = content.length;
      return nock('https://api.github.com')
        .get(`/repos/${owner}/${repo}/contents/.github%2F${filename}${ref}`)
        .reply(200, response);
    } else {
      throw Error('responseFile is needed for status 200');
    }
  } else {
    return nock('https://api.github.com')
      .get(`/repos/${owner}/${repo}/contents/.github%2F${filename}${ref}`)
      .reply(status);
  }
}

describe('config', () => {
  const octokit = new Octokit({auth: '123'});

  describe('getConfig', () => {
    beforeEach(() => {
      nock.disableNetConnect();
    });

    afterEach(() => {
      nock.cleanAll();
    });
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
    it('fetch an empty config file from the repo', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 200, 'empty.yaml'),
      ];

      const fetchedConfig = await getConfig<TestConfig>(
        octokit,
        owner,
        repo,
        filename
      );
      assert.strictEqual(fetchedConfig?.testConfig, undefined);
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('fetch the config file from a branch', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';
      const branch = 'testBranch';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 200, 'config.yaml', branch),
      ];

      const fetchedConfig = await getConfig<TestConfig>(
        octokit,
        owner,
        repo,
        filename,
        {branch: branch}
      );
      assert.strictEqual(fetchedConfig?.testConfig, 'testValue');
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('fetch the config file from the repo with a schema', async () => {
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
        filename,
        {schema: schema}
      );
      assert.strictEqual(fetchedConfig?.testConfig, 'testValue');
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('throws an error when the config validation failed', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 200, 'wrong.yaml'),
      ];

      await assert.rejects(
        getConfig<TestConfig>(octokit, owner, repo, filename, {
          schema: schema,
        }),
        Error
      );

      for (const scope of scopes) {
        scope.done();
      }
    });
    it('throws an error upon non 404 errors', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [getConfigFile('flakybot.yaml', owner, repo, 403)];

      await assert.rejects(
        getConfig<TestConfig>(octokit, owner, repo, filename),
        Error
      );
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('stops after the first 404 with an option', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [getConfigFile('flakybot.yaml', owner, repo, 404)];

      const fetchedConfig = await getConfig<TestConfig>(
        octokit,
        owner,
        repo,
        filename,
        {fallbackToOrgConfig: false}
      );
      assert.strictEqual(fetchedConfig, null);
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
    it('throws an error when the config validation failed for org config', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 404),
        getConfigFile('flakybot.yaml', owner, '.github', 200, 'wrong.yaml'),
      ];

      await assert.rejects(
        getConfig<TestConfig>(octokit, owner, repo, filename, {
          schema: schema,
        }),
        Error
      );
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
    it('throws an error upon non 401/403/404 errors for the org config', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 404),
        getConfigFile('flakybot.yaml', owner, '.github', 502),
      ];

      await assert.rejects(
        getConfig<TestConfig>(octokit, owner, repo, filename),
        Error
      );
      for (const scope of scopes) {
        scope.done();
      }
    });
  });
  describe('getConfigWithDefault', () => {
    beforeEach(() => {
      nock.disableNetConnect();
    });

    afterEach(() => {
      nock.cleanAll();
    });
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
    it('fetch an empty config file from the repo with a schema', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 200, 'empty.yaml'),
      ];

      const fetchedConfig = await getConfigWithDefault<TestConfig>(
        octokit,
        owner,
        repo,
        filename,
        defaultConfig,
        {schema: schema}
      );
      assert.strictEqual(fetchedConfig?.testConfig, 'defaultValue');
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('fetch the config file from a branch', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';
      const branch = 'testBranch';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 200, 'config.yaml', branch),
      ];

      const fetchedConfig = await getConfigWithDefault<TestConfig>(
        octokit,
        owner,
        repo,
        filename,
        defaultConfig,
        {branch: branch}
      );
      assert.strictEqual(fetchedConfig?.testConfig, 'testValue');
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('fetch the config file from the repo with a schema', async () => {
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
        defaultConfig,
        {schema: schema}
      );
      assert.strictEqual(fetchedConfig?.testConfig, 'testValue');
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('throws an error when the config validation failed', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 200, 'wrong.yaml'),
      ];

      await assert.rejects(
        getConfigWithDefault<TestConfig>(
          octokit,
          owner,
          repo,
          filename,
          defaultConfig,
          {schema: schema}
        ),
        Error
      );

      for (const scope of scopes) {
        scope.done();
      }
    });
    it('throws an error upon non 404 errors', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [getConfigFile('flakybot.yaml', owner, repo, 403)];

      await assert.rejects(
        getConfigWithDefault<TestConfig>(
          octokit,
          owner,
          repo,
          filename,
          defaultConfig
        ),
        Error
      );
      for (const scope of scopes) {
        scope.done();
      }
    });
    it('stops after the first 404 with an option', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [getConfigFile('flakybot.yaml', owner, repo, 404)];

      const fetchedConfig = await getConfigWithDefault<TestConfig>(
        octokit,
        owner,
        repo,
        filename,
        defaultConfig,
        {fallbackToOrgConfig: false}
      );
      assert.strictEqual(fetchedConfig?.testConfig, 'defaultValue');
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
    it('throws an error when the config validation failed or org config', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 404),
        getConfigFile('flakybot.yaml', owner, '.github', 200, 'wrong.yaml'),
      ];

      await assert.rejects(
        getConfigWithDefault<TestConfig>(
          octokit,
          owner,
          repo,
          filename,
          defaultConfig,
          {schema: schema}
        ),
        Error
      );

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
    it('throws an error upon non 401/403/404 errors for the org config', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const filename = 'flakybot.yaml';

      const scopes = [
        getConfigFile('flakybot.yaml', owner, repo, 403),
        getConfigFile('flakybot.yaml', owner, '.github', 502),
      ];

      await assert.rejects(
        getConfigWithDefault<TestConfig>(
          octokit,
          owner,
          repo,
          filename,
          defaultConfig
        ),
        Error
      );
      for (const scope of scopes) {
        scope.done();
      }
    });
  });
});
