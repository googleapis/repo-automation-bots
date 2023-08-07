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
import * as checkPRV2 from '../src/check-pr-v2';
import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import nock from 'nock';
import sinon, {SinonStub} from 'sinon';
import {describe, it, beforeEach} from 'mocha';
import * as assert from 'assert';
import snapshot from 'snap-shot-it';
import {
  ConfigurationV2,
  Configuration,
  Reviews,
  File,
  AutoApproveNotConfigured,
} from '../src/interfaces';
import * as fs from 'fs';
import {logger} from 'gcf-utils';
import * as gcfUtilsModule from 'gcf-utils';

const {Octokit} = require('@octokit/rest');

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

const TestingOctokit = ProbotOctokit.defaults({
  retry: {enabled: false},
  throttle: {enabled: false},
});

function getConfigFile(
  owner: string,
  repo: string,
  response: Configuration | ConfigurationV2 | undefined,
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
      .reply(status, response);
  }
}

function getReviewsCompleted(owner: string, repo: string, response: Reviews[]) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/pulls/1/reviews`)
    .reply(200, response);
}

function listFiles(
  owner: string,
  repo: string,
  code: number,
  response: File[] | undefined
) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/pulls/1/files`)
    .reply(code, response);
}

function listLabels(owner: string, repo: string, code: number, etag?: string) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/issues/1/labels`)
    .reply(code, 'labels', etag ? {etag} : undefined);
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

function addLabelsReqHeaders(
  owner: string,
  repo: string,
  status: number,
  etag: string
) {
  return nock('https://api.github.com', {
    reqheaders: {
      'if-none-match': `'${etag}'`,
    },
  })
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
  let getSecretStub: SinonStub;
  let checkPRAgainstConfigV2Stub: SinonStub;
  let getAuthenticatedOctokitStub: SinonStub;

  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    probot = createProbot({
      defaults: {
        githubToken: 'abc123',
        Octokit: TestingOctokit,
      },
    });
    probot.load(autoApprove.handler);

    checkPRAgainstConfigStub = sandbox.stub(checkPR, 'checkPRAgainstConfig');
    getChangedFilesStub = sandbox.stub(getPRInfo, 'getChangedFiles');
    getBlobFromPRFilesStub = sandbox.stub(getPRInfo, 'getBlobFromPRFiles');
    checkAutoApproveStub = sandbox.stub(checkConfig, 'checkAutoApproveConfig');
    getSecretStub = sandbox.stub(autoApprove, 'authenticateWithSecret');
    checkPRAgainstConfigV2Stub = sandbox.stub(
      checkPRV2,
      'checkPRAgainstConfigV2'
    );
    getAuthenticatedOctokitStub = sandbox.stub(
      gcfUtilsModule,
      'getAuthenticatedOctokit'
    );
    getAuthenticatedOctokitStub.resolves(new Octokit());
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('main auto-approve function', () => {
    describe('config exists on main branch', () => {
      it('approves and tags a PR if a config exists & is valid & PR is valid', async () => {
        checkPRAgainstConfigStub.returns(true);
        checkAutoApproveStub.returns('');
        getSecretStub.returns(new Octokit({auth: '123'}));
        getChangedFilesStub.returns([{sha: '1234', filename: 'filename.txt'}]);

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        const scopes = [
          getConfigFile(
            'testOwner',
            'testRepo',
            {rules: [{author: 'fake-author', title: 'fake-title'}]},
            200
          ),
          getReviewsCompleted('testOwner', 'testRepo', []),
          submitReview('testOwner', 'testRepo', 200),
          listLabels('testOwner', 'testRepo', 200),
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

      it('still attempts to add an automerge: exact label if there is an approval', async () => {
        checkPRAgainstConfigStub.returns(true);
        checkAutoApproveStub.returns('');
        getSecretStub.returns(new Octokit({auth: '123'}));
        getChangedFilesStub.returns([{sha: '1234', filename: 'filename.txt'}]);

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        const scopes = [
          getConfigFile(
            'testOwner',
            'testRepo',
            {rules: [{author: 'fake-author', title: 'fake-title'}]},
            200
          ),
          getReviewsCompleted('testOwner', 'testRepo', [
            {
              user: {login: 'yoshi-approver'},
              state: 'APPROVED',
              commit_id: '6dcb09b5b57875f334f61aebed695e2e4193db5e',
              id: 12345,
            },
          ]),
          createCheck('testOwner', 'testRepo', 200),
          listLabels('testOwner', 'testRepo', 200),
          addLabels('testOwner', 'testRepo', 200),
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
        getSecretStub.returns(new Octokit({auth: '123'}));
        getChangedFilesStub.returns([{sha: '1234', filename: 'filename.txt'}]);

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened_fork'
        ));

        const scopes = [
          getConfigFile(
            'GoogleCloudPlatform',
            'python-docs-samples',
            {rules: [{author: 'fake-author', title: 'fake-title'}]},
            200
          ),
          getReviewsCompleted('GoogleCloudPlatform', 'python-docs-samples', []),
          submitReview('GoogleCloudPlatform', 'python-docs-samples', 200),
          listLabels('GoogleCloudPlatform', 'python-docs-samples', 200),
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

      it('retries if etag is not current', async () => {
        checkPRAgainstConfigStub.returns(true);
        checkAutoApproveStub.returns('');
        getSecretStub.returns(new Octokit({auth: '123'}));
        getChangedFilesStub.returns([{sha: '1234', filename: 'filename.txt'}]);

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        const scopes = [
          getConfigFile(
            'testOwner',
            'testRepo',
            {rules: [{author: 'fake-author', title: 'fake-title'}]},
            200
          ),
          getReviewsCompleted('testOwner', 'testRepo', []),
          submitReview('testOwner', 'testRepo', 200),
          listLabels('testOwner', 'testRepo', 200),
          addLabels('testOwner', 'testRepo', 412),
          listLabels('testOwner', 'testRepo', 200),
          addLabels('testOwner', 'testRepo', 412),
          listLabels('testOwner', 'testRepo', 200),
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

      it('stops retrying to add the label after 3 attempts, even if it is never successful', async () => {
        checkPRAgainstConfigStub.returns(true);
        checkAutoApproveStub.returns('');
        getSecretStub.returns(new Octokit({auth: '123'}));
        getChangedFilesStub.returns([{sha: '1234', filename: 'filename.txt'}]);

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        const scopes = [
          getConfigFile(
            'testOwner',
            'testRepo',
            {rules: [{author: 'fake-author', title: 'fake-title'}]},
            200
          ),
          createCheck('testOwner', 'testRepo', 200),
          getReviewsCompleted('testOwner', 'testRepo', []),
          submitReview('testOwner', 'testRepo', 200),
          listLabels('testOwner', 'testRepo', 200),
          addLabels('testOwner', 'testRepo', 412),
          listLabels('testOwner', 'testRepo', 200),
          addLabels('testOwner', 'testRepo', 412),
          listLabels('testOwner', 'testRepo', 200),
          addLabels('testOwner', 'testRepo', 412),
          listLabels('testOwner', 'testRepo', 200),
          addLabels('testOwner', 'testRepo', 412),
        ];

        await assert.rejects(
          async () =>
            await probot.receive({
              name: 'pull_request',
              payload,
              id: 'abc123',
            })
        );

        scopes.forEach(scope => scope.done());
        assert.ok(getChangedFilesStub.calledOnce);
      });

      it('respects weak matching of if-none-match', async () => {
        const scopes = [
          listLabels('testOwner', 'testRepo', 200, 'W/"19d7"'),
          addLabelsReqHeaders('testOwner', 'testRepo', 200, 'W/"19d7"'),
        ];

        await autoApprove.retryAddLabel(
          0,
          'testOwner',
          'testRepo',
          1,
          new Octokit()
        );
        scopes.forEach(scope => scope.done());
      });

      it('submits a failing check if config exists but is not valid', async () => {
        checkPRAgainstConfigStub.returns(true);
        checkAutoApproveStub.returns([
          {
            wrongProperty: 'wrongProperty',
            message: 'message',
          },
        ]);

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));
        getChangedFilesStub.returns([{sha: '1234', filename: 'filename.txt'}]);

        const scopes = [
          getConfigFile(
            'testOwner',
            'testRepo',
            {rules: [{author: 'fake-author', title: 'fake-title'}]},
            200
          ),
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
        getChangedFilesStub.returns([{sha: '1234', filename: 'filename.txt'}]);

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        const scopes = [
          getConfigFile(
            'testOwner',
            'testRepo',
            {rules: [{author: 'fake-author', title: 'fake-title'}]},
            200
          ),
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
        getChangedFilesStub.returns([{sha: '1234', filename: 'filename.txt'}]);
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

      it('uses the correct function to check the PR if the config is V2', async () => {
        const validPR = fs.readFileSync(
          resolve(
            fixturesPath,
            'config',
            'valid-schemasV2',
            'valid-schema1.yml'
          ),
          'utf8'
        );

        getChangedFilesStub.returns([{sha: '1234', filename: 'filename.txt'}]);
        checkPRAgainstConfigV2Stub.returns(true);
        checkAutoApproveStub.returns('');
        getSecretStub.returns(new Octokit({auth: '123'}));

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened_right_author_and_title_file_count'
        ));

        const scopes = [
          getConfigFile(
            'testOwner',
            'testRepo',
            validPR as unknown as ConfigurationV2,
            200
          ),
          getReviewsCompleted('testOwner', 'testRepo', []),
          submitReview('testOwner', 'testRepo', 200),
          listLabels('testOwner', 'testRepo', 200),
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
        assert.ok(checkPRAgainstConfigV2Stub.calledOnce);
      });

      it('uses the correct function to check the PR if the config is V1', async () => {
        const validPR = fs.readFileSync(
          resolve(fixturesPath, 'config', 'valid-schemas', 'valid-schema1.yml'),
          'utf8'
        );

        getChangedFilesStub.returns([{sha: '1234', filename: 'filename.txt'}]);
        checkPRAgainstConfigStub.returns(true);
        checkAutoApproveStub.returns('');
        getSecretStub.returns(new Octokit({auth: '123'}));

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened_right_author_and_title_file_count'
        ));

        const scopes = [
          getConfigFile(
            'testOwner',
            'testRepo',
            validPR as unknown as ConfigurationV2,
            200
          ),
          getReviewsCompleted('testOwner', 'testRepo', []),
          submitReview('testOwner', 'testRepo', 200),
          listLabels('testOwner', 'testRepo', 200),
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
        assert.ok(checkPRAgainstConfigStub.calledOnce);
      });
    });

    describe('config does not exist on main branch', () => {
      it('ignores the PR, if neither config exists on PR or repo', async () => {
        getChangedFilesStub.returns([{sha: '1234', filename: 'filename.txt'}]);
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
        assert.ok(getBlobFromPRFilesStub.calledOnce);
      });

      it('gracefully exits if files cannot be retrieved from getChangedFiles', async () => {
        getChangedFilesStub.restore();
        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        const scopes = [listFiles('testOwner', 'testRepo', 404, undefined)];

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });
        scopes.forEach(scope => scope.done());
      });

      it('attempts to create a passing status check if PR contains correct config', async () => {
        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        getChangedFilesStub.returns([{sha: '1234', filename: 'filename.txt'}]);
        getBlobFromPRFilesStub.returns('fake-file');
        checkAutoApproveStub.returns('');
        const scopes = [createCheck('testOwner', 'testRepo', 200)];

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });
        scopes.forEach(scope => scope.done());
        assert.ok(getChangedFilesStub.calledOnce);
        assert.ok(getBlobFromPRFilesStub.calledOnce);
      });

      it('attempts to create a failing status check if PR contains wrong config, and error messages check out', async () => {
        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        getChangedFilesStub.returns([{sha: '1234', filename: 'filename.txt'}]);
        getBlobFromPRFilesStub.returns('fake-file');
        checkAutoApproveStub.returns([
          {
            wrongProperty: 'wrongProperty',
            message: 'message',
          },
        ]);

        const scopes = [createCheck('testOwner', 'testRepo', 200)];

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });
        scopes.forEach(scope => scope.done());
        assert.ok(getChangedFilesStub.calledOnce);
        assert.ok(getBlobFromPRFilesStub.calledOnce);
      });

      it('passes PR if auto-approve is on main, not PR', async () => {
        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        getSecretStub.returns(new Octokit({auth: '123'}));
        checkPRAgainstConfigStub.returns(true);
        getBlobFromPRFilesStub.returns(undefined);
        checkAutoApproveStub.returns('');
        getChangedFilesStub.returns([{sha: '1234', filename: 'filename.txt'}]);

        const scopes = [
          getConfigFile(
            'testOwner',
            'testRepo',
            {rules: [{author: 'fake-author', title: 'fake-title'}]},
            200
          ),
          getReviewsCompleted('testOwner', 'testRepo', []),
          submitReview('testOwner', 'testRepo', 200),
          listLabels('testOwner', 'testRepo', 200),
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
        assert.ok(getBlobFromPRFilesStub.calledOnce);
      });
    });
  });

  describe('gets secrets and authenticates separately for approval', () => {
    it('creates a separate octokit instance and authenticates with secret in secret manager', async () => {
      checkPRAgainstConfigStub.returns(true);
      checkAutoApproveStub.returns('');
      getChangedFilesStub.returns([{sha: '1234', filename: 'filename.txt'}]);

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
        getConfigFile(
          'testOwner',
          'testRepo',
          {rules: [{author: 'fake-author', title: 'fake-title'}]},
          200
        ),
        getReviewsCompleted('testOwner', 'testRepo', []),
        submitReview('testOwner', 'testRepo', 200),
        listLabels('testOwner', 'testRepo', 200),
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
  });

  describe('evaluate and submit auto approve check', () => {
    it('returns undefined if auto approve is not configured on the repo', async () => {
      checkAutoApproveStub.throws(new AutoApproveNotConfigured());

      assert.strictEqual(
        await autoApprove.evaluateAndSubmitCheckForConfig(
          'testOwner',
          'testRepo',
          'config',
          new Octokit(),
          '1234'
        ),
        undefined
      );
    });
  });

  describe('RELEASE_FREEZE', () => {
    it('returns early if RELEASE_FREEZE is truthy and PR is from release-please', async () => {
      sandbox.stub(process, 'env').value({});
      process.env.RELEASE_FREEZE = 'true';
      const consoleStub = sandbox.stub(logger, 'info');

      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_release_please'
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
