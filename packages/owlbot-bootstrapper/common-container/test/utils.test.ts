// Copyright 2022 Google LLC
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

import * as utils from '../utils';
import {MonoRepo} from '../mono-repo';
import {execSync} from 'child_process';
import path from 'path';
import {Octokit} from '@octokit/rest';
import nock from 'nock';
import assert from 'assert';
import {ORG} from '../utils';
import snapshot from 'snap-shot-it';
import {Language} from '../interfaces';
import sinon from 'sinon';

let directoryPath: string;
let repoToClonePath: string;

const FAKE_REPO_NAME = 'fakeRepo';
const FAKE_WORKSPACE = 'workspace';
nock.disableNetConnect();

describe('common utils tests', async () => {
  beforeEach(async () => {
    directoryPath = path.join(__dirname, FAKE_WORKSPACE);
    repoToClonePath = path.join(__dirname, FAKE_REPO_NAME);

    try {
      await execSync(`mkdir ${directoryPath}`);
      await execSync(
        `mkdir ${repoToClonePath}; cd ${repoToClonePath}; git init`
      );
    } catch (err) {
      if (!(err as any).toString().match(/File exists/)) {
        throw err;
      }
    }
    try {
      execSync('git config user.name');
    } catch (err) {
      utils.setConfig(directoryPath);
    }
  });

  afterEach(async () => {
    await execSync(`rm -rf ${directoryPath}`);
    await execSync(`rm -rf ${repoToClonePath}`);
  });

  const octokit = new Octokit({auth: 'abc1234'});

  it('get branch name from a well-known path', async () => {
    await execSync('echo specialName > branchName.md', {cwd: directoryPath});

    const branchName = await utils.getBranchName(directoryPath);

    assert.deepStrictEqual(branchName, 'specialName');
  });

  it('get opens a PR against the main branch', async () => {
    const scope = nock('https://api.github.com')
      .post('/repos/googleapis/nodejs-kms/pulls')
      .reply(201);

    await utils.openAPR(octokit, 'specialName', 'nodejs-kms');
    scope.done();
  });

  it('should open a branch, then push that branch to origin', async () => {
    await MonoRepo.prototype._cloneRepo(
      'ab123',
      repoToClonePath,
      directoryPath
    );
    await utils.openABranch(FAKE_REPO_NAME, directoryPath);
    const branchName = await utils.getBranchName(directoryPath);

    const stdoutBranch = execSync('git branch', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    assert.ok(stdoutBranch.includes(branchName));
  });

  it('should open an issue on a given repo, and should not print any GH tokens', async () => {
    let issueSnapshot;
    const scope = nock('https://api.github.com')
      .post(`/repos/${ORG}/googleapis/issues`, body => {
        issueSnapshot = snapshot(body);
        return true;
      })
      .reply(201);

    await utils.openAnIssue(
      octokit,
      'googleapis',
      'google.cloud.kms.v1',
      '1234',
      'myproject',
      'python',
      'We are missing this piece of critical info, you used ghs_12346578'
    );

    //eslint-disable-next-line no-useless-escape
    assert.ok(!issueSnapshot!.match(/ghs_[\w\d]*[^@:\/\.]/g));
    scope.done();
  });

  it('correctly determines if language is a monorepo or not', () => {
    const isPythonMono = utils.isMonoRepo(Language.Python);

    const isNodeMono = utils.isMonoRepo(Language.Nodejs);

    assert.deepStrictEqual(isPythonMono, false);
    assert.deepStrictEqual(isNodeMono, true);
  });

  it('checks if git is installed', () => {
    const checkIfGitIsInstalledStub = sinon.stub(
      utils,
      'checkIfGitIsInstalled'
    );

    assert.doesNotThrow(() => {
      utils.checkIfGitIsInstalled(utils.cmd);
    });
    checkIfGitIsInstalledStub.restore();
  });

  it('throws if git is not installed', async () => {
    const cmdStub = sinon.stub(utils, 'cmd').throws();
    assert.throws(() => {
      utils.checkIfGitIsInstalled(utils.cmd);
    }, /Error: git not installed/);

    cmdStub.restore();
  });
});
