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

import {GithubAuthenticator} from '../common-container/github-authenticator';
import nock from 'nock';
import sinon from 'sinon';
import {MonoRepo} from '../common-container/mono-repo';
import {SplitRepo} from '../common-container/split-repo';
import * as utils from '../common-container/utils';
import {CliArgs} from '../common-container/interfaces';
import assert from 'assert';
import {postProcess} from '../common-container/post-process';
import {Octokit} from '@octokit/rest';
import {ORG} from '../common-container/utils';

nock.disableNetConnect();

let getGitHubShortLivedAccessTokenStub: sinon.SinonStub;
let authenticateOctokitStub: sinon.SinonStub;
let cloneRepoAndOpenBranchStub: sinon.SinonStub;
let pushToBranchAndOpenPRStub: sinon.SinonStub;
let createAndInitializeEmptyGitRepoStub: sinon.SinonStub;
let pushToMainAndCreateEmptyPR: sinon.SinonStub;
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

    createAndInitializeEmptyGitRepoStub = sinon.stub(
      SplitRepo.prototype,
      'createAndInitializeEmptyGitRepo'
    );

    pushToMainAndCreateEmptyPR = sinon.stub(
      SplitRepo.prototype,
      'pushToMainAndCreateEmptyPR'
    );

    setConfigStub = sinon.stub(utils, 'setConfig');
  });

  afterEach(() => {
    getGitHubShortLivedAccessTokenStub.restore();
    authenticateOctokitStub.restore();
    cloneRepoAndOpenBranchStub.restore();
    pushToBranchAndOpenPRStub.restore();
    createAndInitializeEmptyGitRepoStub.restore();
    pushToMainAndCreateEmptyPR.restore();
    setConfigStub.restore();
  });

  it('calls the right stubs when entering monorepo/post-process', async () => {
    argv = {
      projectId: 'myprojects',
      apiId: 'google.cloud.kms.v1',
      language: 'nodejs',
      repoToClone: 'github.com/googleapis/nodejs-kms.git',
      installationId: '12345',
      container: 'gcr.io/myproject/owlbot-bootstrapper:latest',
    };

    await postProcess(argv);
    assert.ok(getGitHubShortLivedAccessTokenStub.calledOnce);
    assert.ok(authenticateOctokitStub.calledOnce);
    assert.ok(pushToBranchAndOpenPRStub.calledOnce);
  });

  it('calls the right stubs when entering splitrepo/post-process', async () => {
    argv = {
      projectId: 'myprojects',
      apiId: 'google.cloud.kms.v1',
      language: 'python',
      installationId: '12345',
      container: 'gcr.io/myproject/owlbot-bootstrapper:latest',
    };

    await postProcess(argv);
    assert.ok(getGitHubShortLivedAccessTokenStub.calledOnce);
    assert.ok(authenticateOctokitStub.calledOnce);
    assert.ok(pushToMainAndCreateEmptyPR.calledOnce);
  });

  it('attempts to open an issue in googleapis if any part of main fails', async () => {
    argv = {
      projectId: 'myproject',
      apiId: 'google.cloud.kms.v1',
      language: 'python',
      installationId: '12345',
      container: 'gcr.io/myproject/owlbot-bootstrapper:latest',
    };

    const octokit = new Octokit({auth: 'abc1234'});
    authenticateOctokitStub.returns(octokit);
    pushToMainAndCreateEmptyPR.rejects();

    const scope = nock('https://api.github.com')
      .post(`/repos/${ORG}/googleapis/issues`)
      .reply(201);

    await assert.rejects(() => postProcess(argv));
    scope.done();
  });

  it('attempts to open an issue in monorepo if any part of main fails', async () => {
    argv = {
      projectId: 'myprojects',
      apiId: 'google.cloud.kms.v1',
      language: 'nodejs',
      installationId: '12345',
      repoToClone: 'github.com/googleapis/nodejs-kms.git',
      container: 'gcr.io/myproject/owlbot-bootstrapper:latest',
    };

    const octokit = new Octokit({auth: 'abc1234'});
    authenticateOctokitStub.returns(octokit);
    pushToBranchAndOpenPRStub.rejects();

    const scope = nock('https://api.github.com')
      .post(
        `/repos/${ORG}/${argv.repoToClone?.split('/')[2].split('.')[0]}/issues`
      )
      .reply(201);

    await assert.rejects(() => postProcess(argv));
    scope.done();
  });
});
