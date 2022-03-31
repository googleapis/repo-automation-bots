// Copyright 2022 Google LLC
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

import {SplitRepo} from '../common-container/split-repo';
import {describe, it} from 'mocha';
import {Octokit} from '@octokit/rest';
import {Language} from '../common-container/interfaces';
import nock from 'nock';
import {execSync} from 'child_process';
import * as fs from 'fs';
import path from 'path';
import assert from 'assert';

let directoryPath: string;

beforeEach(async () => {
  directoryPath = path.join(__dirname, 'workspace');
  console.log(directoryPath);
  try {
    await execSync(`mkdir ${directoryPath}`);
  } catch (err) {
    if (!(err as any).toString().match(/File exists/)) {
      throw err;
    }
  }
});

afterEach(async () => {
  await execSync(`rm -rf ${directoryPath}`);
});

describe('SplitRepo class', async () => {
  const octokit = new Octokit({auth: 'abc1234'});

  const splitRepo = new SplitRepo(
    'python' as Language,
    'google.cloud.kms.v1',
    'ghs_1234',
    octokit
  );
  it('should create the right type of object', async () => {
    const expectation = {
      language: Language.Python,
      apiId: 'google.cloud.kms.v1',
      githubToken: 'ghs_1234',
      octokit,
      repoName: 'python-kms',
    };

    assert.deepStrictEqual(splitRepo.language, expectation.language);
    assert.deepStrictEqual(splitRepo.apiId, expectation.apiId);
    assert.deepStrictEqual(splitRepo.githubToken, expectation.githubToken);
    assert.deepStrictEqual(splitRepo.octokit, expectation.octokit);
    assert.deepStrictEqual(splitRepo.repoName, 'python-kms');
  });

  it('should create the right repo name', async () => {
    assert.deepStrictEqual(
      SplitRepo.prototype._createRepoName('python', 'google.cloud.kms.v1'),
      'python-kms'
    );

    assert.deepStrictEqual(
      SplitRepo.prototype._createRepoName(
        'nodejs',
        'google.analytics.admin.v1alpha'
      ),
      'nodejs-analytics-admin'
    );
  });

  it('should create a repo', async () => {
    nock('https://api.github.com').post('/orgs/googleapis/repos').reply(201);

    await SplitRepo.prototype._createRepo(octokit, 'python-kms');
  });

  it('should catch a createRepo error if there is a duplicate', async () => {
    nock('https://api.github.com')
      .post('/orgs/googleapis/repos')
      .reply(400, {message: 'name already exists on this account'});

    await SplitRepo.prototype._createRepo(octokit, 'python-kms');
  });

  it('should create an empty git repo on disk', async () => {
    await splitRepo._initializeEmptyGitRepo('python-kms-1', directoryPath);
    assert.ok(fs.statSync(`${directoryPath}/${splitRepo.repoName}-1`));
    assert.ok(fs.statSync(`${directoryPath}/${splitRepo.repoName}-1/.git`));
  });

  // This test expects an error when pushing to github, since we're:
  // 1. pushing to a repo that we don't have permissions to and doesn't exist
  // However, the error allows us to ensure we're pushing to the right repo
  it('should push those changes to github', async () => {
    assert.rejects(
      async () =>
        await splitRepo._commitAndPushToMain(
          'ghs_1234',
          'python-kms',
          directoryPath
        ),
      /failed to push some refs to 'https:\/\/github.com\/googleapis\/python-kms'/
    );
  });

  // This test should expects an error as well because we cannot properly set up the branch and push to main
  it('should create an empty PR', async () => {
    nock('https://api.github.com')
      .post('/repos/googleapis/repos/pulls')
      .reply(201);

    await splitRepo._initializeEmptyGitRepo(
      'python-analytics-admin',
      directoryPath
    );

    assert.rejects(
      async () =>
        await splitRepo._createEmptyBranchAndOpenPR(
          'python-analytics-admin',
          octokit,
          directoryPath
        ),
      /fatal: 'origin' does not appear to be a git repository/
    );
  });
});
