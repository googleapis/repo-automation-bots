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

// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import {describe, it, beforeEach} from 'mocha';
import {resolve} from 'path';
import {Octokit} from '@octokit/rest';
import * as fs from 'fs';
import * as sinon from 'sinon';
import nock from 'nock';
import assert from 'assert';
import snapshot from 'snap-shot-it';
import {getConfig} from '@google-automations/bot-config-utils';
import * as gcfUtilsModule from 'gcf-utils';
import {
  ConfigurationOptions,
  DEFAULT_CONFIGURATION,
  WELL_KNOWN_CONFIGURATION_FILE,
} from '../src/config-constants';
import {api} from '../src/release-please';
const fetch = require('node-fetch');
const myProbotApp = api.handler;

nock.disableNetConnect();
const fixturesPath = resolve(__dirname, '../../test/fixtures');
const sandbox = sinon.createSandbox();

const OWNER = 'testOwner';
const REPO = 'testRepo';
const PR_NUMBER = 12;

// Emulate getContent and getBlob.
function createConfigResponse(configFile: string) {
  return createBlobResponse(`config/${configFile}`);
}

function createBlobResponse(configFile: string) {
  const config = fs.readFileSync(resolve(fixturesPath, configFile));
  const base64Config = config.toString('base64');
  return {
    size: base64Config.length,
    content: base64Config,
    encoding: 'base64',
  };
}

// Emulate the config response from Github.
function fetchConfig(configFile: string) {
  return nock('https://api.github.com')
    .get(
      `/repos/${OWNER}/${REPO}/contents/.github%2F${WELL_KNOWN_CONFIGURATION_FILE}`
    )
    .reply(200, createConfigResponse(configFile));
}

const defaultFetchFiles = [
  {
    filename: `.github/${WELL_KNOWN_CONFIGURATION_FILE}`,
    sha: 'testsha',
  },
];

// Emulate the given config file is modified in the PR.
function fetchFilesInPR(configFile: string, files = defaultFetchFiles) {
  return nock('https://api.github.com')
    .get(`/repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/files?per_page=50`)
    .reply(200, files)
    .get(`/repos/${OWNER}/${REPO}/git/blobs/testsha`)
    .reply(200, createConfigResponse(configFile))
    .get(
      `/repos/${OWNER}/${REPO}/contents/.github%2Frelease-please.yml?ref=mockpr`
    )
    .reply(200, createConfigResponse(configFile));
}

describe('release-please bot', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = createProbot({
      overrides: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
        request: {fetch},
      },
    });
    probot.load(myProbotApp);
    sandbox
      .stub(gcfUtilsModule, 'getAuthenticatedOctokit')
      .resolves(new Octokit({auth: 'faketoken', request: {fetch}}));
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('config schema check on PRs', () => {
    const payload = require(resolve(fixturesPath, './pr_opened'));
    it('should not create a failing status check for a correct config', async () => {
      const scope = fetchFilesInPR('java.yml');
      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      scope.done();
    });
    it('should not create a failing status check for a correct config without primaryBranch', async () => {
      const scope = fetchFilesInPR('manifest.yml');
      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      scope.done();
    });
    it('should create a failing status check for a broken config', async () => {
      const scope = fetchFilesInPR('java-broken.yml')
        .post(`/repos/${OWNER}/${REPO}/check-runs`, body => {
          snapshot(body);
          return true;
        })
        .reply(200);
      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      scope.done();
    });
    it('should create a failing status check for broken default manifest configs', async () => {
      const scope = fetchFilesInPR('manifest.yml', [
        {
          filename: `.github/${WELL_KNOWN_CONFIGURATION_FILE}`,
          sha: 'testsha',
        },
        {
          filename: 'release-please-config.json',
          sha: 'configsha',
        },
        {
          filename: '.release-please-manifest.json',
          sha: 'manifestsha',
        },
      ])
        .get(`/repos/${OWNER}/${REPO}/git/blobs/configsha`)
        .reply(200, createBlobResponse('manifest-config/invalid.json'))
        .get(`/repos/${OWNER}/${REPO}/git/blobs/manifestsha`)
        .reply(200, createBlobResponse('manifest/invalid.json'))
        .post(`/repos/${OWNER}/${REPO}/check-runs`, body => {
          snapshot(body);
          return true;
        })
        .twice()
        .reply(200);
      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      scope.done();
    });
    it('should allow valid default manifest configs', async () => {
      const scope = fetchFilesInPR('manifest.yml', [
        {
          filename: `.github/${WELL_KNOWN_CONFIGURATION_FILE}`,
          sha: 'testsha',
        },
        {
          filename: 'release-please-config.json',
          sha: 'configsha',
        },
        {
          filename: '.release-please-manifest.json',
          sha: 'manifestsha',
        },
      ])
        .get(`/repos/${OWNER}/${REPO}/git/blobs/configsha`)
        .reply(200, createBlobResponse('manifest-config/valid.json'))
        .get(`/repos/${OWNER}/${REPO}/git/blobs/manifestsha`)
        .reply(200, createBlobResponse('manifest/valid.json'));
      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      scope.done();
    });
    it('should create a failing status check for broken custom manifest configs', async () => {
      const scope = fetchFilesInPR('manifest_custom_paths.yml', [
        {
          filename: `.github/${WELL_KNOWN_CONFIGURATION_FILE}`,
          sha: 'testsha',
        },
        {
          filename: 'path/to/config.json',
          sha: 'configsha',
        },
        {
          filename: 'path/to/manifest.json',
          sha: 'manifestsha',
        },
      ])
        .get(`/repos/${OWNER}/${REPO}/git/blobs/configsha`)
        .reply(200, createBlobResponse('manifest-config/invalid.json'))
        .get(`/repos/${OWNER}/${REPO}/git/blobs/manifestsha`)
        .reply(200, createBlobResponse('manifest/invalid.json'))
        .post(`/repos/${OWNER}/${REPO}/check-runs`, body => {
          snapshot(body);
          return true;
        })
        .twice()
        .reply(200);
      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      scope.done();
    });
    it('should allow valid custom manifest configs', async () => {
      const scope = fetchFilesInPR('manifest_custom_paths.yml', [
        {
          filename: `.github/${WELL_KNOWN_CONFIGURATION_FILE}`,
          sha: 'testsha',
        },
        {
          filename: 'path/to/config.json',
          sha: 'configsha',
        },
        {
          filename: 'path/to/manifest.json',
          sha: 'manifestsha',
        },
      ])
        .get(`/repos/${OWNER}/${REPO}/git/blobs/configsha`)
        .reply(200, createBlobResponse('manifest-config/valid.json'))
        .get(`/repos/${OWNER}/${REPO}/git/blobs/manifestsha`)
        .reply(200, createBlobResponse('manifest/valid.json'));
      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      scope.done();
    });
  });
});

