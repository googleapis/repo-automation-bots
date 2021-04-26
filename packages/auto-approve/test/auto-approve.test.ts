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

import {handler} from '../src/auto-approve';
import * as getPRInfo from '../src/get-PR-info';
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

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');
const CONFIGURATION_FILE_PATH = 'auto-approve.yml';

function getConfigFile(response: string | undefined, status: number) {
  if (status === 404) {
    return (
      nock('https://api.github.com')
        // This second stub is required as octokit does a second attempt on a different endpoint
        .get('/repos/testOwner/.github/contents/.github%2Fauto-approve.yml')
        .reply(404)
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-approve.yml')
        .reply(404)
    );
  } else {
    return nock('https://api.github.com')
      .get('/repos/testOwner/testRepo/contents/.github%2Fauto-approve.yml')
      .reply(status, {response});
  }
}

function submitReview(status: number) {
  return nock('https://api.github.com')
    .post('/repos/testOwner/testRepo/pulls/1/reviews', body => {
      snapshot(body);
      return true;
    })
    .reply(status);
}

function addLabels(status: number) {
  return nock('https://api.github.com')
    .post('/repos/testOwner/testRepo/issues/1/labels')
    .reply(status);
}

function createCheck(status: number) {
  return nock('https://api.github.com')
    .post('/repos/testOwner/testRepo/check-runs', body => {
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
    describe('config exists on main branch', () => {
      it('approves and tags a PR if a config exists & is valid & PR is valid', async () => {
        checkPRAgainstConfigStub.returns(true);
        validateSchemaStub.returns(undefined);
        checkCodeOwnersStub.returns('');

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
        assert.ok(getChangedFilesStub.calledOnce);
      });

      it('submits a failing check if config exists but is not valid', async () => {
        checkPRAgainstConfigStub.returns(true);
        validateSchemaStub.returns([
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

        const scopes = [getConfigFile('fake-config', 200), createCheck(200)];

        await probot.receive({
          name: 'pull_request.opened',
          payload,
          id: 'abc123',
        });

        scopes.forEach(scope => scope.done());
        assert.ok(getChangedFilesStub.calledOnce);
      });

      it('logs to the console if config is valid but PR is not', async () => {
        checkPRAgainstConfigStub.returns(false);
        validateSchemaStub.returns(undefined);
        checkCodeOwnersStub.returns('');

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

        const scope = createCheck(200);

        await probot.receive({
          name: 'pull_request.opened',
          payload,
          id: 'abc123',
        });

        scope.done();
        getBlobFromPRFilesStub.reset();
      });
    });
    describe('config does not exist in PR', () => {
      it('ignores the PR, if config does not exist on repo or PR', async () => {
        getBlobFromPRFilesStub.returns(undefined);

        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        const scopes = [getConfigFile(undefined, 404)];

        await probot.receive({
          name: 'pull_request.opened',
          payload,
          id: 'abc123',
        });
        scopes.forEach(scope => scope.done());
        assert.ok(getChangedFilesStub.calledOnce);
      });

      it('attempts to get codeowners file and create a passing status check if PR contains correct config', async () => {
        const payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));

        getBlobFromPRFilesStub.returns('fake-file');
        validateYamlStub.returns('');
        validateSchemaStub.returns(undefined);
        checkCodeOwnersStub.returns('');

        const scopes = [createCheck(200)];

        await probot.receive({
          name: 'pull_request.opened',
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
        validateYamlStub.returns('File is not properly configured YAML');
        validateSchemaStub.returns([
          {
            wrongProperty: 'wrongProperty',
            message: 'message',
          },
        ]);
        checkCodeOwnersStub.returns(
          `You must add this line to to the CODEOWNERS file for auto-approve.yml to your current pull request: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/`
        );

        const scopes = [createCheck(200)];

        await probot.receive({
          name: 'pull_request.opened',
          payload,
          id: 'abc123',
        });
        scopes.forEach(scope => scope.done());
        assert.ok(getChangedFilesStub.calledOnce);
        assert.ok(getBlobFromPRFilesStub.calledTwice);
      });
    });
  });
});
