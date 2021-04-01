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

const core = require('../src/main.js');

const assert = require('assert');
const { describe, it, afterEach } = require('mocha');
const nock = require('nock');
const sinon = require('sinon');
const { Octokit } = require('@octokit/rest');

const sandbox = sinon.createSandbox();

const changedFiles = require('./fixtures/pull-request-payloads/many-files.json');
nock.disableNetConnect();

// TODO: Add a system-test with a fixture directory with a few fake modules (and a fake PR) and confirm that
// it tries to publish all the modules (end-to-end test)
describe('mono-repo publish', () => {
  afterEach(() => {
    sandbox.restore();
  });

  it('should parse owner, user, and number from the URL', () => {
    const parsed = core.parseURL('https://github.com/googleapis/release-please/pull/707');
    assert.deepStrictEqual(parsed, { owner: 'googleapis', repo: 'release-please', number: 707 });
  });

  it('should get authenticated Octokit instance', () => {
    sinon.stub(process, 'env').value({
      APP_ID_PATH: './test/fixtures/app-id',
      INSTALLATION_ID_PATH: './test/fixtures/installation-id',
      GITHUB_PRIVATE_KEY_PATH: './test/fixtures/private-key'
    });

    const octokit = core.getOctokitInstance();

    assert.ok(octokit instanceof Octokit);
  });

  it('lists all files on a PR', async () => {
    const octokit = new Octokit();
    const fileRequest = nock('https://api.github.com').get('/repos/testOwner/testRepo/pulls/1/files').reply(200, changedFiles);
    const files = await core.getsPRFiles({ owner: 'testOwner', repo: 'testRepo', number: 1 }, octokit);
    fileRequest.done();
    assert.deepStrictEqual(files, changedFiles.map(l => l.filename));
  });

  it('identifies submodules that have been changed', () => {
    const submodules = core.listChangedSubmodules(changedFiles.map(l => l.filename));
    assert.deepStrictEqual(submodules, ['packages/firstPackage', 'packages/secondPackage', '.']);
  });

  it('passes in the right arguments for npm publish', () => {
    const execSync = sandbox.spy();
    core.publishSubmodules(['foo'], false, execSync);
    sandbox.assert.calledWith(execSync.firstCall, 'npm i');
    sandbox.assert.calledWith(execSync.secondCall, 'npm publish --access=public');
  });

  it('passes in --dry-run option', () => {
    const execSync = sandbox.spy();
    core.publishSubmodules(['foo'], true, execSync);
    sandbox.assert.calledWith(execSync.firstCall, 'npm i');
    sandbox.assert.calledWith(execSync.secondCall, 'npm publish --access=public --dry-run');
  });
});
