// Copyright 2026 Google LLC
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

import {RubyGeneratorLockfileSync} from '../src/process-checks/ruby/generator-lockfile-sync';
import {describe, it} from 'mocha';
import assert from 'assert';
const {Octokit} = require('@octokit/rest');
const fetch = require('node-fetch');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
  request: {fetch},
});

function lockfilePR(overrides = {}) {
  return {
    author: 'yoshi-code-bot',
    title: 'chore(generator): sync Gemfile.lock',
    fileCount: 1,
    changedFiles: [
      {filename: 'google-apis-generator/Gemfile.lock', sha: '2345'},
    ],
    repoName: 'google-api-ruby-client',
    repoOwner: 'googleapis',
    prNumber: 1,
    body: 'body',
    ...overrides,
  };
}

describe('RubyGeneratorLockfileSync', () => {
  it('should return true in checkPR if incoming PR does match classRules', async () => {
    const rule = new RubyGeneratorLockfileSync(octokit);

    assert.ok(await rule.checkPR(lockfilePR()));
  });

  it('should return false in checkPR if the author is not yoshi-code-bot', async () => {
    const rule = new RubyGeneratorLockfileSync(octokit);

    assert.deepStrictEqual(
      await rule.checkPR(lockfilePR({author: 'testAuthor'})),
      false
    );
  });

  it('should return false in checkPR if the title does not match', async () => {
    const rule = new RubyGeneratorLockfileSync(octokit);

    assert.deepStrictEqual(
      await rule.checkPR(
        lockfilePR({title: 'feat(generator): sync Gemfile.lock'})
      ),
      false
    );
  });

  it('should return false in checkPR if another file is changed', async () => {
    const rule = new RubyGeneratorLockfileSync(octokit);

    assert.deepStrictEqual(
      await rule.checkPR(
        lockfilePR({
          fileCount: 2,
          changedFiles: [
            {filename: 'google-apis-generator/Gemfile.lock', sha: '2345'},
            {filename: 'google-apis-generator/Gemfile', sha: '6789'},
          ],
        })
      ),
      false
    );
  });
});
