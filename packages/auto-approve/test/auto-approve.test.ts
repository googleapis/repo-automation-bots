// Copyright 2021 Google LLC
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

import * as autoApprove from '../src/auto-approve';
import * as getPRInfo from '../src/get-pr-info';
import * as checkConfig from '../src/check-config';
import * as checkPR from '../src/check-pr';
import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import nock from 'nock';
import sinon, {SinonStub} from 'sinon';
import {describe, it, beforeEach} from 'mocha';
import * as assert from 'assert';
import snapshot from 'snap-shot-it';

const {Octokit} = require('@octokit/rest');

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');
const CONFIGURATION_FILE_PATH = 'auto-approve.yml';

const TestingOctokit = ProbotOctokit.defaults({
  retry: {enabled: false},
  throttle: {enabled: false},
});

function getConfigFile(
  owner: string,
  repo: string,
  response: string | undefined,
  status: number
) {
  if (status === 404) {
    return (
      nock('https://api.github.com')
        // This second stub is required as octokit does a second attempt on a different endpoint
        .get(`/repos/${owner}/.github/contents/.github%2Fauto-approve.yml`)
        .reply(404)
        .get(`/repos/${owner}/${repo}/contents/.github%2Fauto-approve.yml`)
        .reply(404)
    );
  } else {
    return nock('https://api.github.com')
      .get(`/repos/${owner}/${repo}/contents/.github%2Fauto-approve.yml`)
      .reply(status, {response});
  }
}

