// Copyright 2020 Google LLC
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
import {Octokit} from '@octokit/rest';
import myProbotApp from '../src/bot';
import {resolve} from 'path';
import {Probot, createProbot, ProbotOctokit} from 'probot';
import nock from 'nock';
import * as fs from 'fs';
import yaml from 'js-yaml';
import {describe, it, beforeEach} from 'mocha';
import * as assert from 'assert';
import * as sinon from 'sinon';
import * as botConfigModule from '@google-automations/bot-config-utils';
import * as releaseTriggerModule from '../src/release-trigger';

const sandbox = sinon.createSandbox();
nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

function buildFakePullRequest(
  owner: string,
  repo: string,
  number: number
): releaseTriggerModule.PullRequest {
  return {
    html_url: `https://github.com/${owner}/${repo}/pull/${number}`,
    number,
    state: 'closed',
    labels: [{name: 'autorelease: tagged'}],
    merge_commit_sha: 'abcd1234',
    base: {
      repo: {
        owner: {
          login: owner,
        },
        name: repo,
      },
    },
  };
}

describe('bot', () => {
  let probot: Probot;
  let getConfigStub: sinon.SinonStub;

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
    getConfigStub = sandbox.stub(botConfigModule, 'getConfigWithDefault');
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
      getConfigStub.resolves({enabled: true});
      const findPullRequestsStub = sandbox
        .stub(releaseTriggerModule, 'findPendingReleasePullRequests')
        .resolves([
          buildFakePullRequest('Codertocat', 'Hello-World', 1234),
          buildFakePullRequest('Codertocat', 'Hello-World', 1235),
        ]);
      const triggerKokoroJobStub = sandbox
        .stub(releaseTriggerModule, 'triggerKokoroJob')
        .resolves({stdout: '', stderr: ''});
      const markTriggeredStub = sandbox
        .stub(releaseTriggerModule, 'markTriggered')
        .resolves();

      await probot.receive({
        name: 'release.published',
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
        sinon.match.has(
          'html_url',
          'https://github.com/Codertocat/Hello-World/pull/1234'
        )
      );
      sinon.assert.calledWith(
        markTriggeredStub,
        sinon.match.any,
        sinon.match.has(
          'html_url',
          'https://github.com/Codertocat/Hello-World/pull/1235'
        )
      );
    });
  });

  describe('on pull request unlabeled', () => {
    it('should trigger a kokoro job if the label removed was autorelease: triggered', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/pull_request_unlabeled'
      ));
      getConfigStub.resolves({enabled: true});
      const triggerKokoroJobStub = sandbox
        .stub(releaseTriggerModule, 'triggerKokoroJob')
        .resolves({stdout: '', stderr: ''});
      const markTriggeredStub = sandbox
        .stub(releaseTriggerModule, 'markTriggered')
        .resolves();

      await probot.receive({
        name: 'pull_request.unlabeled',
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
        sinon.match.has(
          'html_url',
          'https://github.com/Codertocat/Hello-World/pull/2'
        )
      );
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
        name: 'pull_request.unlabeled',
        payload: payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(getConfigStub);
      sinon.assert.notCalled(triggerKokoroJobStub);
      sinon.assert.notCalled(markTriggeredStub);
    });
  });
});
