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

import {
  openAPR,
  getBranchName,
  openABranch,
  openAnIssue,
  setConfig,
} from '../../common-container/utils';
import {MonoRepo} from '../../common-container/mono-repo';
import {execSync} from 'child_process';
import path from 'path';
import {Octokit} from '@octokit/rest';
import nock from 'nock';
import assert from 'assert';
import {ORG} from '../../common-container/common-container';
import snapshot from 'snap-shot-it';

let directoryPath: string;
let repoToClonePath: string;

const FAKE_REPO_NAME = 'fakeRepo';
const FAKE_WORKSPACE = 'workspace';
nock.disableNetConnect();

describe('common utils tests', async () => {
  beforeEach(async () => {
    directoryPath = path.join(__dirname, FAKE_WORKSPACE);
    repoToClonePath = path.join(__dirname, FAKE_REPO_NAME);
    console.log(directoryPath);
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
      setConfig(directoryPath);
    }
  });

  afterEach(async () => {
    await execSync(`rm -rf ${directoryPath}`);
    await execSync(`rm -rf ${repoToClonePath}`);
  });

  const octokit = new Octokit({auth: 'abc1234'});

  it('get branch name from a well-known path', async () => {
    await execSync('echo specialName > branchName.md', {cwd: directoryPath});

    const branchName = await getBranchName(directoryPath);

    assert.deepStrictEqual(branchName, 'specialName');
  });

  it('get opens a PR against the main branch', async () => {
    const scope = nock('https://api.github.com')
      .post('/repos/googleapis/nodejs-kms/pulls')
      .reply(201);

    await openAPR(octokit, 'specialName', 'nodejs-kms');
    scope.done();
  });

  it('should open a branch, then push that branch to origin', async () => {
    await MonoRepo.prototype._cloneRepo(
      'ab123',
      repoToClonePath,
      directoryPath
    );
    await openABranch(FAKE_REPO_NAME, directoryPath);
    const branchName = await getBranchName(directoryPath);

    const stdoutBranch = execSync('git branch', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    assert.ok(stdoutBranch.includes(branchName));
  });

  it('should open an issue on a given repo', async () => {
    const scope = nock('https://api.github.com')
      .post(`/repos/${ORG}/googleapis/issues`, body => {
        snapshot(body);
        return true;
      })
      .reply(201);

    await openAnIssue(
      octokit,
      'googleapis',
      'google.cloud.kms.v1',
      '1234',
      'myproject',
      'python',
      'We are missing this piece of critical info'
    );
    scope.done();
  });
});
