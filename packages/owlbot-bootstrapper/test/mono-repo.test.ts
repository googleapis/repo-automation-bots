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

import {describe, it} from 'mocha';
import {Octokit} from '@octokit/rest';
import {Language} from '../common-container/interfaces';
import nock from 'nock';
import {execSync} from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {MonoRepo} from '../common-container/mono-repo';
import * as utils from '../common-container/utils';
import assert from 'assert';

nock.disableNetConnect();

let directoryPath: string;
let repoToClonePath: string;
const FAKE_REPO_NAME = 'fakeRepo';
const FAKE_WORKSPACE = 'workspace';

describe('MonoRepo class', async () => {
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

    if (!(execSync('git config user.name'))) {
      utils.setConfig(directoryPath);
    }
  });

  afterEach(async () => {
    await execSync(`rm -rf ${directoryPath}`);
    await execSync(`rm -rf ${repoToClonePath}`);
  });

  const octokit = new Octokit({auth: 'abc1234'});

  let monoRepo = new MonoRepo(
    'nodejs' as Language,
    'github.com/soficodes/nodejs-kms.git',
    'ghs_1234',
    octokit
  );

  it('should create the right type of object', async () => {
    const expectation = {
      language: Language.Nodejs,
      repoToCloneUrl: 'github.com/soficodes/nodejs-kms.git',
      githubToken: 'ghs_1234',
      octokit,
      repoName: 'nodejs-kms',
    };

    assert.deepStrictEqual(monoRepo.language, expectation.language);
    assert.deepStrictEqual(monoRepo.repoToCloneUrl, expectation.repoToCloneUrl);
    assert.deepStrictEqual(monoRepo.githubToken, expectation.githubToken);
    assert.deepStrictEqual(monoRepo.octokit, expectation.octokit);
    assert.deepStrictEqual(monoRepo.repoName, 'nodejs-kms');
  });

  it('should clone a given repo', async () => {
    await monoRepo._cloneRepo('ab123', repoToClonePath, directoryPath);

    assert.ok(fs.statSync(`${directoryPath}/${FAKE_REPO_NAME}`));
  });

  it('get opens a PR against the main branch', async () => {
    const scope = nock('https://api.github.com')
      .post('/repos/googleapis/nodejs-kms/pulls')
      .reply(201);

    await utils.openAPR(octokit, 'specialName', 'nodejs-kms');
    scope.done();
  });

  it('should open a branch, then commit and push to that branch', async () => {
    await monoRepo._cloneRepo('ab123', repoToClonePath, directoryPath);
    await utils.openABranch(FAKE_REPO_NAME, directoryPath);
    const branchName = await utils.getBranchName(directoryPath);
    fs.writeFileSync(`${directoryPath}/${FAKE_REPO_NAME}/README.md`, 'hello!');
    await monoRepo._commitAndPushToBranch(
      branchName,
      FAKE_REPO_NAME,
      directoryPath
    );

    const stdoutBranch = execSync('git branch', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    const stdoutCommit = execSync('git log', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    const stdoutReadmeExists = execSync(
      `git cat-file -e origin/${branchName}:README.md && echo README exists`,
      {cwd: `${directoryPath}/${FAKE_REPO_NAME}`}
    );

    assert.ok(stdoutBranch.includes(branchName));
    assert.ok(stdoutCommit.includes('feat: initial generation of library'));
    assert.ok(stdoutReadmeExists.includes('README exists'));
  });

  it('should open a branch, then commit and push to that branch in the composite workflow', async () => {
    const scope = nock('https://api.github.com')
      .post(`/repos/googleapis/${FAKE_REPO_NAME}/pulls`)
      .reply(201);

    monoRepo = new MonoRepo(
      'nodejs' as Language,
      repoToClonePath,
      'ghs_1234',
      octokit
    );
    monoRepo.repoName = FAKE_REPO_NAME;
    await monoRepo.cloneRepoAndOpenBranch(directoryPath);
    fs.writeFileSync(`${directoryPath}/${FAKE_REPO_NAME}/README.md`, 'hello!');
    await monoRepo.pushToBranchAndOpenPR(directoryPath);

    const stdoutBranch = execSync('git branch', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    const stdoutCommit = execSync('git log', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    assert.ok(stdoutBranch.includes('owlbot-bootstrapper-initial-PR'));
    assert.ok(stdoutCommit.includes('feat: initial generation of library'));
    scope.done();
  });
});
