// Copyright 2022 Google LLC
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

import {JavaApiaryCodegen} from '../src/process-checks/java/apiary-codegen';
import {describe, it} from 'mocha';
import assert from 'assert';
const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
});
describe('JavaApiaryCodegen', () => {
  it('should return false in checkPR if incoming PR does not match classRules', async () => {
    const incomingPR = {
      author: 'testAuthor',
      title: 'testTitle',
      fileCount: 3,
      changedFiles: [{filename: 'hello', sha: '2345'}],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const rule = new JavaApiaryCodegen(octokit);

    assert.deepStrictEqual(await rule.checkPR(incomingPR), false);
  });

  it('should return true in checkPR if incoming PR does match classRules', async () => {
    const incomingPR = {
      author: 'yoshi-code-bot',
      title: 'Regenerate admin client',
      fileCount: 2,
      changedFiles: [
        {
          filename: 'README.md',
          sha: '2345',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const rule = new JavaApiaryCodegen(octokit);

    assert.ok(await rule.checkPR(incomingPR));
  });
});
