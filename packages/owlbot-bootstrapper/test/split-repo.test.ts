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
let repoToClonePath: string;
const FAKE_REPO_NAME = 'fakeRepo';
const FAKE_WORKSPACE = 'workspace';

nock.disableNetConnect();

describe('SplitRepo class', async () => {
  beforeEach(async () => {
    directoryPath = path.join(__dirname, FAKE_WORKSPACE);
    repoToClonePath = path.join(__dirname, FAKE_REPO_NAME);
    console.log(directoryPath);
    try {
      await execSync(`mkdir ${directoryPath}`);
      await execSync(
        `mkdir ${repoToClonePath}; cd ${repoToClonePath}; git init --bare`
      );
    } catch (err) {
      if (!(err as any).toString().match(/File exists/)) {
        throw err;
      }
    }
  });

  afterEach(async () => {
    await execSync(`rm -rf ${directoryPath}`);
    await execSync(`rm -rf ${repoToClonePath}`);
  });
  const octokit = new Octokit({auth: 'abc1234'});

  let splitRepo = new SplitRepo(
    'python' as Language,
    'google.cloud.kms.v1',
    octokit,
    'ghs_1234'
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
    const scope = nock('https://api.github.com')
      .post('/orgs/googleapis/repos')
      .reply(201);

    await SplitRepo.prototype._createRepo(octokit, 'python-kms');
    scope.done();
  });

  it('should catch a createRepo error if there is a duplicate', async () => {
    const scope = nock('https://api.github.com')
      .post('/orgs/googleapis/repos')
      .reply(400, {message: 'name already exists on this account'});

    await SplitRepo.prototype._createRepo(octokit, 'python-kms');
    scope.done();
  });

  it('should create an empty git repo on disk', async () => {
    await splitRepo._initializeEmptyGitRepo('python-kms-1', directoryPath);
    assert.ok(fs.statSync(`${directoryPath}/${splitRepo.repoName}-1`));
    assert.ok(fs.statSync(`${directoryPath}/${splitRepo.repoName}-1/.git`));
  });

  it('should push changes in an empty repo to github', async () => {
    await splitRepo._initializeEmptyGitRepo(FAKE_REPO_NAME, directoryPath);
    fs.writeFileSync(`${directoryPath}/${FAKE_REPO_NAME}/README.md`, 'hello!');
    await splitRepo._commitAndPushToMain(
      FAKE_REPO_NAME,
      directoryPath,
      undefined,
      repoToClonePath
    );

    const stdoutBranch = execSync('git branch', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    const stdoutCommit = execSync('git log', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    const stdoutReadmeExists = execSync(
      'git cat-file -e origin/main:README.md && echo README exists',
      {cwd: `${directoryPath}/${FAKE_REPO_NAME}`}
    );

    assert.ok(stdoutBranch.includes('main'));
    assert.ok(stdoutCommit.includes('feat: adding initial files'));
    assert.ok(stdoutReadmeExists.includes('README exists'));
  });

  it('should create an empty PR', async () => {
    const scope = nock('https://api.github.com')
      .post('/repos/googleapis/fakeRepo/pulls')
      .reply(201);

    await splitRepo._initializeEmptyGitRepo(FAKE_REPO_NAME, directoryPath);
    fs.writeFileSync(`${directoryPath}/${FAKE_REPO_NAME}/README.md`, 'hello!');
    await splitRepo._commitAndPushToMain(
      FAKE_REPO_NAME,
      directoryPath,
      undefined,
      repoToClonePath
    );

    await splitRepo._createEmptyBranchAndOpenPR(
      FAKE_REPO_NAME,
      octokit,
      directoryPath
    );

    const stdoutBranch = execSync('git branch', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    assert.ok(stdoutBranch.includes('owlbot-bootstrapper-initial-PR'));
    scope.done();
  });

  it('should create and initialize an empty repo on github, then push to main and create an empty PR', async () => {
    const scopes = [
      nock('https://api.github.com').post('/orgs/googleapis/repos').reply(201),
      nock('https://api.github.com')
        .post('/repos/googleapis/fakeRepo/pulls')
        .reply(201),
    ];

    splitRepo = new SplitRepo(
      'python' as Language,
      'google.cloud.kms.v1',
      octokit
    );

    splitRepo.repoName = FAKE_REPO_NAME;

    await splitRepo.createAndInitializeEmptyGitRepo(directoryPath);
    fs.writeFileSync(`${directoryPath}/${FAKE_REPO_NAME}/README.md`, 'hello!');
    await splitRepo.pushToMainAndCreateEmptyPR(directoryPath, repoToClonePath);

    const stdoutBranch = execSync('git branch', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    const stdoutCommit = execSync('git log', {
      cwd: `${directoryPath}/${FAKE_REPO_NAME}`,
    });

    const stdoutReadmeExists = execSync(
      'git cat-file -e origin/main:README.md && echo README exists',
      {cwd: `${directoryPath}/${FAKE_REPO_NAME}`}
    );

    assert.ok(stdoutBranch.includes('main'));
    assert.ok(stdoutCommit.includes('feat: adding initial files'));
    assert.ok(stdoutReadmeExists.includes('README exists'));
    scopes.forEach(scope => scope.done());
  });
});
