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

import {describe, it, afterEach} from 'mocha';
import nock from 'nock';
import sinon from 'sinon';
import assert from 'assert';
import fs from 'fs';
import {logger} from 'gcf-utils';
import {Octokit} from '@octokit/rest';
import {configFileName, getConfig, validateConfig} from '../src/config';

nock.disableNetConnect();

const owner = 'yoshi';
const repo = 'saur';
const host = 'https://api.github.com';
const octokit = new Octokit();

const localConfig = {
  rebaseMergeAllowed: false,
  branchProtectionRules: [
    {
      requiresCodeOwnerReviews: true,
      requiredStatusCheckContexts: ['check1', 'check2'],
    },
  ],
  permissionRules: [
    {
      team: 'team1',
      permission: 'push',
    },
  ],
};

describe('config', () => {
  afterEach(() => {
    sinon.restore();
    nock.cleanAll();
  });
  it('should get a config local to a repo', async () => {
    const scope = nock(host)
      .get(`/repos/${owner}/${repo}/contents/.github%2F${configFileName}`)
      .replyWithFile(200, './test/fixtures/localConfig.yaml');
    const config = await getConfig({octokit, owner, repo});
    assert.deepStrictEqual(config, localConfig);
    scope.done();
  });

  it('should get a remote config if local is not available', async () => {
    const scope = nock(host)
      .get(`/repos/${owner}/${repo}/contents/.github%2F${configFileName}`)
      .reply(404)
      .get(`/repos/${owner}/.github/contents/.github%2F${configFileName}`)
      .replyWithFile(200, './test/fixtures/localConfig.yaml');
    const config = await getConfig({octokit, owner, repo});
    assert.deepStrictEqual(config, localConfig);
    scope.done();
  });

  it('should not throw if the config 404s', async () => {
    const scope = nock(host)
      .get(`/repos/${owner}/${repo}/contents/.github%2F${configFileName}`)
      .reply(404)
      .get(`/repos/${owner}/.github/contents/.github%2F${configFileName}`)
      .reply(404);
    const infoStub = sinon.stub(logger, 'info');
    const config = await getConfig({octokit, owner, repo});
    assert.strictEqual(config, null);
    assert.ok(infoStub.calledTwice);
    scope.done();
  });

  it('should log an error if the config request returns a 500', async () => {
    const scope = nock(host)
      .get(`/repos/${owner}/${repo}/contents/.github%2F${configFileName}`)
      .reply(500)
      .get(`/repos/${owner}/.github/contents/.github%2F${configFileName}`)
      .reply(500);
    const errorStub = sinon.stub(logger, 'error');
    const config = await getConfig({octokit, owner, repo});
    assert.strictEqual(config, null);
    scope.done();
    assert.ok(errorStub.calledTwice);
  });

  it('should validate a valid config', async () => {
    const localConfigYaml = fs.readFileSync(
      './test/fixtures/localConfig.yaml',
      'utf-8'
    );
    const res = await validateConfig(localConfigYaml);
    assert.ok(res.isValid);
    assert.strictEqual(res.errorText, undefined);
  });

  it('should invalidate a invalid config', async () => {
    const localConfigYaml = fs.readFileSync(
      './test/fixtures/bogusConfig.yaml',
      'utf-8'
    );
    const res = await validateConfig(localConfigYaml);
    assert.strictEqual(res.isValid, false);
    assert.ok(res.errorText);
    assert.ok(/additionalProperties/.test(res.errorText!));
  });
});
