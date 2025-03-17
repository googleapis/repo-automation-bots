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
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import nock from 'nock';
import {describe, it, beforeEach} from 'mocha';
import * as sinon from 'sinon';
import * as gcfUtilsModule from 'gcf-utils';
import * as botConfigUtilsModule from '@google-automations/bot-config-utils';
import * as cherryPickModule from '../src/cherry-pick';
import * as branchProtectionModule from '../src/branch-protection';
import * as fs from 'fs';
import snapshot from 'snap-shot-it';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');
const fetch = require('node-fetch');

function createConfigResponse(configFile: string) {
  const config = fs.readFileSync(resolve(fixturesPath, configFile));
  const base64Config = config.toString('base64');
  return {
    sha: '',
    node_id: '',
    size: base64Config.length,
    url: '',
    content: base64Config,
    encoding: 'base64',
  };
}

describe('cherry-pick-bot config validation', () => {
  let probot: Probot;
  const sandbox = sinon.createSandbox();

  let getAuthenticatedOctokitStub: sinon.SinonStub;

  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      }),
    });
    probot.load(myProbotApp);

    getAuthenticatedOctokitStub = sandbox.stub(
      gcfUtilsModule,
      'getAuthenticatedOctokit'
    );

    getAuthenticatedOctokitStub.resolves(new Octokit({request: {fetch}}));
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  it('submits a failing check with a broken config file', async () => {
    const payload = require(resolve(
      fixturesPath,
      'events',
      'pull_request_opened'
    ));
    const files_payload = require(resolve(
      fixturesPath,
      'data',
      'pull_request_files_config_added'
    ));
    const configBlob = createConfigResponse('config/broken-config.yml');

    const requests = nock('https://api.github.com')
      .get('/repos/Codertocat/Hello-World/pulls/2/files?per_page=50')
      .reply(200, files_payload)
      .get(
        '/repos/Codertocat/Hello-World/git/blobs/223828dbd668486411b475665ab60855ba9898f3'
      )
      .reply(200, configBlob)
      .post('/repos/Codertocat/Hello-World/check-runs', body => {
        snapshot(body);
        return true;
      })
      .reply(200);

    await probot.receive({
      name: 'pull_request',
      payload,
      id: 'abc123',
    });

    requests.done();
  });

  it('submits a failing check with an invalid enum', async () => {
    const payload = require(resolve(
      fixturesPath,
      'events',
      'pull_request_opened'
    ));
    const files_payload = require(resolve(
      fixturesPath,
      'data',
      'pull_request_files_config_added'
    ));
    const configBlob = createConfigResponse(
      'config/broken-allowed-authors.yml'
    );

    const requests = nock('https://api.github.com')
      .get('/repos/Codertocat/Hello-World/pulls/2/files?per_page=50')
      .reply(200, files_payload)
      .get(
        '/repos/Codertocat/Hello-World/git/blobs/223828dbd668486411b475665ab60855ba9898f3'
      )
      .reply(200, configBlob)
      .post('/repos/Codertocat/Hello-World/check-runs', body => {
        snapshot(body);
        return true;
      })
      .reply(200);

    await probot.receive({
      name: 'pull_request',
      payload,
      id: 'abc123',
    });

    requests.done();
  });

  it('does not submits a failing check with a correct config file', async () => {
    const payload = require(resolve(
      fixturesPath,
      'events',
      'pull_request_opened'
    ));
    const files_payload = require(resolve(
      fixturesPath,
      'data',
      'pull_request_files_config_added'
    ));
    const configBlob = createConfigResponse('config/valid-config.yml');

    const requests = nock('https://api.github.com')
      .get('/repos/Codertocat/Hello-World/pulls/2/files?per_page=50')
      .reply(200, files_payload)
      .get(
        '/repos/Codertocat/Hello-World/git/blobs/223828dbd668486411b475665ab60855ba9898f3'
      )
      .reply(200, configBlob);

    await probot.receive({
      name: 'pull_request',
      payload,
      id: 'abc123',
    });

    requests.done();
  });

  it('does not submits a failing check with a correct config file with allowed authors', async () => {
    const payload = require(resolve(
      fixturesPath,
      'events',
      'pull_request_opened'
    ));
    const files_payload = require(resolve(
      fixturesPath,
      'data',
      'pull_request_files_config_added'
    ));
    const configBlob = createConfigResponse('config/allowed-authors.yml');

    const requests = nock('https://api.github.com')
      .get('/repos/Codertocat/Hello-World/pulls/2/files?per_page=50')
      .reply(200, files_payload)
      .get(
        '/repos/Codertocat/Hello-World/git/blobs/223828dbd668486411b475665ab60855ba9898f3'
      )
      .reply(200, configBlob);

    await probot.receive({
      name: 'pull_request',
      payload,
      id: 'abc123',
    });

    requests.done();
  });
});

describe('cherry-pick-bot', () => {
  let probot: Probot;
  const sandbox = sinon.createSandbox();

  let cherryPickPullRequestStub: sinon.SinonStub;
  let getAuthenticatedOctokitStub: sinon.SinonStub;

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
    getAuthenticatedOctokitStub = sandbox.stub(
      gcfUtilsModule,
      'getAuthenticatedOctokit'
    );
    getAuthenticatedOctokitStub.resolves(new Octokit({request: {fetch}}));
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
        .reply(200, {
          merge_commit_sha: 'abc123',
          base: {ref: 'main'},
          merged: true,
        });

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

    it('allows overriding allow author association', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_comment_created_non_member'
      ));

      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/pulls/1')
        .reply(200, {
          merge_commit_sha: 'abc123',
          base: {ref: 'main'},
          merged: true,
        });

      sandbox.stub(botConfigUtilsModule, 'getConfig').resolves({
        enabled: true,
        allowedAuthorAssociations: ['OWNER', 'FIRST_TIMER'],
      });
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

    it('ignores issues', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_comment_created_command'
      ));

      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/pulls/1')
        .reply(404, 'Pull request not found');

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

    it('ignores unmerged pull request with sha', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_comment_created_command'
      ));

      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/pulls/1')
        .reply(200, {
          merge_commit_sha: 'abc123',
          base: {ref: 'main'},
          merged: false,
        });

      sandbox.stub(botConfigUtilsModule, 'getConfig').resolves({enabled: true});

      await probot.receive({
        name: 'issue_comment',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(cherryPickPullRequestStub);
      requests.done();
    });

    it('comments on a merge conflict', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'issue_comment_created_command'
      ));

      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/pulls/1')
        .reply(200, {
          merge_commit_sha: 'abc123',
          base: {ref: 'main'},
          merged: true,
        })
        .post('/repos/Codertocat/Hello-World/issues/1/comments')
        .reply(200);

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
      cherryPickPullRequestStub.rejects(
        new cherryPickModule.MergeConflictError('foo', 'abc123', new Error())
      );

      await probot.receive({
        name: 'issue_comment',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(cherryPickPullRequestStub);
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

    it('ignores non-cherry-pick comments', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_merged'
      ));
      const comments = require(resolve(
        fixturesPath,
        'data',
        'issue_comments_non_cherry_pick'
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

    it('comments on a merge conflict', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_merged'
      ));
      const comments = require(resolve(fixturesPath, 'data', 'issue_comments'));

      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/issues/2/comments')
        .reply(200, comments)
        .post('/repos/Codertocat/Hello-World/issues/2/comments')
        .twice()
        .reply(200);

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
      cherryPickPullRequestStub.rejects(
        new cherryPickModule.MergeConflictError('foo', 'abc123', new Error())
      );

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledTwice(cherryPickPullRequestStub);
      requests.done();
    });
  });
});