function getReviewsCompleted(
  owner: string,
  repo: string,
  response: getPRInfo.Reviews[]
) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/pulls/1/reviews`)
    .reply(200, response);
}

function submitReview(owner: string, repo: string, status: number) {
  return nock('https://api.github.com')
    .post(`/repos/${owner}/${repo}/pulls/1/reviews`, body => {
      snapshot(body);
      return true;
    })
    .reply(status);
}

function addLabels(owner: string, repo: string, status: number) {
  return nock('https://api.github.com')
    .post(`/repos/${owner}/${repo}/issues/1/labels`)
    .reply(status);
}

function createCheck(owner: string, repo: string, status: number) {
  return nock('https://api.github.com')
    .post(`/repos/${owner}/${repo}/check-runs`, body => {
      snapshot(body);
      return true;
    })
    .reply(status);
}

describe('auto-approve', () => {
  let probot: Probot;
  let checkPRAgainstConfigStub: SinonStub;
  let getChangedFilesStub: SinonStub;
  let getBlobFromPRFilesStub: SinonStub;
  let checkAutoApproveStub: SinonStub;
  let checkCodeOwnersStub: SinonStub;
  let getSecretStub: SinonStub;

  beforeEach(() => {
    probot = createProbot({
      defaults: {
        githubToken: 'abc123',
        Octokit: TestingOctokit,
      },
    });
    probot.load(autoApprove.handler);

    checkPRAgainstConfigStub = sinon.stub(checkPR, 'checkPRAgainstConfig');
    getChangedFilesStub = sinon.stub(getPRInfo, 'getChangedFiles');
    getBlobFromPRFilesStub = sinon.stub(getPRInfo, 'getBlobFromPRFiles');
    checkAutoApproveStub = sinon.stub(checkConfig, 'checkAutoApproveConfig');
    checkCodeOwnersStub = sinon.stub(checkConfig, 'checkCodeOwners');
    getSecretStub = sinon.stub(autoApprove, 'authenticateWithSecret');
  });

  afterEach(() => {
    checkPRAgainstConfigStub.restore();
    getChangedFilesStub.restore();
    getBlobFromPRFilesStub.restore();
    checkAutoApproveStub.restore();
    checkCodeOwnersStub.restore();
    getSecretStub.restore();
  });

  describe('main auto-approve function', () => {
    describe('config exists on main branch', () => {
      it('approves and tags a PR if a config exists & is valid & PR is valid', async () => {
        checkPRAgainstConfigStub.returns(true);
        checkAutoApproveStub.returns('');
        checkCodeOwnersStub.returns('');
        getSecretStub.returns(new Octokit({auth: '123'}));

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        const scopes = [
          getConfigFile('testOwner', 'testRepo', 'fake-config', 200),
          getReviewsCompleted('testOwner', 'testRepo', []),
          submitReview('testOwner', 'testRepo', 200),
          addLabels('testOwner', 'testRepo', 200),
          createCheck('testOwner', 'testRepo', 200),
        ];

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });

        scopes.forEach(scope => scope.done());
        assert.ok(getChangedFilesStub.calledOnce);
      });

      it('does nothing if there is already an approval', async () => {
        checkPRAgainstConfigStub.returns(true);
        checkAutoApproveStub.returns('');
        checkCodeOwnersStub.returns('');
        getSecretStub.returns(new Octokit({auth: '123'}));

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        const scopes = [
          getConfigFile('testOwner', 'testRepo', 'fake-config', 200),
          getReviewsCompleted('testOwner', 'testRepo', [
            {
              user: {login: 'yoshi-approver'},
              state: 'APPROVED',
              commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              id: 12345,
            },
          ]),
          createCheck('testOwner', 'testRepo', 200),
        ];

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });

        scopes.forEach(scope => scope.done());
        assert.ok(getChangedFilesStub.calledOnce);
      });

      it('approves and tags a PR if everything is valid, and it is coming from a fork', async () => {
        checkPRAgainstConfigStub.returns(true);
        checkAutoApproveStub.returns('');
        checkCodeOwnersStub.returns('');
        getSecretStub.returns(new Octokit({auth: '123'}));

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened_fork'
        ));

        const scopes = [
          getConfigFile(
            'GoogleCloudPlatform',
            'python-docs-samples',
            'fake-config',
            200
          ),
          getReviewsCompleted('GoogleCloudPlatform', 'python-docs-samples', []),
          submitReview('GoogleCloudPlatform', 'python-docs-samples', 200),
          addLabels('GoogleCloudPlatform', 'python-docs-samples', 200),
          createCheck('GoogleCloudPlatform', 'python-docs-samples', 200),
        ];

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });

        scopes.forEach(scope => scope.done());
        assert.ok(getChangedFilesStub.calledOnce);
      });

      it('submits a failing check if config exists but is not valid', async () => {
        checkPRAgainstConfigStub.returns(true);
        checkAutoApproveStub.returns([
          {
            wrongProperty: 'wrongProperty',
            message: 'message',
          },
        ]);
        checkCodeOwnersStub.returns('');

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        const scopes = [
          getConfigFile('testOwner', 'testRepo', 'fake-config', 200),
          createCheck('testOwner', 'testRepo', 200),
        ];

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });

        scopes.forEach(scope => scope.done());
        assert.ok(getChangedFilesStub.calledOnce);
      });

      it('logs to the console if config is valid but PR is not', async () => {
        checkPRAgainstConfigStub.returns(false);
        checkAutoApproveStub.returns('');
        checkCodeOwnersStub.returns('');

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        const scopes = [
          getConfigFile('testOwner', 'testRepo', 'fake-config', 200),
          createCheck('testOwner', 'testRepo', 200),
        ];

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });

        scopes.forEach(scope => scope.done());
        assert.ok(getChangedFilesStub.calledOnce);
      });

      // Confirming that we are first checking if auto-approve.yml is being modified
      // before we decide whether to check if auto-approve.yml is on main branch
      it('will not check config on master if the config is modified on PR', async () => {
        getBlobFromPRFilesStub.returns('fake-file');

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        const scope = createCheck('testOwner', 'testRepo', 200);

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });

        scope.done();
        getBlobFromPRFilesStub.reset();
      });
    });

    describe('config does not exist on main branch', () => {
      it('ignores the PR, if neither config exists on PR or repo', async () => {
        getBlobFromPRFilesStub.returns(undefined);
        getBlobFromPRFilesStub.returns(undefined);

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        const scopes = [getConfigFile('testOwner', 'testRepo', undefined, 404)];

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });
        scopes.forEach(scope => scope.done());
        assert.ok(getChangedFilesStub.calledOnce);
        assert.ok(getBlobFromPRFilesStub.calledTwice);
      });

      it('attempts to get codeowners file and create a passing status check if PR contains correct config', async () => {
        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        getBlobFromPRFilesStub.returns('fake-file');
        getBlobFromPRFilesStub.returns('fake-codeowners');
        checkAutoApproveStub.returns('');
        checkCodeOwnersStub.returns('');

        const scopes = [createCheck('testOwner', 'testRepo', 200)];

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });
        scopes.forEach(scope => scope.done());
        assert.ok(getChangedFilesStub.calledOnce);
        assert.ok(getBlobFromPRFilesStub.calledTwice);
      });

      it('attempts to get codeowners file and create a failing status check if PR contains wrong config, and error messages check out', async () => {
        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        getBlobFromPRFilesStub.returns('fake-file');
        getBlobFromPRFilesStub.returns('fake-codeowners');
        checkAutoApproveStub.returns([
          {
            wrongProperty: 'wrongProperty',
            message: 'message',
          },
        ]);
        checkCodeOwnersStub.returns(
          `You must add this line to the CODEOWNERS file for auto-approve.yml to merge pull requests on this repo: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/`
        );

        const scopes = [createCheck('testOwner', 'testRepo', 200)];

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });
        scopes.forEach(scope => scope.done());
        assert.ok(getChangedFilesStub.calledOnce);
        assert.ok(getBlobFromPRFilesStub.calledTwice);
      });

      it('passes PR if auto-approve is on main, not PR', async () => {
        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        getBlobFromPRFilesStub.returns(undefined);
        getBlobFromPRFilesStub.returns('fake-codeowners');
        checkAutoApproveStub.returns('');
        checkCodeOwnersStub.returns('');

        const scopes = [createCheck('testOwner', 'testRepo', 200)];

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });
        scopes.forEach(scope => scope.done());
        assert.ok(getChangedFilesStub.calledOnce);
        assert.ok(getBlobFromPRFilesStub.calledTwice);
      });
    });
  });

  describe('gets secrets and authenticates separately for approval', () => {
    const sandbox = sinon.createSandbox();
    afterEach(() => {
      sandbox.restore();
    });
    it('creates a separate octokit instance and authenticates with secret in secret manager', async () => {
      checkPRAgainstConfigStub.returns(true);
      checkAutoApproveStub.returns('');
      checkCodeOwnersStub.returns('');

      const secretOctokit = new Octokit({auth: '123'});
      sandbox.spy(secretOctokit.pulls, 'createReview');
      sandbox.spy(secretOctokit.issues, 'addLabels');
      getSecretStub.returns(secretOctokit);

      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened'
      ));

      const scopes = [
        getConfigFile('testOwner', 'testRepo', 'fake-config', 200),
        getReviewsCompleted('testOwner', 'testRepo', []),
        submitReview('testOwner', 'testRepo', 200),
        addLabels('testOwner', 'testRepo', 200),
        createCheck('testOwner', 'testRepo', 200),
      ];

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      scopes.forEach(scope => scope.done());
      assert.ok(getSecretStub.calledOnce);
      assert.ok(secretOctokit.pulls.createReview.calledOnce);
      assert.ok(secretOctokit.issues.addLabels.calledOnce);
    });

    describe('RELEASE_FREEZE', () => {
      const sandbox = sinon.createSandbox();
      afterEach(() => {
        sandbox.restore();
      });
      it('returns early if RELEASE_FREEZE is truthy', async () => {
        sandbox.stub(process, 'env').value({});
        process.env.RELEASE_FREEZE = 'true';
        const consoleStub = sandbox.stub(console, 'info');

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });
        sandbox.assert.calledWith(
          consoleStub,
          sinon.match(/releases are currently frozen/)
        );
      });
    });
  });
});
