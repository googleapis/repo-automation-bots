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

import {handler, logicForConfigCheck} from '../src/auto-approve';
import * as getPRInfo from '../src/get-PR-info';
import * as checkConfig from '../src/check-config';
import * as checkPR from '../src/check-pr';
import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import nock from 'nock';
import sinon, {SinonStub} from 'sinon';
import * as fs from 'fs';
import {describe, it, beforeEach} from 'mocha';
import * as assert from 'assert';
import yaml from 'js-yaml';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');
//const sandbox = sinon.createSandbox();

function getConfigFile(response: string, status: number) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/contents/.github%2Fauto-approve.yml')
    .reply(status, {response});
}

function submitReview(status: number) {
  return nock('https://api.github.com')
    .post('/repos/testOwner/testRepo/pulls/1/reviews/1/events')
    .reply(status);
}

function addLabels(status: number) {
  return nock('https://api.github.com')
    .post('/repos/testOwner/testRepo/issues/1/labels')
    .reply(status);
}

function createCheck(status: number) {
  return nock('https://api.github.com')
    .post('/repos/testOwner/testRepo/check-runs')
    .reply(status);
}

describe('auto-approve', () => {
  let probot: Probot;
  let checkPRAgainstConfigStub: SinonStub;
  let getChangedFilesStub: SinonStub;
  let getBlobFromPRFilesStub: SinonStub;
  let validateSchemaStub: SinonStub;
  let validateYamlStub: SinonStub;
  let checkCodeOwnersStub: SinonStub;

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
    probot.load(handler);

    checkPRAgainstConfigStub = sinon.stub(checkPR, 'checkPRAgainstConfig');
    getChangedFilesStub = sinon.stub(getPRInfo, 'getChangedFiles');
    getBlobFromPRFilesStub = sinon.stub(getPRInfo, 'getBlobFromPRFiles');
    validateSchemaStub = sinon.stub(checkConfig, 'validateSchema');
    validateYamlStub = sinon.stub(checkConfig, 'validateYaml');
    checkCodeOwnersStub = sinon.stub(checkConfig, 'checkCodeOwners');
  });

  afterEach(() => {
    checkPRAgainstConfigStub.restore();
    getChangedFilesStub.restore();
    getBlobFromPRFilesStub.restore();
    validateSchemaStub.restore();
    validateYamlStub.restore();
    checkCodeOwnersStub.restore();
  });

  describe('main auto-approve function', () => {
    describe('pull request-handling logic', () => {
      describe('config exists', () => {
        it('approves and tags a PR if a config exists & is valid & PR is valid', async () => {
          checkPRAgainstConfigStub.returns(true);
          validateYamlStub.returns(true);
          validateSchemaStub.returns(true);
          checkCodeOwnersStub.returns(true);

          const payload = require(resolve(
            fixturesPath,
            'events',
            'pull_request_opened'
          ));

          const scopes = [
            getConfigFile('fake-config', 200),
            submitReview(200),
            addLabels(200),
            createCheck(200),
          ];

          await probot.receive({
            name: 'pull_request.opened',
            payload,
            id: 'abc123',
          });

          scopes.forEach(scope => scope.done());
        });

        it('submits a failing check if config exists but is not valid', async () => {
          checkPRAgainstConfigStub.returns(true);
          validateYamlStub.returns(false);
          validateSchemaStub.returns(true);
          checkCodeOwnersStub.returns(true);

          const payload = require(resolve(
            fixturesPath,
            'events',
            'pull_request_opened'
          ));

          const scopes = [getConfigFile('fake-config', 200), createCheck(200)];

          await probot.receive({
            name: 'pull_request.opened',
            payload,
            id: 'abc123',
          });

          scopes.forEach(scope => scope.done());
        });

        it('logs to the console if config is valid but PR is not', async () => {
          checkPRAgainstConfigStub.returns(false);
          validateYamlStub.returns(true);
          validateSchemaStub.returns(true);
          checkCodeOwnersStub.returns(true);

          const payload = require(resolve(
            fixturesPath,
            'events',
            'pull_request_opened'
          ));

          const scopes = [getConfigFile('fake-config', 200), createCheck(200)];

          await probot.receive({
            name: 'pull_request.opened',
            payload,
            id: 'abc123',
          });

          scopes.forEach(scope => scope.done());
        });
      });
    });
  });
});
