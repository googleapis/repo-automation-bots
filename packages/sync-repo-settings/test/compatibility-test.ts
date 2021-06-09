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

import {describe, it, beforeEach, afterEach} from 'mocha';
import {resolve} from 'path';
import nock from 'nock';
import assert from 'assert';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import * as fs from 'fs';
import * as sinon from 'sinon';
import snapshot from 'snap-shot-it';
import {getConfig} from '@google-automations/bot-config-utils';

import {handler} from '../src/bot';
import {CONFIG_FILE_NAME} from '../src/config';
import {RepoConfig} from '../src/types';
import schema from '../src/schema.json';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

const OWNER = 'testOwner';
const REPO = 'testRepo';
const PR_NUMBER = 12;

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

// Emulate the config response from Github.
function fetchConfig(configFile: string) {
  return nock('https://api.github.com')
    .get(`/repos/${OWNER}/${REPO}/contents/.github%2F${CONFIG_FILE_NAME}`)
    .reply(200, createConfigResponse(configFile));
}

// Emulate the given config file is modified in the PR.
function fetchFilesInPR(configFile: string) {
  return nock('https://api.github.com')
    .get(`/repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/files?per_page=100`)
    .reply(200, [
      {
        filename: `.github/${CONFIG_FILE_NAME}`,
        sha: 'testsha',
      },
    ])
    .get(`/repos/${OWNER}/${REPO}/git/blobs/testsha`)
    .reply(200, createConfigResponse(configFile));
}

describe('Sync repo settings', () => {
  const sandbox = sinon.createSandbox();
  let probot: Probot;
  const payload = require(resolve(fixturesPath, './pr_opened'));
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
    probot.load(handler);
  });
  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });
  it('should not create a failing status check for a real world config(java)', async () => {
    const scope = fetchFilesInPR('java.yml');
    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    scope.done();
  });
  it('should not create a failing status check for a real world config(python)', async () => {
    const scope = fetchFilesInPR('python.yml');
    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    scope.done();
  });
  it('should not create a failing status check for a real world config(python library)', async () => {
    const scope = fetchFilesInPR('python-library.yml');
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
});

describe('getConfig', () => {
  const octokit = new Octokit();

  afterEach(() => {
    nock.cleanAll();
  });
  describe('compatibility tests', () => {
    it('should read a real world config(java)', async () => {
      const scope = fetchConfig('java.yml');
      const config = await getConfig<RepoConfig>(
        octokit,
        OWNER,
        REPO,
        CONFIG_FILE_NAME,
        {fallbackToOrgConfig: false, schema: schema}
      );
      scope.done();
      assert.strictEqual(config!.rebaseMergeAllowed, false);
      assert.strictEqual(config!.squashMergeAllowed, true);
      assert.strictEqual(config!.branchProtectionRules![0].pattern, 'master');
      assert.strictEqual(
        config!.branchProtectionRules![0].isAdminEnforced,
        true
      );
      assert.strictEqual(
        config!.branchProtectionRules![0].requiredStatusCheckContexts![0],
        'dependencies (8)'
      );
    });
    it('should read a real world config(python)', async () => {
      const scope = fetchConfig('python.yml');
      const config = await getConfig<RepoConfig>(
        octokit,
        OWNER,
        REPO,
        CONFIG_FILE_NAME,
        {fallbackToOrgConfig: false, schema: schema}
      );
      scope.done();
      assert.strictEqual(config!.rebaseMergeAllowed, true);
      assert.strictEqual(config!.squashMergeAllowed, true);
      assert.strictEqual(config!.branchProtectionRules![0].pattern, 'master');
      assert.strictEqual(
        config!.branchProtectionRules![0].isAdminEnforced,
        false
      );
      assert.strictEqual(
        config!.branchProtectionRules![0].requiredStatusCheckContexts![0],
        'Kokoro CI - Lint'
      );
    });
  });
});
