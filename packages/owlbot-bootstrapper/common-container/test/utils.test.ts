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
import snapshot from 'snap-shot-it';
import sinon from 'sinon';
import * as fs from 'fs';
const fetch = require('node-fetch');

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
      execSync(`mkdir ${directoryPath}`);
      execSync(`mkdir ${repoToClonePath}; cd ${repoToClonePath}; git init`);
      fs.writeFileSync(
        `${directoryPath}/interContainerVars.json`,
        JSON.stringify(
          {
            branchName: 'specialName',
            owlbotYamlPath: 'packages/google-cloud-kms/.OwlBot.yaml',
          },
          null,
          4
        )
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

  const octokit = new Octokit({auth: 'abc1234', request: {fetch}});

  it('get branch name from a well-known path', async () => {
    const branchName = await utils.getWellKnownFileContents(
      `${directoryPath}/interContainerVars.json`
    ).branchName;

    assert.deepStrictEqual(branchName, 'specialName');
  });

  it('throws if the file is not valid json', async () => {
    fs.writeFileSync(`${directoryPath}/interContainerVars.txt`, 'hello');
    assert.throws(() => {
      utils.getWellKnownFileContents(`${directoryPath}/interContainerVars.txt`);
    }, /interContainerVars file must be valid JSON/);
  });

  it('gets owlbot.yaml path from a well-known path', async () => {
    const owlbotPath = utils.getWellKnownFileContents(
      `${directoryPath}/interContainerVars.json`
    ).owlbotYamlPath;

    assert.deepStrictEqual(
      owlbotPath,
      'packages/google-cloud-kms/.OwlBot.yaml'
    );
  });

  it('opens a PR against the default branch', async () => {
    const scope = nock('https://api.github.com')
      .get('/repos/googleapis/nodejs-kms')
      .reply(200, {default_branch: 'main'})
      .post('/repos/googleapis/nodejs-kms/pulls', body => {
        snapshot(body);
        return true;
      })
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

  it('gets the latest commit sha from googlepis-gen', async () => {
    const scope = nock('https://api.github.com')
      .get('/repos/googleapis/googleapis-gen/commits')
      .reply(201, [
        {sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'},
        {sha: '06dcbb442b6d1c0cf4c34d0efeb1ecfff2918027'},
      ]);

    const sha = await utils.getLatestShaGoogleapisGen(octokit);
    scope.done();
    assert(sha, '6dcb09b5b57875f334f61aebed695e2e4193db5e');
  });

  it('gets the copy-tag text', () => {
    const copyTagText = utils.getCopyTagText(
      '6dcb09b5b57875f334f61aebed695e2e4193db5e',
      'packages/google-cloud-kms/.github/.OwlBot.yaml'
    );

    const expectation = `Copy-Tag:${Buffer.from(
      '{"p":"packages/google-cloud-kms/.github/.OwlBot.yaml","h":"6dcb09b5b57875f334f61aebed695e2e4193db5e"}'
    ).toString('base64')}`;
    assert(copyTagText, expectation);
  });

  it('returns the PR text with copy tag text', () => {
    const prText = utils.getPRText(
      '6dcb09b5b57875f334f61aebed695e2e4193db5e',
      `Copy-Tag:${Buffer.from(
        '{"p":"packages/google-cloud-kms/.github/.OwlBot.yaml","h":"6dcb09b5b57875f334f61aebed695e2e4193db5e"}'
      ).toString('base64')}`,
      2345
    );
    const expectation = `Source-Link: https://googleapis-gen@6dcb09b5b57875f334f61aebed695e2e4193db5e\nCopy-Tag:${Buffer.from(
      '{"p":"packages/google-cloud-kms/.github/.OwlBot.yaml","h":"6dcb09b5b57875f334f61aebed695e2e4193db5e"}'
    ).toString('base64')}`;
    assert(prText, expectation);
  });

  it('should open a branch, then push that branch to origin', async () => {
    await MonoRepo.prototype._cloneRepo(
      'ab123',
      repoToClonePath,
      directoryPath,
      'monoRepoName',
      'monoRepoOrg'
    );
    const branchNameToWrite = await utils.openABranch(
      FAKE_REPO_NAME,
      `${directoryPath}/${FAKE_REPO_NAME}`
    );
    await utils.writeToWellKnownFile(
      {branchName: branchNameToWrite},
      `${directoryPath}/interContainerVars.json`
    );
    const branchName = utils.getWellKnownFileContents(
      `${directoryPath}/interContainerVars.json`
    ).branchName;

    const stdoutBranch = execSync('git branch', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    assert.ok(stdoutBranch.includes(branchName));
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
