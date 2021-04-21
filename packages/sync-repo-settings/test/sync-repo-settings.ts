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

import {describe, it, beforeEach, afterEach} from 'mocha';
import nock from 'nock';
import * as sinon from 'sinon';
import {SyncRepoSettings} from '../src/sync-repo-settings';
import {Octokit} from '@octokit/rest';
import {logger} from 'gcf-utils';
import {RepoConfig} from '../src/types';
import {readFileSync} from 'fs';
import {resolve} from 'path';
import * as yaml from 'js-yaml';
import assert from 'assert';

nock.disableNetConnect();

const sandbox = sinon.createSandbox();

function loadConfig(fixture: string): RepoConfig {
  const content = readFileSync(resolve('./test/fixtures', fixture), 'utf8');
  return yaml.load(content) as RepoConfig;
}

describe('SyncRepoSettings', () => {
  let runner: SyncRepoSettings;
  let octokit: Octokit;

  beforeEach(() => {
    octokit = new Octokit({
      auth: 'faketoken',
    });
    sandbox.stub(logger, 'error').throwsArg(0);
    sandbox.stub(logger, 'info');
    sandbox.stub(logger, 'debug');
    runner = new SyncRepoSettings(octokit, logger);
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  it('should fill in default values', async () => {
    const updateRepo = sandbox.stub(octokit.repos, 'update');
    const updateBranch = sandbox.stub(octokit.repos, 'updateBranchProtection');
    const updateTeams = sandbox.stub(
      octokit.teams,
      'addOrUpdateRepoPermissionsInOrg'
    );
    const config = loadConfig('localConfig.yaml');
    await runner.syncRepoSettings({
      repo: 'test-owner/test-repo',
      config: config,
    });
    sinon.assert.calledOnce(updateRepo);
    sinon.assert.calledOnce(updateBranch);
    sinon.assert.calledThrice(updateTeams);

    // grab first arg of first call
    const branchProtection = updateBranch.args[0][0];

    // ensure we set a default value not set in the yaml
    assert.strictEqual(branchProtection?.branch, 'master');
    assert.ok(branchProtection?.enforce_admins);
  });

  it('should handle multiple branches', async () => {
    const updateRepo = sandbox.stub(octokit.repos, 'update');
    const updateBranch = sandbox.stub(octokit.repos, 'updateBranchProtection');
    const updateTeams = sandbox.stub(
      octokit.teams,
      'addOrUpdateRepoPermissionsInOrg'
    );
    const config = loadConfig('multipleBranches.yaml');
    await runner.syncRepoSettings({
      repo: 'test-owner/test-repo',
      config: config,
    });
    sinon.assert.calledOnce(updateRepo);
    sinon.assert.calledTwice(updateBranch);
    sinon.assert.calledThrice(updateTeams);
  });
});
