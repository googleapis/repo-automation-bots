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

import {githubRepoFromUri} from '../src/github-repo';
import * as assert from 'assert';

describe('githubRepoFromUri()', () => {
  it('Parses ssh uri.', () => {
    const repo = githubRepoFromUri('git@github.com:googleapis/synthtool.git');
    assert.strictEqual(repo.owner, 'googleapis');
    assert.strictEqual(repo.repo, 'synthtool');
  });
  it('Parses https.', () => {
    const repo = githubRepoFromUri(
      'https://github.com/googleapis/synthtool.git'
    );
    assert.strictEqual(repo.owner, 'googleapis');
    assert.strictEqual(repo.repo, 'synthtool');
  });
  it('Parses https with token.', () => {
    const repo = githubRepoFromUri(
      'https://x-access-token:abc123@github.com/googleapis/synthtool.git'
    );
    assert.strictEqual(repo.owner, 'googleapis');
    assert.strictEqual(repo.repo, 'synthtool');
  });
  it('Parses evil name.', () => {
    const repo = githubRepoFromUri(
      'https://x-access-token:abc123@github.com/googleapis/synthtool.git.git'
    );
    assert.strictEqual(repo.owner, 'googleapis');
    assert.strictEqual(repo.repo, 'synthtool.git');
  });
});
