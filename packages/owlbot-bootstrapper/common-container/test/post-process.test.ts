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

import {GithubAuthenticator} from '../github-authenticator';
import nock from 'nock';
import sinon from 'sinon';
import {MonoRepo} from '../mono-repo';
import * as utils from '../utils';
import {CliArgs} from '../interfaces';
import assert from 'assert';
import {postProcess} from '../post-process';
import {Octokit} from '@octokit/rest';
const fetch = require('node-fetch');

nock.disableNetConnect();

let getGitHubShortLivedAccessTokenStub: sinon.SinonStub;
let authenticateOctokitStub: sinon.SinonStub;
let cloneRepoAndOpenBranchStub: sinon.SinonStub;
let pushToBranchAndOpenPRStub: sinon.SinonStub;
let setConfigStub: sinon.SinonStub;

describe('post processing', async () => {
  let argv: CliArgs;

  beforeEach(() => {
    getGitHubShortLivedAccessTokenStub = sinon.stub(
      GithubAuthenticator.prototype,
      'getGitHubShortLivedAccessToken'
    );

    authenticateOctokitStub = sinon.stub(
      GithubAuthenticator.prototype,
      'authenticateOctokit'
    );

    cloneRepoAndOpenBranchStub = sinon.stub(
      MonoRepo.prototype,
      'cloneRepoAndOpenBranch'
    );

    pushToBranchAndOpenPRStub = sinon.stub(
      MonoRepo.prototype,
      'pushToBranchAndOpenPR'
    );

    setConfigStub = sinon.stub(utils, 'setConfig');
  });

  afterEach(() => {
    getGitHubShortLivedAccessTokenStub.restore();
    authenticateOctokitStub.restore();
    cloneRepoAndOpenBranchStub.restore();
    pushToBranchAndOpenPRStub.restore();
    setConfigStub.restore();
    nock.cleanAll();
  });

  it('calls the right stubs when entering monorepo/post-process', async () => {
    argv = {
      projectId: 'myprojects',
      apiId: 'google.cloud.kms.v1',
      language: 'nodejs',
      repoToClone: 'git@github.com/googleapis/nodejs-kms.git',
      installationId: '12345',
      monoRepoPath: 'MONO_REPO_PATH',
      monoRepoName: 'nodejs-kms',
      monoRepoOrg: 'googleapis',
      monoRepoDir: 'MONO_REPO_DIR',
      serviceConfigPath: 'SERVICE_CONFIG_PATH',
      interContainerVarsPath: 'INTER_CONTAINER_VARS_PATH',
      buildId: '1234',
      skipIssueOnFailure: 'false',
      sourceCl: 2345,
    };

    await postProcess(argv);
    assert.ok(getGitHubShortLivedAccessTokenStub.calledOnce);
    assert.ok(authenticateOctokitStub.calledOnce);
    assert.ok(pushToBranchAndOpenPRStub.calledOnce);
  });

  it('attempts to open an issue in monorepo if any part of main fails', async () => {
    argv = {
      projectId: 'myprojects',
      apiId: 'google.cloud.kms.v1',
      language: 'nodejs',
      installationId: '12345',
      repoToClone: 'git@github.com/googleapis/nodejs-kms.git',
      monoRepoPath: 'MONO_REPO_PATH',
      monoRepoDir: 'MONO_REPO_DIR',
      monoRepoName: 'nodejs-kms',
      monoRepoOrg: 'googleapis',
      serviceConfigPath: 'SERVICE_CONFIG_PATH',
      interContainerVarsPath: 'INTER_CONTAINER_VARS_PATH',
      buildId: '1234',
      skipIssueOnFailure: 'false',
      sourceCl: 2345,
    };

    const octokit = new Octokit({auth: 'abc1234', request: {fetch}});
    authenticateOctokitStub.returns(octokit);
    pushToBranchAndOpenPRStub.rejects();

    const scope = nock('https://api.github.com')
      .post(`/repos/${argv.monoRepoOrg}/${argv.monoRepoName}/issues`)
      .reply(201);

    await assert.rejects(() => postProcess(argv));
    scope.done();
  });

  it('does not open an issue if skipIssueOnFailure = true', async () => {
    argv = {
      projectId: 'myprojects',
      apiId: 'google.cloud.kms.v1',
      language: 'nodejs',
      installationId: '12345',
      repoToClone: 'git@github.com/googleapis/nodejs-kms.git',
      monoRepoPath: 'MONO_REPO_PATH',
      monoRepoDir: 'MONO_REPO_DIR',
      monoRepoName: 'nodejs-kms',
      monoRepoOrg: 'googleapis',
      serviceConfigPath: 'SERVICE_CONFIG_PATH',
      interContainerVarsPath: 'INTER_CONTAINER_VARS_PATH',
      buildId: '1234',
      skipIssueOnFailure: 'true',
      sourceCl: 2345,
    };
    const octokit = new Octokit({auth: 'abc1234', request: {fetch}});
    authenticateOctokitStub.returns(octokit);
    pushToBranchAndOpenPRStub.rejects();

    const scope = nock('https://api.github.com')
      .post(`/repos/${argv.monoRepoOrg}/${argv.monoRepoName}/issues`)
      .reply(201);

    await assert.rejects(() => postProcess(argv));

    assert.deepStrictEqual(scope.isDone(), false);
  });
});
