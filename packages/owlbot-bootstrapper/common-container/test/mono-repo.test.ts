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
import {Language} from '../interfaces';
import nock from 'nock';
import {execSync} from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import {MonoRepo} from '../mono-repo';
import * as utils from '../utils';
import assert from 'assert';

nock.disableNetConnect();

let directoryPath: string;
let repoToClonePath: string;
const FAKE_REPO_NAME = 'fakeRepo';
const FAKE_WORKSPACE = 'workspace';

describe('MonoRepo class', () => {
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
      utils.setConfig(directoryPath);
    }
  });

  afterEach(async () => {
    await execSync(`rm -rf ${directoryPath}`);
    await execSync(`rm -rf ${repoToClonePath}`);
  });

  const octokit = new Octokit({auth: 'abc1234'});

  it('should create the right type of object', async () => {
    const monoRepo = new MonoRepo(
      'nodejs' as Language,
      'git@github.com/soficodes/nodejs-kms.git',
      'ghs_1234',
      'google.cloud.kms.v1',
      'nodejs-kms',
      'soficodes',
      octokit
    );

    const expectation = {
      language: Language.Nodejs,
      repoToCloneUrl: 'git@github.com/soficodes/nodejs-kms.git',
      githubToken: 'ghs_1234',
      repoName: 'nodejs-kms',
      repoOrg: 'soficodes',
      octokit,
    };

    assert.deepStrictEqual(monoRepo.language, expectation.language);
    assert.deepStrictEqual(monoRepo.repoToCloneUrl, expectation.repoToCloneUrl);
    assert.deepStrictEqual(monoRepo.githubToken, expectation.githubToken);
    assert.deepStrictEqual(monoRepo.octokit, expectation.octokit);
    assert.deepStrictEqual(monoRepo.repoName, expectation.repoName);
    assert.deepStrictEqual(monoRepo.repoOrg, expectation.repoOrg);
    assert.deepStrictEqual(monoRepo.repoName, 'nodejs-kms');
  });

  it('should clone a given repo', async () => {
    const monoRepo = new MonoRepo(
      'nodejs' as Language,
      'git@github.com/soficodes/nodejs-kms.git',
      'ghs_1234',
      'nodejs-kms',
      'soficodes',
      'google.cloud.kms.v1',
      octokit
    );

    await monoRepo._cloneRepo(
      'ab123',
      repoToClonePath,
      directoryPath,
      'monoRepoDir',
      'monoRepoName'
    );

    assert.ok(fs.statSync(`${directoryPath}/${FAKE_REPO_NAME}`));
  });

  it('opens a PR against the main branch', async () => {
    const scope = nock('https://api.github.com')
      .get('/repos/googleapis/nodejs-kms')
      .reply(200, {default_branch: 'main'})
      .post('/repos/googleapis/nodejs-kms/pulls')
      .reply(201);

    await utils.openAPR(
      octokit,
      'specialName',
      'nodejs-kms',
      'google.cloud.kms.v1',
      '6dcb09b5b57875f334f61aebed695e2e4193db5e',
      'Copy-Tag: eyJwIjoicGFja2FnZXMvZ29vZ2xlLWNsb3VkLWttcy8uZ2l0aHViLy5Pd2xCb3QueWFtbCIsImgiOiI2ZGNiMDliNWI1Nzg3NWYzMzRmNjFhZWJlZDY5NWUyZTQxOTNkYjVlIn0=',
      2345
    );
    scope.done();
  });

  it('should open a branch, then commit and push to that branch', async () => {
    const monoRepo = new MonoRepo(
      'nodejs' as Language,
      'git@github.com/soficodes/nodejs-kms.git',
      'ghs_1234',
      'nodejs-kms',
      'soficodes',
      'google.cloud.kms.v1',
      octokit
    );

    await monoRepo._cloneRepo(
      'ab123',
      repoToClonePath,
      directoryPath,
      'monoRepoDir',
      'monoRepoName'
    );
    const branchName = await utils.openABranch(
      FAKE_REPO_NAME,
      `${directoryPath}/${FAKE_REPO_NAME}`
    );
    await utils.writeToWellKnownFile(
      {branchName},
      `${directoryPath}/interContainerVars.json`
    );
    fs.writeFileSync(`${directoryPath}/${FAKE_REPO_NAME}/README.md`, 'hello!');
    const contents = utils.getWellKnownFileContents(
      `${directoryPath}/interContainerVars.json`
    );
    contents.owlbotYamlPath = 'packages/google-cloud-kms/.github/.OwlBot.yaml';
    fs.writeFileSync(
      `${directoryPath}/interContainerVars.json`,
      JSON.stringify(contents, null, 4)
    );
    const interContainerVars = utils.getWellKnownFileContents(
      `${directoryPath}/interContainerVars.json`
    );
    const copyTagInfo = utils.getCopyTagText(
      '6dcb09b5b57875f334f61aebed695e2e4193db5e',
      interContainerVars.owlbotYamlPath
    );
    await monoRepo._commitAndPushToBranch(
      interContainerVars.branchName,
      `${directoryPath}/${FAKE_REPO_NAME}`,
      copyTagInfo
    );

    const stdoutBranch = execSync('git branch', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    const stdoutCommit = execSync('git log', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    const stdoutReadmeExists = execSync(
      `git cat-file -e origin/${interContainerVars.branchName}:README.md && echo README exists`,
      {cwd: `${directoryPath}/${FAKE_REPO_NAME}`}
    );

    assert.ok(stdoutBranch.includes(interContainerVars.branchName));
    assert.ok(
      stdoutCommit
        .toString('utf-8')
        .includes('feat: initial generation of library')
    );
    assert.ok(
      stdoutCommit
        .toString('utf8')
        .includes(
          'Copy-Tag: eyJwIjoicGFja2FnZXMvZ29vZ2xlLWNsb3VkLWttcy8uZ2l0aHViLy5Pd2xCb3QueWFtbCIsImgiOiI2ZGNiMDliNWI1Nzg3NWYzMzRmNjFhZWJlZDY5NWUyZTQxOTNkYjVlIn0='
        )
    );
    assert.ok(stdoutReadmeExists.includes('README exists'));
  });

  it('should open a branch, then commit and push to that branch in the composite workflow', async () => {
    const monoRepo = new MonoRepo(
      'nodejs' as Language,
      'git@github.com/soficodes/nodejs-kms.git',
      'ghs_1234',
      'nodejs-kms',
      'soficodes',
      'google.cloud.kms.v1',
      octokit
    );
    const scope = nock('https://api.github.com')
      .get('/repos/googleapis/googleapis-gen/commits')
      .reply(201, {sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'})
      .get(`/repos/googleapis/${FAKE_REPO_NAME}`)
      .reply(200, {default_branch: 'main'})
      .post(`/repos/googleapis/${FAKE_REPO_NAME}/pulls`)
      .reply(201, {number: 1})
      .post(`/repos/googleapis/${FAKE_REPO_NAME}/issues/1/labels`)
      .reply(201);

    monoRepo.repoName = FAKE_REPO_NAME;
    monoRepo.repoToCloneUrl = repoToClonePath;
    await monoRepo.cloneRepoAndOpenBranch(
      directoryPath,
      `${directoryPath}/${FAKE_REPO_NAME}`,
      `${directoryPath}/interContainerVars.json`
    );
    const contents = utils.getWellKnownFileContents(
      `${directoryPath}/interContainerVars.json`
    );
    contents.owlbotYamlPath = 'packages/google-cloud-kms/.github/.OwlBot.yaml';
    fs.writeFileSync(
      `${directoryPath}/interContainerVars.json`,
      JSON.stringify(contents, null, 4)
    );

    fs.writeFileSync(`${directoryPath}/${FAKE_REPO_NAME}/README.md`, 'hello!');
    await monoRepo.pushToBranchAndOpenPR(
      `${directoryPath}/${FAKE_REPO_NAME}`,
      `${directoryPath}/interContainerVars.json`,
      2345
    );

    const stdoutBranch = execSync('git branch', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    const stdoutCommit = execSync('git log', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    assert.ok(stdoutBranch.includes('owlbot-bootstrapper-initial-PR'));
    assert.ok(
      stdoutCommit
        .toString('utf-8')
        .includes('feat: initial generation of library')
    );
    assert.ok(
      stdoutCommit
        .toString('utf8')
        .includes(
          'Copy-Tag: eyJwIjoicGFja2FnZXMvZ29vZ2xlLWNsb3VkLWttcy8uZ2l0aHViLy5Pd2xCb3QueWFtbCIsImgiOiI2ZGNiMDliNWI1Nzg3NWYzMzRmNjFhZWJlZDY5NWUyZTQxOTNkYjVlIn0='
        )
    );
    scope.done();
  });
});
