// Copyright 2022 Google LLC
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

import * as core from '../src/main';
import * as assert from 'assert';
import {describe, it, afterEach} from 'mocha';
import nock from 'nock';
import * as sinon from 'sinon';
import * as path from 'path';
import {Octokit} from '@octokit/rest';
import {makeTempDirWithTarballs} from './util';
const fetch = require('node-fetch');

const sandbox = sinon.createSandbox();

const changedFiles = require(path.resolve(
  './test/fixtures/pull-request-payloads/many-files.json'
)) as {filename: string}[];
nock.disableNetConnect();

// TODO: Add a system-test with a fixture directory with a few fake modules (and a fake PR) and confirm that
// it tries to publish all the modules (end-to-end test)
describe('mono-repo publish', () => {
  let execSync: sinon.SinonStub;
  let rmdirSync: sinon.SinonStub;
  afterEach(() => {
    sandbox.restore();
  });
  beforeEach(() => {
    execSync = sandbox.stub(core.methodOverrides, 'execSyncOverride');
    rmdirSync = sandbox.stub(core.methodOverrides, 'rmSyncOverride');
  });

  it('should parse owner, user, and number from the URL', () => {
    const parsed = core.parseURL(
      'https://github.com/googleapis/release-please/pull/707'
    );
    assert.deepStrictEqual(parsed, {
      owner: 'googleapis',
      repo: 'release-please',
      number: 707,
    });
  });

  it('should get authenticated Octokit instance', () => {
    const octokit = core.getOctokitInstance(
      './test/fixtures/app-id',
      './test/fixtures/installation-id',
      './test/fixtures/private-key'
    );

    assert.ok(octokit instanceof Octokit);
  });

  it('lists all files on a PR', async () => {
    const octokit = new Octokit({request: {fetch}});
    const fileRequest = nock('https://api.github.com')
      .get('/repos/testOwner/testRepo/pulls/1/files')
      .reply(200, changedFiles);
    const files = await core.getsPRFiles(
      {owner: 'testOwner', repo: 'testRepo', number: 1},
      octokit
    );
    fileRequest.done();
    assert.deepStrictEqual(
      files,
      changedFiles.map(l => l.filename)
    );
  });

  it('identifies submodules that have been changed', () => {
    const submodules = core.listChangedSubmodules(
      changedFiles.map(l => l.filename)
    );
    assert.deepStrictEqual(submodules, [
      'packages/firstPackage',
      'packages/secondPackage',
      '.',
    ]);
  });

  it('skips exclude globs', () => {
    const submodules = core.listChangedSubmodules(
      changedFiles.map(l => l.filename),
      ['**/firstPackage/*']
    );
    assert.deepStrictEqual(submodules, ['packages/secondPackage', '.']);
  });

  describe('with temp dir', () => {
    let tmpDir;
    let runDir: string;

    before(async () => {
      tmpDir = await makeTempDirWithTarballs('foo');
      runDir = process.cwd();
      process.chdir(tmpDir);
    });

    after(() => {
      process.chdir(runDir);
    });

    it('passes in the right arguments for npm publish', () => {
      core.publishSubmodules(['foo'], false);
      sandbox.assert.calledWith(
        execSync.firstCall,
        'npm i --registry=https://registry.npmjs.org'
      );
      sandbox.assert.calledWith(execSync.secondCall, 'npm pack .');
      sandbox.assert.calledWith(
        execSync.thirdCall,
        'npm publish --access=public newer.tgz'
      );
    });

    it('passes in --dry-run option', () => {
      core.publishSubmodules(['foo'], true);
      sandbox.assert.calledWith(
        execSync.firstCall,
        'npm i --registry=https://registry.npmjs.org'
      );
      sandbox.assert.calledWith(execSync.secondCall, 'npm pack .');
      sandbox.assert.calledWith(
        execSync.thirdCall,
        'npm publish --access=public --dry-run newer.tgz'
      );
    });

    // A node_modules folder existing in the root directory was preventing
    // google-api-nodejs-client from publishing.
    it('it removes node_modules after publish', () => {
      const errors = core.publishSubmodules(['foo'], true);
      sandbox.assert.calledWith(
        execSync.firstCall,
        'npm i --registry=https://registry.npmjs.org'
      );
      sandbox.assert.calledWith(execSync.secondCall, 'npm pack .');
      sandbox.assert.calledWith(
        execSync.thirdCall,
        'npm publish --access=public --dry-run newer.tgz'
      );
      sandbox.assert.calledWith(rmdirSync, 'foo/node_modules', {
        force: true,
        recursive: true,
      });
      assert.strictEqual(errors.length, 0);
    });

    it('returns array of errors after attempting all publications', () => {
      execSync.throws(Error('publish fail'));
      const errors = core.publishSubmodules(['foo'], true);
      sandbox.assert.calledWith(
        execSync.firstCall,
        'npm i --registry=https://registry.npmjs.org'
      );
      assert.strictEqual(errors.length, 1);
    });
  });

  it('uses npm ci, if package-lock.json exists', () => {
    core.publishSubmodules(['test/fixtures'], false);
    sandbox.assert.calledWith(
      execSync.firstCall,
      'npm ci --registry=https://registry.npmjs.org'
    );
  });

  it('skips package if package is set to private', () => {
    const output = core.publishSubmodules(
      ['test/sample-private-package'],
      false
    );
    console.log(output);
    assert.deepStrictEqual(output, []);
  });
});