describe('getConfig', () => {
  const sandbox = sinon.createSandbox();
  const octokit = new Octokit({request: {fetch}});

  beforeEach(() => {});

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  describe('compatibility tests', () => {
    it('should read a simple config', async () => {
      const scope = fetchConfig('valid.yml');
      const config = await getConfig<ConfigurationOptions>(
        octokit,
        OWNER,
        REPO,
        WELL_KNOWN_CONFIGURATION_FILE
      );
      assert.strictEqual(config?.primaryBranch, 'master');
      assert(config?.releaseLabels instanceof Array);
      assert.strictEqual(config?.releaseLabels[0], 'foo');
      assert.strictEqual(config?.releaseLabels[1], 'bar');
      scope.done();
    });
    it('should read a config without primaryBranch', async () => {
      const scope = fetchConfig('manifest.yml');
      const config = await getConfig<ConfigurationOptions>(
        octokit,
        OWNER,
        REPO,
        WELL_KNOWN_CONFIGURATION_FILE
      );
      assert.strictEqual(config?.manifest, true);
      assert.strictEqual(config?.primaryBranch, undefined);
      // Merge with default then it will have primaryBranch.
      const configuration = {
        ...DEFAULT_CONFIGURATION,
        ...config,
      };
      assert.strictEqual(configuration?.primaryBranch, undefined);
      scope.done();
    });
    it('should read a real world java config', async () => {
      const scope = fetchConfig('java.yml');
      const config = await getConfig<ConfigurationOptions>(
        octokit,
        OWNER,
        REPO,
        WELL_KNOWN_CONFIGURATION_FILE
      );
      assert.strictEqual(config?.bumpMinorPreMajor, true);
      assert.strictEqual(config?.handleGHRelease, true);
      assert.strictEqual(config?.releaseType, 'java-yoshi');
      assert(config?.branches instanceof Array);
      assert.strictEqual(config?.branches[0].branch, 'diregapic');
      assert.strictEqual(config?.branches[0].bumpMinorPreMajor, true);
      assert.strictEqual(config?.branches[0].handleGHRelease, true);
      assert.strictEqual(config?.branches[0].releaseType, 'java-yoshi');
      assert.strictEqual(config?.primaryBranch, undefined);
      // Merge with default then it will have primaryBranch.
      const configuration = {
        ...DEFAULT_CONFIGURATION,
        ...config,
      };
      assert.strictEqual(configuration?.primaryBranch, undefined);
      scope.done();
    });
  });
});
