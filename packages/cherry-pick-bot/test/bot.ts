// Copyright 2022 Google LLC
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

import myProbotApp from '../src/bot';
import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import nock from 'nock';
import {describe, it, beforeEach} from 'mocha';
import * as sinon from 'sinon';
import * as botConfigUtilsModule from '@google-automations/bot-config-utils';
import * as cherryPickModule from '../src/cherry-pick';
import * as branchProtectionModule from '../src/branch-protection';

nock.disableNetConnect();

const sandbox = sinon.createSandbox();
const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('cherry-pick-bot', () => {
  let probot: Probot;
  let cherryPickPullRequestStub: sinon.SinonStub;

  beforeEach(() => {
    probot = createProbot({
      defaults: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
      },
    });
    probot.load(myProbotApp);

    cherryPickPullRequestStub = sandbox.stub(
      cherryPickModule,
      'cherryPickAsPullRequest'
    );
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('issue_comment', () => {
    it('creates a cherry-pick pull request', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_comment_created_command'
      ));

      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/pulls/1')
        .reply(200, {merge_commit_sha: 'abc123', base: {ref: 'main'}});

      sandbox.stub(botConfigUtilsModule, 'getConfig').resolves({enabled: true});
      sandbox
        .stub(branchProtectionModule, 'branchRequiresReviews')
        .withArgs(
          sinon.match.any,
          'Codertocat',
          'Hello-World',
          'feature-branch'
        )
        .resolves(false);
      cherryPickPullRequestStub.resolves({
        number: 123,
        html_url: 'https://github.com/Codertocat/Hello-World/pull/123',
        title: 'chore: cherry-pick abc123',
        body: null,
      });

      await probot.receive({
        name: 'issue_comment',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(cherryPickPullRequestStub);
      requests.done();
    });

    it('ignores non-configured repositories', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_comment_created_command'
      ));

      sandbox.stub(botConfigUtilsModule, 'getConfig').resolves(null);

      await probot.receive({
        name: 'issue_comment',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(cherryPickPullRequestStub);
    });

    it('ignores disabled repositories', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_comment_created_command'
      ));

      sandbox
        .stub(botConfigUtilsModule, 'getConfig')
        .resolves({enabled: false});

      await probot.receive({
        name: 'issue_comment',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(cherryPickPullRequestStub);
    });

    it('ignores non-contributors', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_comment_created_non_member'
      ));

      sandbox.stub(botConfigUtilsModule, 'getConfig').resolves({enabled: true});
      cherryPickPullRequestStub.resolves({
        number: 123,
        html_url: 'https://github.com/Codertocat/Hello-World/pull/123',
        title: 'chore: cherry-pick abc123',
        body: null,
      });

      await probot.receive({
        name: 'issue_comment',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(cherryPickPullRequestStub);
    });

    it('ignores issues', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_comment_created_command'
      ));

      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/pulls/1')
        .reply(404);

      sandbox.stub(botConfigUtilsModule, 'getConfig').resolves({enabled: true});
      cherryPickPullRequestStub.resolves({
        number: 123,
        html_url: 'https://github.com/Codertocat/Hello-World/pull/123',
        title: 'chore: cherry-pick abc123',
        body: null,
      });

      await probot.receive({
        name: 'issue_comment',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(cherryPickPullRequestStub);
      requests.done();
    });

    it('ignores non-command comments', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_comment_created'
      ));

      sandbox.stub(botConfigUtilsModule, 'getConfig').resolves({enabled: true});
      cherryPickPullRequestStub.resolves({
        number: 123,
        html_url: 'https://github.com/Codertocat/Hello-World/pull/123',
        title: 'chore: cherry-pick abc123',
        body: null,
      });

      await probot.receive({
        name: 'issue_comment',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(cherryPickPullRequestStub);
    });

    it('ignores unmerged pull request', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_comment_created_command'
      ));

      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/pulls/1')
        .reply(200, {merge_commit_sha: null, base: {ref: 'main'}});

      sandbox.stub(botConfigUtilsModule, 'getConfig').resolves({enabled: true});

      await probot.receive({
        name: 'issue_comment',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(cherryPickPullRequestStub);
      requests.done();
    });
  });

  describe('pull_request_closed', () => {
    it('creates a cherry-pick pull request', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_merged'
      ));
      const comments = require(resolve(fixturesPath, 'data', 'issue_comments'));

      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/issues/2/comments')
        .reply(200, comments);

      sandbox.stub(botConfigUtilsModule, 'getConfig').resolves({enabled: true});
      sandbox
        .stub(branchProtectionModule, 'branchRequiresReviews')
        .withArgs(
          sinon.match.any,
          'Codertocat',
          'Hello-World',
          'feature-branch'
        )
        .resolves(false);
      cherryPickPullRequestStub.resolves({
        number: 123,
        html_url: 'https://github.com/Codertocat/Hello-World/pull/123',
        title: 'chore: cherry-pick abc123',
        body: null,
      });

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledTwice(cherryPickPullRequestStub);
      requests.done();
    });

    it('ignores non-configured repositories', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_merged'
      ));

      sandbox.stub(botConfigUtilsModule, 'getConfig').resolves(null);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(cherryPickPullRequestStub);
    });

    it('ignores disabled repositories', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_merged'
      ));

      sandbox
        .stub(botConfigUtilsModule, 'getConfig')
        .resolves({enabled: false});

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(cherryPickPullRequestStub);
    });

    it('ignores non-contributors', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_merged'
      ));
      const comments = require(resolve(
        fixturesPath,
        'data',
        'issue_comments_non_member'
      ));

      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/issues/2/comments')
        .reply(200, comments);

      sandbox.stub(botConfigUtilsModule, 'getConfig').resolves({enabled: true});

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(cherryPickPullRequestStub);
      requests.done();
    });

    it('de-duplicates target branches', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_merged'
      ));
      const comments = require(resolve(
        fixturesPath,
        'data',
        'issue_comments_duplicated'
      ));

      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/issues/2/comments')
        .reply(200, comments);

      sandbox.stub(botConfigUtilsModule, 'getConfig').resolves({enabled: true});
      sandbox
        .stub(branchProtectionModule, 'branchRequiresReviews')
        .withArgs(
          sinon.match.any,
          'Codertocat',
          'Hello-World',
          'feature-branch'
        )
        .resolves(false);
      cherryPickPullRequestStub.resolves({
        number: 123,
        html_url: 'https://github.com/Codertocat/Hello-World/pull/123',
        title: 'chore: cherry-pick abc123',
        body: null,
      });

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(cherryPickPullRequestStub);
      requests.done();
    });

    it('ignores closed pull request', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_closed'
      ));

      sandbox
        .stub(botConfigUtilsModule, 'getConfig')
        .resolves({enabled: false});

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(cherryPickPullRequestStub);
    });

    it('cherry-picks branch protected request if base is protected', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_merged'
      ));
      const comments = require(resolve(fixturesPath, 'data', 'issue_comments'));

      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/issues/2/comments')
        .reply(200, comments);

      sandbox.stub(botConfigUtilsModule, 'getConfig').resolves({enabled: true});
      sandbox
        .stub(branchProtectionModule, 'branchRequiresReviews')
        .withArgs(
          sinon.match.any,
          'Codertocat',
          'Hello-World',
          'feature-branch'
        )
        .resolves(true)
        .withArgs(
          sinon.match.any,
          'Codertocat',
          'Hello-World',
          'preview-branch'
        )
        .resolves(true)
        .withArgs(sinon.match.any, 'Codertocat', 'Hello-World', 'master')
        .resolves(true);
      cherryPickPullRequestStub.resolves({
        number: 123,
        html_url: 'https://github.com/Codertocat/Hello-World/pull/123',
        title: 'chore: cherry-pick abc123',
        body: null,
      });

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledTwice(cherryPickPullRequestStub);
      requests.done();
    });

    it('ignores branch protected requests if base is not protected', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_merged'
      ));

      const comments = require(resolve(fixturesPath, 'data', 'issue_comments'));

      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/issues/2/comments')
        .reply(200, comments);

      sandbox.stub(botConfigUtilsModule, 'getConfig').resolves({enabled: true});
      sandbox
        .stub(branchProtectionModule, 'branchRequiresReviews')
        .withArgs(
          sinon.match.any,
          'Codertocat',
          'Hello-World',
          'feature-branch'
        )
        .resolves(true)
        .withArgs(
          sinon.match.any,
          'Codertocat',
          'Hello-World',
          'preview-branch'
        )
        .resolves(true)
        .withArgs(sinon.match.any, 'Codertocat', 'Hello-World', 'master')
        .resolves(false);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(cherryPickPullRequestStub);
      requests.done();
    });
  });
});
