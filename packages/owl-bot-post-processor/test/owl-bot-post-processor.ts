// Copyright 2021 Google LLC
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

// TODO(@bcoe): some of these keys are required by gcf-utils already,
// make sure we use the same name:
process.env.APP_ID = '1234354';
process.env.GCLOUD_PROJECT = 'foo-project';
process.env.GITHUB_PRIVATE_KEY = 'abc123';
process.env.CLOUD_BUILD_TRIGGER = 'aef1e540-d401-4b85-8127-b72b5993c20d';

import {core} from '../src/core';
import {describe, it, beforeEach} from 'mocha';
import {logger} from 'gcf-utils';
import OwlBotPostProcessor from '../src/owl-bot-post-processor';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import * as sinon from 'sinon';
import nock from 'nock';

nock.disableNetConnect();
const sandbox = sinon.createSandbox();

describe('OwlBotPostProcessor', () => {
  let probot: Probot;
  beforeEach(() => {
    probot = createProbot({
      overrides: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
      },
    });
    probot.load(OwlBotPostProcessor);
  });
  afterEach(() => {
    sandbox.restore();
  });
  it('returns early and logs if pull request opened from fork', async () => {
    const payload = {
      installation: {
        id: 12345,
      },
      pull_request: {
        head: {
          repo: {
            full_name: 'bcoe/owl-bot-testing',
          },
        },
        base: {
          repo: {
            full_name: 'SurferJeffAtGoogle/owl-bot-testing',
          },
        },
      },
    };
    const loggerStub = sandbox.stub(logger, 'info');
    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    sandbox.assert.calledWith(
      loggerStub,
      sandbox.match(/.*does not match base.*/)
    );
  });
  it('triggers build if pull request not from fork', async () => {
    const payload = {
      installation: {
        id: 12345,
      },
      pull_request: {
        head: {
          repo: {
            full_name: 'bcoe/owl-bot-testing',
          },
          ref: 'abc123',
        },
        base: {
          repo: {
            full_name: 'bcoe/owl-bot-testing',
          },
        },
      },
    };
    const config = `docker:
    image: node
    digest: sha256:9205bb385656cd196f5303b03983282c95c2dfab041d275465c525b501574e5c`;
    nock('https://api.github.com')
      .get('/repos/bcoe/owl-bot-testing/pulls/')
      .reply(200, payload.pull_request)
      .get(
        '/repos/bcoe/owl-bot-testing/contents/.github%2F.OwlBot.lock.yaml?ref=abc123'
      )
      .reply(200, {
        content: Buffer.from(config).toString('base64'),
        encoding: 'base64',
      });
    const triggerBuildStub = sandbox.stub(core, 'triggerBuild').resolves({
      text: 'the text for check',
      summary: 'summary for check',
      conclusion: 'success',
    });
    const createCheckStub = sandbox.stub(core, 'createCheck');
    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    sandbox.assert.calledOnce(triggerBuildStub);
    sandbox.assert.calledOnce(createCheckStub);
  });
});
