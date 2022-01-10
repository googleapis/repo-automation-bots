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

import {UpdateDiscoveryArtifacts} from '../src/process-checks/update-discovery-artifacts';
import {describe, it} from 'mocha';
import assert from 'assert';

const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
});

describe('behavior of UpdateDiscoveryArtifacts process', () => {
  it('should get constructed with the appropriate values', () => {
    const updateDiscoveryArtifacts = new UpdateDiscoveryArtifacts(
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
        author: 'yoshi-code-bot',
        titleRegex: /^chore: Update discovery artifacts/,
        fileNameRegex: [
          /^docs\/dyn\/index\.md$/,
          /^docs\/dyn\/.*\.html$/,
          /^googleapiclient\/discovery_cache\/documents\/.*\.json$/,
        ],
      },
      octokit,
    };

    assert.deepStrictEqual(
      updateDiscoveryArtifacts.incomingPR,
      expectation.incomingPR
    );
    assert.deepStrictEqual(
      updateDiscoveryArtifacts.classRule,
      expectation.classRule
    );
    assert.deepStrictEqual(updateDiscoveryArtifacts.octokit, octokit);
  });

  it('should return false in checkPR if incoming PR does not match classRules', async () => {
    const updateDiscoveryArtifacts = new UpdateDiscoveryArtifacts(
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

    assert.deepStrictEqual(await updateDiscoveryArtifacts.checkPR(), false);
  });

  it('should return true in checkPR if incoming PR does match classRules', async () => {
    const updateDiscoveryArtifacts = new UpdateDiscoveryArtifacts(
      'yoshi-code-bot',
      'chore: Update discovery artifacts',
      2,
      [
        {
          filename: 'googleapiclient/discovery_cache/documents/.testing.json',
          sha: '2345',
        },
      ],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      'body'
    );

    assert.ok(await updateDiscoveryArtifacts.checkPR());
  });
});
