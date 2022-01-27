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
import * as assert from 'assert';
import tmp from 'tmp';
import {makeDirTree} from './dir-tree';
import {makeAbcRepo} from './make-repos';
import {newCmd} from '../src/cmd';
import {
  createPullRequestForLockUpdate,
  shouldCreatePullRequestForLockUpdate,
} from '../src/update-lock';
import {OctokitFactory, OctokitType} from '../src/octokit-util';
import {githubRepoFromOwnerSlashName} from '../src/github-repo';

// Use anys to mock parts of the octokit API.
// We'll still see compile time errors if in the src/ code if there's a type error
// calling the octokit APIs.
/* eslint-disable @typescript-eslint/no-explicit-any */

describe('maybeCreatePullRequestForLockUpdate', () => {
  const abcDir = makeAbcRepo();

  it('does nothing when no files changed', async () => {
    assert.strictEqual(false, shouldCreatePullRequestForLockUpdate(abcDir));
  });

  it('creates a pull request when a file changed', async () => {
    const cmd = newCmd();
    const cloneDir = tmp.dirSync().name;
    cmd(`git clone ${abcDir} ${cloneDir}`);
    makeDirTree(cloneDir, ['x.txt:New file added.']);

    assert.ok(shouldCreatePullRequestForLockUpdate(cloneDir));

    // Mock the call to createPullRequestFromLastCommit
    const calls: any[][] = [];
    function recordCall(...args: any[]) {
      calls.push(args);
      return Promise.resolve(`result-${calls.length}`);
    }

    // Mock the octokit factory:
    const factory: OctokitFactory = {
      getGitHubShortLivedAccessToken: () => Promise.resolve('b4'),
      getShortLivedOctokit: () =>
        Promise.resolve({fake: true} as unknown as OctokitType),
    };

    await createPullRequestForLockUpdate(
      factory,
      githubRepoFromOwnerSlashName('googleapis/nodejs-speech'),
      cloneDir,
      recordCall
    );

    // Confirm createPullRequestFromLastCommit() was called once.
    assert.deepStrictEqual(calls, [
      [
        'googleapis',
        'nodejs-speech',
        cloneDir,
        'main',
        'https://x-access-token:b4@github.com/googleapis/nodejs-speech.git',
        ['owl-bot-update-lock'],
        {fake: true},
        '',
        '',
        console,
      ],
    ]);
  });
});
