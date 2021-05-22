// Copyright 2021 Google LLC
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

// eslint-disable-next-line node/no-extraneous-import
import {Context, Probot, createProbot, ProbotOctokit} from 'probot';
import {Octokit} from '@octokit/rest';
import {describe, it, beforeEach, afterEach} from 'mocha';
import nock from 'nock';
import * as assert from 'assert';
import {resolve} from 'path';
import fs from 'fs';
import * as sinon from 'sinon';
import snapshot from 'snap-shot-it';
import {handler} from '../src/auto-label';
import * as botConfigModule from '@google-automations/bot-config-utils';
import {ConfigChecker} from '@google-automations/bot-config-utils';
import * as helper from '../src/helper';

nock.disableNetConnect();
const sandbox = sinon.createSandbox();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

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
    .get(
      `/repos/testOwner/testRepo/contents/.github%2F${helper.CONFIG_FILE_NAME}`
    )
    .reply(200, createConfigResponse(configFile));
}

function fetchFilesInPR(configFile: string) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/pulls/12/files?per_page=100')
    .reply(200, [
      {
        filename: `.github/${helper.CONFIG_FILE_NAME}`,
        sha: 'testsha',
      },
    ])
    .get('/repos/testOwner/testRepo/git/blobs/testsha')
    .reply(200, createConfigResponse(configFile));
}

describe('getConfigWithDefault', () => {
  let probot: Probot;
  let validateConfigStub: sinon.SinonStub;
  let autoLabelOnPRStub: sinon.SinonStub;

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
    validateConfigStub = sandbox.stub(
      ConfigChecker.prototype,
      'validateConfigChanges'
    );
    validateConfigStub.resolves();
    autoLabelOnPRStub = sandbox.stub(handler, 'autoLabelOnPR');
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('compatibility tests', () => {
    it('fetches a simple config correctly', async () => {
      const scope = fetchConfig('valid-config.yml');
      const payload = require(resolve(fixturesPath, './events/pr_opened'));
      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      scope.done();
      validateConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'testOwner',
        'testRepo',
        '19f6a66851125917fa07615dcbc0cd13dad56981',
        12
      );
      autoLabelOnPRStub.calledOnceWith(
        sinon.match.instanceOf(Context),
        'testOwner',
        'testRepo',
        sinon.match.any
      );
      const config = autoLabelOnPRStub.getCall(0).args[3];
      assert.strictEqual(config.product, true);
    });
    it('fetches a real world config correctly(cloud-ops-sandbox)', async () => {
      const scope = fetchConfig('cloud-ops-sandbox.yml');
      const payload = require(resolve(fixturesPath, './events/pr_opened'));
      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      scope.done();
      validateConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'testOwner',
        'testRepo',
        '19f6a66851125917fa07615dcbc0cd13dad56981',
        12
      );
      autoLabelOnPRStub.calledOnceWith(
        sinon.match.instanceOf(Context),
        'testOwner',
        'testRepo',
        sinon.match.any
      );
      const config = autoLabelOnPRStub.getCall(0).args[3];
      assert.strictEqual(config.product, false);
      assert.strictEqual(config.path.pullrequest, false);
      assert.strictEqual(config.language.paths.src.frontend, 'go');
      assert.strictEqual(config.language.paths.tests['.'], 'python');
      assert.strictEqual(config.language.paths.website['.'], 'javascript');
      assert.strictEqual(config.language.paths.website.images, 'svg');
      assert.strictEqual(config.language.pullrequest, true);
      assert.strictEqual(config.language.labelprefix, 'lang: ');
      assert.strictEqual(config.language.extensions.manifest[0], 'tf');
      assert.strictEqual(config.language.extensions.typescript[0], 'ts');
    });
  });
});

describe('validateConfigChanges', () => {
  let probot: Probot;
  let getConfigWithDefaultStub: sinon.SinonStub;
  let autoLabelOnPRStub: sinon.SinonStub;

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
    getConfigWithDefaultStub = sandbox.stub(
      botConfigModule,
      'getConfigWithDefault'
    );
    getConfigWithDefaultStub.resolves(helper.DEFAULT_CONFIGS);
    autoLabelOnPRStub = sandbox.stub(handler, 'autoLabelOnPR');
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('compatibility tests', () => {
    it('does not create a failing status check for a correct config', async () => {
      const scope = fetchFilesInPR('cloud-ops-sandbox.yml');
      const payload = require(resolve(fixturesPath, './events/pr_opened'));
      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      scope.done();
      autoLabelOnPRStub.calledOnceWith(
        sinon.match.instanceOf(Context),
        'testOwner',
        'testRepo',
        sinon.match.any
      );
    });
    it('creates a failing status check for a correct config', async () => {
      const scope = fetchFilesInPR('cloud-ops-sandbox-broken.yml');
      const payload = require(resolve(fixturesPath, './events/pr_opened'));
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
      autoLabelOnPRStub.calledOnceWith(
        sinon.match.instanceOf(Context),
        'testOwner',
        'testRepo',
        sinon.match.any
      );
    });
  });
});
