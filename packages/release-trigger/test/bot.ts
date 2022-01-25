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

/* eslint-disable node/no-extraneous-import */
import myProbotApp from '../src/bot';
import {resolve} from 'path';
import {Probot, createProbot, ProbotOctokit} from 'probot';
import nock from 'nock';
import {describe, it, beforeEach} from 'mocha';
import * as sinon from 'sinon';
import * as botConfigModule from '@google-automations/bot-config-utils';
import * as releaseTriggerModule from '../src/release-trigger';
import {DatastoreLock} from '@google-automations/datastore-lock';

const sandbox = sinon.createSandbox();
nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

function buildFakePullRequest(
  owner: string,
  repo: string,
  number: number,
  labels: string[] = ['autorelease: tagged']
): releaseTriggerModule.PullRequest {
  return {
    html_url: `https://github.com/${owner}/${repo}/pull/${number}`,
    number,
    state: 'closed',
    labels: labels.map(label => {
      return {name: label};
    }),
    merge_commit_sha: 'abcd1234',
    base: {
      repo: {
        owner: {
          login: owner,
        },
        name: repo,
      },
    },
    closed_at: '2021-08-15T19:01:12Z',
  };
}

describe('bot', () => {
  let probot: Probot;
  let getConfigStub: sinon.SinonStub;
  let datastoreLockAcquireStub: sinon.SinonStub;
  let datastoreLockReleaseStub: sinon.SinonStub;

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
    getConfigStub = sandbox.stub(botConfigModule, 'getConfig');
    datastoreLockAcquireStub = sandbox.stub(DatastoreLock.prototype, 'acquire');
    datastoreLockReleaseStub = sandbox.stub(DatastoreLock.prototype, 'release');
    sandbox.replace(releaseTriggerModule, 'ALLOWED_ORGANIZATIONS', [
      'Codertocat',
    ]);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('on release publish', () => {
    it('should trigger a kokoro job via releasetool', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/release_published'
      ));
      const pull1 = buildFakePullRequest('Codertocat', 'Hello-World', 1234);
      const pull2 = buildFakePullRequest('Codertocat', 'Hello-World', 1235);
      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/pulls/1234')
        .reply(200, pull1)
        .get('/repos/Codertocat/Hello-World/pulls/1235')
        .reply(200, pull2);

      getConfigStub.resolves({enabled: true});
      datastoreLockAcquireStub.resolves(true);
      datastoreLockReleaseStub.resolves(true);
      const findPullRequestsStub = sandbox
        .stub(releaseTriggerModule, 'findPendingReleasePullRequests')
        .resolves([pull1, pull2]);
      const triggerKokoroJobStub = sandbox
        .stub(releaseTriggerModule, 'triggerKokoroJob')
        .resolves({stdout: '', stderr: ''});
      const markTriggeredStub = sandbox
        .stub(releaseTriggerModule, 'markTriggered')
        .resolves();

      await probot.receive({
        name: 'release',
        payload: payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(getConfigStub);
      sinon.assert.calledOnce(findPullRequestsStub);
      sinon.assert.calledWith(
        triggerKokoroJobStub,
        'https://github.com/Codertocat/Hello-World/pull/1234'
      );
      sinon.assert.calledWith(
        triggerKokoroJobStub,
        'https://github.com/Codertocat/Hello-World/pull/1235'
      );
      sinon.assert.calledWith(
        markTriggeredStub,
        sinon.match.any,
        sinon.match({owner: 'Codertocat', repo: 'Hello-World', number: 1234})
      );
      sinon.assert.calledWith(
        markTriggeredStub,
        sinon.match.any,
        sinon.match({owner: 'Codertocat', repo: 'Hello-World', number: 1235})
      );
      requests.done();
    });

    it('should ignore if pull request already triggered', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/release_published'
      ));
      const pull1 = buildFakePullRequest('Codertocat', 'Hello-World', 1234);
      const pull1Triggered = buildFakePullRequest(
        'Codertocat',
        'Hello-World',
        1234,
        ['autorelease: tagged', 'autorelease: triggered']
      );
      const pull2 = buildFakePullRequest('Codertocat', 'Hello-World', 1235);
      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/pulls/1234')
        .reply(200, pull1Triggered)
        .get('/repos/Codertocat/Hello-World/pulls/1235')
        .reply(200, pull2);

      getConfigStub.resolves({enabled: true});
      datastoreLockAcquireStub.resolves(true);
      datastoreLockReleaseStub.resolves(true);
      const findPullRequestsStub = sandbox
        .stub(releaseTriggerModule, 'findPendingReleasePullRequests')
        .resolves([pull1, pull2]);
      const triggerKokoroJobStub = sandbox
        .stub(releaseTriggerModule, 'triggerKokoroJob')
        .resolves({stdout: '', stderr: ''});
      const markTriggeredStub = sandbox
        .stub(releaseTriggerModule, 'markTriggered')
        .resolves();

      await probot.receive({
        name: 'release',
        payload: payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(getConfigStub);
      sinon.assert.calledOnce(findPullRequestsStub);
      sinon.assert.calledOnce(triggerKokoroJobStub);
      sinon.assert.calledWith(
        triggerKokoroJobStub,
        'https://github.com/Codertocat/Hello-World/pull/1235'
      );
      sinon.assert.calledOnce(markTriggeredStub);
      sinon.assert.calledWith(
        markTriggeredStub,
        sinon.match.any,
        sinon.match({owner: 'Codertocat', repo: 'Hello-World', number: 1235})
      );
      requests.done();
    });
  });

  describe('on pull request unlabeled', () => {
    it('should trigger a kokoro job if the label removed was autorelease: triggered', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/pull_request_unlabeled'
      ));
      getConfigStub.resolves({enabled: true});
      datastoreLockAcquireStub.resolves(true);
      datastoreLockReleaseStub.resolves(true);
      const pull = buildFakePullRequest('Codertocat', 'Hello-World', 2);
      const requests = nock('https://api.github.com')
        .get('/repos/Codertocat/Hello-World/pulls/2')
        .reply(200, pull);
      const triggerKokoroJobStub = sandbox
        .stub(releaseTriggerModule, 'triggerKokoroJob')
        .resolves({stdout: '', stderr: ''});
      const markTriggeredStub = sandbox
        .stub(releaseTriggerModule, 'markTriggered')
        .resolves();

      await probot.receive({
        name: 'pull_request',
        payload: payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(getConfigStub);
      sinon.assert.calledWith(
        triggerKokoroJobStub,
        'https://github.com/Codertocat/Hello-World/pull/2'
      );
      sinon.assert.calledWith(
        markTriggeredStub,
        sinon.match.any,
        sinon.match({owner: 'Codertocat', repo: 'Hello-World', number: 2})
      );
      requests.done();
    });

    it('should ignore if pull request is not tagged', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/pull_request_unlabeled_untagged'
      ));
      getConfigStub.resolves({enabled: true});
      const triggerKokoroJobStub = sandbox
        .stub(releaseTriggerModule, 'triggerKokoroJob')
        .resolves({stdout: '', stderr: ''});
      const markTriggeredStub = sandbox
        .stub(releaseTriggerModule, 'markTriggered')
        .resolves();

      await probot.receive({
        name: 'pull_request',
        payload: payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(getConfigStub);
      sinon.assert.notCalled(triggerKokoroJobStub);
      sinon.assert.notCalled(markTriggeredStub);
    });

    it('should ignore other labels', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/pull_request_unlabeled_other'
      ));
      getConfigStub.resolves({enabled: true});
      const triggerKokoroJobStub = sandbox
        .stub(releaseTriggerModule, 'triggerKokoroJob')
        .resolves({stdout: '', stderr: ''});
      const markTriggeredStub = sandbox
        .stub(releaseTriggerModule, 'markTriggered')
        .resolves();

      await probot.receive({
        name: 'pull_request',
        payload: payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(getConfigStub);
      sinon.assert.notCalled(triggerKokoroJobStub);
      sinon.assert.notCalled(markTriggeredStub);
    });
  });

  describe('on pull request labeled', () => {
    it('should remove labels if published', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/pull_request_labeled'
      ));
      getConfigStub.resolves({enabled: true});
      const cleanupStub = sandbox
        .stub(releaseTriggerModule, 'cleanupPublished')
        .resolves(true);

      await probot.receive({
        name: 'pull_request',
        payload: payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(getConfigStub);
      sinon.assert.calledOnce(cleanupStub);
    });

    it('should ignore other labels', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/pull_request_labeled_other'
      ));
      getConfigStub.resolves({enabled: true});
      const cleanupStub = sandbox
        .stub(releaseTriggerModule, 'cleanupPublished')
        .resolves(true);

      await probot.receive({
        name: 'pull_request',
        payload: payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(getConfigStub);
      sinon.assert.notCalled(cleanupStub);
    });
  });
});
