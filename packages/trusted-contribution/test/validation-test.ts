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

// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import {describe, it, beforeEach} from 'mocha';
import {resolve} from 'path';
import * as fs from 'fs';
import sinon from 'sinon';
import nock from 'nock';
import snapshot from 'snap-shot-it';
import * as botConfigModule from '@google-automations/bot-config-utils';

import {WELL_KNOWN_CONFIGURATION_FILE} from '../src/config';
import myProbotApp from '../src/trusted-contribution';

nock.disableNetConnect();
const fixturesPath = resolve(__dirname, '../../test/fixtures');

const OWNER = 'chingor13';
const REPO = 'google-auth-library-java';
const PR_NUMBER = 3;

// Emulate getContent and getBlob.
function createConfigResponse(configFile: string) {
  const config = fs.readFileSync(resolve(fixturesPath, configFile));
  const base64Config = config.toString('base64');
  return {
    size: base64Config.length,
    content: base64Config,
    encoding: 'base64',
  };
}

// Emulate the given config file is modified in the PR.
function fetchFilesInPR(configFile: string) {
  return nock('https://api.github.com')
    .get(`/repos/${OWNER}/${REPO}/pulls/${PR_NUMBER}/files?per_page=100`)
    .reply(200, [
      {
        filename: `.github/${WELL_KNOWN_CONFIGURATION_FILE}`,
        sha: 'testsha',
      },
    ])
    .get(`/repos/${OWNER}/${REPO}/git/blobs/testsha`)
    .reply(200, createConfigResponse(configFile));
}

describe('trusted-contribution bot', () => {
  const sandbox = sinon.createSandbox();
  let probot: Probot;
  let getConfigStub: sinon.SinonStub;
  const payload = require(resolve(fixturesPath, './pull_request_opened'));

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
    probot.load(myProbotApp);
    getConfigStub = sandbox.stub(botConfigModule, 'getConfig');
    // This test is only for config validation.
    getConfigStub.resolves({disabled: true});
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  describe('config schema check on PRs', () => {
    it('should not create a failing status check for a custom config', async () => {
      const scope = fetchFilesInPR('custom.yml');
      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      scope.done();
    });
    it('should not create a failing status check for a disabled config', async () => {
      const scope = fetchFilesInPR('disabled.yml');
      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      scope.done();
    });
    it('should create a failing status check for a broken config', async () => {
      const scope = fetchFilesInPR('broken.yml')
        .post(`/repos/${OWNER}/${REPO}/check-runs`, body => {
          snapshot(body);
          return true;
        })
        .reply(200);
      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      scope.done();
    });
  });
});
