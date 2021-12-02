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

import {RegenerateReadme} from '../src/process-checks/regenerate-readme';
import {describe, it} from 'mocha';
import assert from 'assert';

const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
});

describe('behavior of RegenerateReadme process', () => {
  it('should get constructed with the appropriate values', () => {
    const regenerateReadme = new RegenerateReadme(
      'testAuthor',
      'testTitle',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      'body'
    );

    const expectation = {
      incomingPR: {
        author: 'testAuthor',
        title: 'testTitle',
        fileCount: 3,
        changedFiles: [{filename: 'hello', sha: '2345'}],
        repoName: 'testRepoName',
        repoOwner: 'testRepoOwner',
        prNumber: 1,
        body: 'body',
      },
      classRule: {
        author: 'yoshi-automation',
        titleRegex: /^chore: regenerate README$/,
        maxFiles: 2,
        fileNameRegex: [
          /^README.md$/,
          /\.github\/readme\/synth.metadata\/synth\.metadata$/,
        ],
      },
      octokit,
    };

    assert.deepStrictEqual(regenerateReadme.incomingPR, expectation.incomingPR);
    assert.deepStrictEqual(regenerateReadme.classRule, expectation.classRule);
    assert.deepStrictEqual(regenerateReadme.octokit, octokit);
  });

  it('should return false in checkPR if incoming PR does not match classRules', async () => {
    const regenerateReadme = new RegenerateReadme(
      'testAuthor',
      'testTitle',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      'body'
    );

    assert.deepStrictEqual(await regenerateReadme.checkPR(), false);
  });

  it('should return true in checkPR if incoming PR does match classRules', async () => {
    const regenerateReadme = new RegenerateReadme(
      'yoshi-automation',
      'chore: regenerate README',
      2,
      [
        {
          filename: 'README.md',
          sha: '2345',
        },
      ],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      'body'
    );

    assert.ok(await regenerateReadme.checkPR());
  });
});
