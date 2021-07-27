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

const sandbox = sinon.createSandbox();
nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

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
  })

  describe('on release publish', () => {
    it('should trigger a kokoro job via releasetool', async () => {
      const payload = require(resolve(
        fixturesPath,
        './events/release_published'
      ));
      getConfigStub.resolves({enabled: true});

      const scopes = nock('https://api.github.com')
        .get(
          '/repos/Codertocat/Hello-World/pulls?state=closed&sort=updated&direction=desc'
        )
        .reply(200, []);

      await probot.receive({
        name: 'release.published',
        payload: payload,
        id: 'abc123',
      });

      scopes.done();
    });
  });

  describe('on pull request unlabelled', () => {
    it('should trigger a kokoro job if the label removed was autorelease: triggered', async () => {

    });

    it('should ignore other labels', async () => {

    });
  });
});
