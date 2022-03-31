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

import {describe, it} from 'mocha';
import {Octokit} from '@octokit/rest';
import {Language} from '../common-container/interfaces';
import nock from 'nock';
import {execSync} from 'child_process';
import * as fs from 'fs';
import path from 'path';
import {MonoRepo} from '../common-container/mono-repo';
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

describe('MonoRepo class', async () => {
  const octokit = new Octokit({auth: 'abc1234'});

  const monoRepo = new MonoRepo(
    'nodejs' as Language,
    'github.com/soficodes/nodejs-kms.git',
    'ghs_1234',
    octokit
  );

  it('should create the right type of object', async () => {
    const expectation = {
      language: Language.Nodejs,
      repoToCloneUrl: 'github.com/soficodes/nodejs-kms.git',
      githubToken: 'ghs_1234',
      octokit,
      repoName: 'nodejs-kms',
    };

    assert.deepStrictEqual(monoRepo.language, expectation.language);
    assert.deepStrictEqual(monoRepo.repoToCloneUrl, expectation.repoToCloneUrl);
    assert.deepStrictEqual(monoRepo.githubToken, expectation.githubToken);
    assert.deepStrictEqual(monoRepo.octokit, expectation.octokit);
    assert.deepStrictEqual(monoRepo.repoName, 'nodejs-kms');
  });

  it('should clone a given repo', async () => {
    await monoRepo._cloneRepo(
      'ab123',
      'github.com/soficodes/nodejs-kms.git',
      directoryPath
    );

    fs.statSync(`${directoryPath}/nodejs-kms`);
  });

  it('get branch name from a well-known path', async () => {
    await execSync('echo specialName > branchName.md', {cwd: directoryPath});

    const branchName = await monoRepo._getBranchNameFromFile(directoryPath);

    assert.deepStrictEqual(branchName, 'specialName');
  });

  it('get opens a PR against the main branch', async () => {
    nock('https://api.github.com')
      .post('/repos/googleapis/nodejs-kms/pulls')
      .reply(201);

    await monoRepo._openAPR(octokit, 'specialName', 'nodejs-kms');
  });
});
