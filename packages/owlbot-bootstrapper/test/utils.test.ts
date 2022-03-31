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

import {openAPRUtils, getBranchNameUtils} from '../common-container/utils';
import {execSync} from 'child_process';
import path from 'path';
import {Octokit} from '@octokit/rest';
import nock from 'nock';
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

describe('common utils tests', async () => {
  const octokit = new Octokit({auth: 'abc1234'});

  it('get branch name from a well-known path', async () => {
    await execSync('echo specialName > branchName.md', {cwd: directoryPath});

    const branchName = await getBranchNameUtils(directoryPath);

    assert.deepStrictEqual(branchName, 'specialName');
  });

  it('get opens a PR against the main branch', async () => {
    nock('https://api.github.com')
      .post('/repos/googleapis/nodejs-kms/pulls')
      .reply(201);

    await openAPRUtils(octokit, 'specialName', 'nodejs-kms');
  });
});
