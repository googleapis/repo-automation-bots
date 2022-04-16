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
import sinon from 'sinon';
import {describe, it} from 'mocha';
import assert from 'assert';
import {MonoRepo} from '../common-container/mono-repo';
import {SplitRepo} from '../common-container/split-repo';
import {Language} from '../common-container/interfaces';
import * as utils from '../common-container/utils';
import {Octokit} from '@octokit/rest';
import nock from 'nock';
import {
  isMonoRepo,
  validateEnvVariables,
  main,
  ORG,
} from '../common-container/common-container';

nock.disableNetConnect();

let getGitHubShortLivedAccessTokenStub: sinon.SinonStub;
let authenticateOctokitStub: sinon.SinonStub;
let cloneRepoAndOpenBranchStub: sinon.SinonStub;
let pushToBranchAndOpenPRStub: sinon.SinonStub;
let createAndInitializeEmptyGitRepoStub: sinon.SinonStub;
let pushToMainAndCreateEmptyPR: sinon.SinonStub;
let setConfigStub: sinon.SinonStub;

describe('common container flow', async () => {
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

  it('correctly determines if language is a monorepo or not', () => {
    const isPythonMono = isMonoRepo(Language.Python);

    const isNodeMono = isMonoRepo(Language.Nodejs);

    assert.deepStrictEqual(isPythonMono, false);
    assert.deepStrictEqual(isNodeMono, true);
  });

  it('throws an error if repo to clone is missing but it is a mono repo', () => {
    process.env.REPO_TO_CLONE = undefined;

    assert.throws(() => validateEnvVariables(true));
  });

  it('throws an error if any other variable is missing', () => {
    process.env.IS_PRE_PROCESS = 'true';
    process.env.API_ID = 'google.cloud.kms.v1';
    process.env.LANGUAGE = 'nodejs';
    process.env.PROJECT_ID = 'myproject';

    assert.throws(
      () => validateEnvVariables(false),
      /Missing app installation Id/
    );
  });

  it('enters monorepo/pre-process according to env variables', async () => {
    process.env.IS_PRE_PROCESS = 'true';
    process.env.API_ID = 'google.cloud.kms.v1';
    process.env.REPO_TO_CLONE = 'github.com/googleapis/nodejs-kms.git';
    process.env.LANGUAGE = 'nodejs';
    process.env.PROJECT_ID = 'myproject';
    process.env.APP_INSTALLATION_ID = '12345';

    await main();
    assert.ok(getGitHubShortLivedAccessTokenStub.calledOnce);
    assert.ok(authenticateOctokitStub.calledOnce);
    assert.ok(cloneRepoAndOpenBranchStub.calledOnce);
  });

  it('enters monorepo/post-process according to env variables', async () => {
    process.env.IS_PRE_PROCESS = 'false';
    process.env.API_ID = 'google.cloud.kms.v1';
    process.env.REPO_TO_CLONE = 'github.com/googleapis/nodejs-kms.git';
    process.env.LANGUAGE = 'nodejs';
    process.env.PROJECT_ID = 'myproject';
    process.env.APP_INSTALLATION_ID = '12345';

    await main();
    assert.ok(getGitHubShortLivedAccessTokenStub.calledOnce);
    assert.ok(authenticateOctokitStub.calledOnce);
    assert.ok(pushToBranchAndOpenPRStub.calledOnce);
  });

  it('enters splitrepo/pre-process according to env variables', async () => {
    process.env.IS_PRE_PROCESS = 'true';
    process.env.API_ID = 'google.cloud.kms.v1';
    process.env.LANGUAGE = 'python';
    process.env.PROJECT_ID = 'myproject';
    process.env.APP_INSTALLATION_ID = '12345';

    await main();
    assert.ok(getGitHubShortLivedAccessTokenStub.calledOnce);
    assert.ok(authenticateOctokitStub.calledOnce);
    assert.ok(createAndInitializeEmptyGitRepoStub.calledOnce);
  });

  it('enters splitrepo/pre-process according to env variables', async () => {
    process.env.IS_PRE_PROCESS = 'false';
    process.env.API_ID = 'google.cloud.kms.v1';
    process.env.LANGUAGE = 'python';
    process.env.PROJECT_ID = 'myproject';
    process.env.APP_INSTALLATION_ID = '12345';

    await main();
    assert.ok(getGitHubShortLivedAccessTokenStub.calledOnce);
    assert.ok(authenticateOctokitStub.calledOnce);
    assert.ok(pushToMainAndCreateEmptyPR.calledOnce);
  });

  it('attempts to open an issue in googleapis if any part of main fails', async () => {
    const octokit = new Octokit({auth: 'abc1234'});
    authenticateOctokitStub.returns(octokit);

    const scope = nock('https://api.github.com')
      .post(`/repos/${ORG}/googleapis/issues`)
      .reply(201);

    process.env.REPO_TO_CLONE = undefined;
    process.env.IS_PRE_PROCESS = 'false';
    process.env.API_ID = 'google.cloud.kms.v1';
    process.env.LANGUAGE = 'nodejs';
    process.env.PROJECT_ID = 'myproject';
    process.env.APP_INSTALLATION_ID = '12345';

    await assert.rejects(() => main());
    scope.done();
  });

  it('attempts to open an issue in monorepo if any part of main fails', async () => {
    process.env.IS_PRE_PROCESS = 'true';
    process.env.API_ID = 'google.cloud.kms.v1';
    process.env.LANGUAGE = 'nodejs';
    process.env.PROJECT_ID = 'myproject';
    process.env.APP_INSTALLATION_ID = '12345';
    process.env.REPO_TO_CLONE = 'github.com/googleapis/nodejs-kms.git';

    const octokit = new Octokit({auth: 'abc1234'});
    authenticateOctokitStub.returns(octokit);
    cloneRepoAndOpenBranchStub.rejects();

    const scope = nock('https://api.github.com')
      .post(
        `/repos/${ORG}/${
          process.env.REPO_TO_CLONE?.split('/')[2].split('.')[0]
        }/issues`
      )
      .reply(201);

    await assert.rejects(() => main());
    scope.done();
  });
});
