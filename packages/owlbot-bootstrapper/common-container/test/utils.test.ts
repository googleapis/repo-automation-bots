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
import {ORG, REGENERATE_CHECKBOX_TEXT} from '../utils';
import snapshot from 'snap-shot-it';
import {Language} from '../interfaces';
import sinon from 'sinon';
import * as fs from 'fs';

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
      fs.writeFileSync(
        `${directoryPath}/${utils.INTER_CONTAINER_VARS_FILE}`,
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

  const octokit = new Octokit({auth: 'abc1234'});

  it('get branch name from a well-known path', async () => {
    const branchName = await utils.getWellKnownFileContents(
      directoryPath,
      utils.INTER_CONTAINER_VARS_FILE
    ).branchName;

    assert.deepStrictEqual(branchName, 'specialName');
  });

  it('gets owlbot.yaml path from a well-known path', async () => {
    const owlbotPath = await utils.getWellKnownFileContents(
      directoryPath,
      utils.INTER_CONTAINER_VARS_FILE
    ).owlbotYamlPath;

    assert.deepStrictEqual(
      owlbotPath,
      'packages/google-cloud-kms/.OwlBot.yaml'
    );
  });

  it('opens a PR against the main branch', async () => {
    const scope = nock('https://api.github.com')
      .get('/repos/googleapis/googleapis-gen/commits')
      .reply(201, {sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'})
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
      'packages/google-cloud-kms/.OwlBot.yaml'
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

  it('returns the PR text with copy tag text', async () => {
    const scope = nock('https://api.github.com')
      .get('/repos/googleapis/googleapis-gen/commits')
      .reply(201, {sha: '6dcb09b5b57875f334f61aebed695e2e4193db5e'});

    const prText = await utils.getPRText(octokit, directoryPath);
    console.log(prText);
    const expectation = `${REGENERATE_CHECKBOX_TEXT}\nCopy-Tag:\n${Buffer.from(
      '{"p":"packages/google-cloud-kms/.OwlBot.yaml","h":"6dcb09b5b57875f334f61aebed695e2e4193db5e"}'
    ).toString('base64')}`;
    assert(prText, expectation);
    scope.done();
  });

  it('should open a branch, then push that branch to origin', async () => {
    await MonoRepo.prototype._cloneRepo(
      'ab123',
      repoToClonePath,
      directoryPath
    );
    await utils.openABranch(FAKE_REPO_NAME, directoryPath);
    const branchName = await utils.getWellKnownFileContents(
      directoryPath,
      utils.INTER_CONTAINER_VARS_FILE
    ).branchName;

    const stdoutBranch = execSync('git branch', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    assert.ok(stdoutBranch.includes(branchName));
  });

  it('should open an issue on a given repo, and should not print any GH tokens', async () => {
    let issueSnapshot: any;
    const scope = nock('https://api.github.com')
      .post(`/repos/${ORG}/googleapis/issues`, body => {
        issueSnapshot = body.toString();
        snapshot(body);
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
    assert.ok(!issueSnapshot.match(/ghs_[\w\d]*[^@:\/\.]/g));
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
