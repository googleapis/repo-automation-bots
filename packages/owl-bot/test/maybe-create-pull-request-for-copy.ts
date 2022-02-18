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

import {describe, it} from 'mocha';
import * as assert from 'assert';
import tmp from 'tmp';
import fs from 'fs';
import path from 'path';
import {newFakeOctokit, newFakeOctokitFactory} from './fake-octokit';
import {makeAbcRepo, makeRepoWithOwlBotYaml} from './make-repos';
import {newCmd} from '../src/cmd';
import {
  createPullRequestForCopyBranch,
  deleteCopyBranch,
  shouldCreatePullRequestForCopyBranch,
} from '../src/maybe-create-pull-request-for-copy';
import {makeDirTree} from './dir-tree';
import {copyTagFrom} from '../src/copy-code';
import {Force, WithRegenerateCheckbox} from '../src/create-pr';

describe('maybe-create-pull-request-for-copy', () => {
  const abcRepo = makeAbcRepo();
  const cmd = newCmd();

  beforeEach(() => cmd('git checkout main', {cwd: abcRepo}));

  describe('deleteCopyBranch', () => {
    it('should delete a copy branch', async () => {
      const deadRefs: unknown[] = [];
      const octokit = newFakeOctokit(undefined, undefined, undefined, deadRefs);
      const factory = newFakeOctokitFactory(octokit);

      cmd('git checkout -b deadBranch', {cwd: abcRepo});
      cmd(
        'git remote add origin https://github.com/googleapis/nodejs-data-fusion.git',
        {cwd: abcRepo}
      );

      await deleteCopyBranch(factory, abcRepo);
      assert.deepStrictEqual(deadRefs, [
        {
          owner: 'googleapis',
          ref: 'heads/deadBranch',
          repo: 'nodejs-data-fusion',
        },
      ]);
    });
  });

  function cloneAbc(): string {
    const cloneDir = tmp.dirSync().name;
    cmd(`git clone ${abcRepo} ${cloneDir}`);
    cmd('git config user.email "test@example.com"', {cwd: cloneDir});
    cmd('git config user.name "test"', {cwd: cloneDir});
    return cloneDir;
  }

  describe('shouldCreatePullRequestForCopyBranch', () => {
    it('creates a pull request when contents changed', async () => {
      const cloneDir = cloneAbc();
      makeDirTree(cloneDir, ['x.txt:New file added.']);
      cmd('git add -A', {cwd: cloneDir});
      assert.ok(shouldCreatePullRequestForCopyBranch('main', cloneDir));
    });

    it("doesn't create a pull request when final result is the same", async () => {
      const cloneDir = cloneAbc();
      cmd('git checkout -b owl-bot-copy', {cwd: cloneDir});
      makeDirTree(cloneDir, ['x.txt:New file added.']);
      cmd('git add -A', {cwd: cloneDir});
      cmd('git commit -m "Added x.txt"', {cwd: cloneDir});
      fs.rmSync(path.join(cloneDir, 'x.txt'));
      cmd('git add -A', {cwd: cloneDir});
      // Histories differ, but main is the same as staged.
      assert.ok(!shouldCreatePullRequestForCopyBranch('main', cloneDir));
    });
  });

  describe('createPullRequestForCopyBranch', () => {
    const libRepo = makeRepoWithOwlBotYaml({
      'api-name': 'data fusion',
    });

    function cloneLib(): string {
      const cloneDir = tmp.dirSync().name;
      cmd(`git clone ${libRepo} ${cloneDir}`);
      cmd('git config user.email "test@example.com"', {cwd: cloneDir});
      cmd('git config user.name "test"', {cwd: cloneDir});
      return cloneDir;
    }

    // Mock the call to createPullRequestFromLastCommit
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls: any[][] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function recordCall(...args: any[]) {
      calls.push(args);
      return Promise.resolve(`result-${calls.length}`);
    }

    afterEach(() => calls.splice(0, calls.length));

    it('creates a pull request', async () => {
      const cloneDir = cloneLib();
      cmd('git checkout -b owl-bot-copy', {cwd: cloneDir});
      makeDirTree(cloneDir, ['x.txt:New file added.']);
      cmd('git add -A', {cwd: cloneDir});
      const copyTag = copyTagFrom('.github/.OwlBot.yaml', 'abc123');
      cmd(`git commit -m "Copy-Tag: ${copyTag}"`, {cwd: cloneDir});
      cmd(
        'git remote set-url origin https://github.com/googleapis/nodejs-data-fusion.git',
        {cwd: cloneDir}
      );

      const octokit = newFakeOctokit();
      const factory = newFakeOctokitFactory(octokit);
      await createPullRequestForCopyBranch(
        factory,
        undefined,
        undefined,
        cloneDir,
        recordCall,
        console
      );

      assert.deepStrictEqual(calls, [
        [
          'googleapis',
          'nodejs-data-fusion',
          cloneDir,
          'owl-bot-copy',
          'https://x-access-token:b3@github.com/googleapis/nodejs-data-fusion.git',
          ['owl-bot-copy'],
          octokit,
          WithRegenerateCheckbox.Yes,
          'data fusion',
          Force.No,
          console,
          'Copy-Tag: eyJwIjoiLmdpdGh1Yi8uT3dsQm90LnlhbWwiLCJoIjoiYWJjMTIzIn0=\n\n',
        ],
      ]);

      const gitLog = cmd('git log --format=%B', {cwd: cloneDir}).toString(
        'utf-8'
      );
      assert.strictEqual(
        gitLog,
        'Copy-Tag: eyJwIjoiLmdpdGh1Yi8uT3dsQm90LnlhbWwiLCJoIjoiYWJjMTIzIn0=\n' +
          '\n' +
          'Hello OwlBot\n' +
          '\n'
      );
    });

    it('creates a pull request with post processor changes', async () => {
      const cloneDir = cloneLib();
      cmd('git checkout -b owl-bot-copy', {cwd: cloneDir});
      makeDirTree(cloneDir, ['x.txt:New file added.']);
      cmd('git add -A', {cwd: cloneDir});
      const copyTag = copyTagFrom('.github/.OwlBot.yaml', 'abc123');
      cmd(`git commit -m "Copy-Tag: ${copyTag}"`, {cwd: cloneDir});
      makeDirTree(cloneDir, ['y.txt:Created by Owl Bot post processor.']);
      cmd('git add -A', {cwd: cloneDir});
      cmd(
        'git remote set-url origin https://github.com/googleapis/nodejs-data-fusion.git',
        {cwd: cloneDir}
      );

      const octokit = newFakeOctokit();
      const factory = newFakeOctokitFactory(octokit);
      await createPullRequestForCopyBranch(
        factory,
        undefined,
        undefined,
        cloneDir,
        recordCall,
        console
      );

      assert.deepStrictEqual(calls, [
        [
          'googleapis',
          'nodejs-data-fusion',
          cloneDir,
          'owl-bot-copy',
          'https://x-access-token:b3@github.com/googleapis/nodejs-data-fusion.git',
          ['owl-bot-copy'],
          octokit,
          WithRegenerateCheckbox.Yes,
          'data fusion',
          Force.No,
          console,
          'Copy-Tag: eyJwIjoiLmdpdGh1Yi8uT3dsQm90LnlhbWwiLCJoIjoiYWJjMTIzIn0=\n\n',
        ],
      ]);

      const gitLog = cmd('git log --format=%B', {cwd: cloneDir}).toString(
        'utf-8'
      );
      assert.match(
        gitLog,
        new RegExp(
          '.*🦉 Updates from OwlBot post-processor\n' +
            '\n' +
            'See https://github.com/googleapis/repo-automation-bots/blob/main/packages/owl-bot/README.md\n' +
            '\n' +
            'Copy-Tag: eyJwIjoiLmdpdGh1Yi8uT3dsQm90LnlhbWwiLCJoIjoiYWJjMTIzIn0=\n' +
            '\n' +
            'Hello OwlBot\n' +
            '\n'
        )
      );
    });

    it('squashes a pull request with post processor changes', async () => {
      const cloneDir = cloneLib();
      cmd('git checkout -b owl-bot-copy', {cwd: cloneDir});
      makeDirTree(cloneDir, [
        '.github/.OwlBot.yaml:squash: true\napi-name: data fusion',
      ]);
      cmd('git add -A', {cwd: cloneDir});
      const copyTag = copyTagFrom('.github/.OwlBot.yaml', 'abc123');
      cmd(`git commit -m "Copy-Tag: ${copyTag}"`, {cwd: cloneDir});
      makeDirTree(cloneDir, ['y.txt:Created by Owl Bot post processor.']);
      cmd('git add -A', {cwd: cloneDir});
      cmd(
        'git remote set-url origin https://github.com/googleapis/nodejs-data-fusion.git',
        {cwd: cloneDir}
      );

      const octokit = newFakeOctokit();
      const factory = newFakeOctokitFactory(octokit);
      await createPullRequestForCopyBranch(
        factory,
        undefined,
        undefined,
        cloneDir,
        recordCall,
        console
      );

      assert.deepStrictEqual(calls, [
        [
          'googleapis',
          'nodejs-data-fusion',
          cloneDir,
          'owl-bot-copy',
          'https://x-access-token:b3@github.com/googleapis/nodejs-data-fusion.git',
          ['owl-bot-copy'],
          octokit,
          WithRegenerateCheckbox.Yes,
          'data fusion',
          Force.Yes,
          console,
          'Copy-Tag: eyJwIjoiLmdpdGh1Yi8uT3dsQm90LnlhbWwiLCJoIjoiYWJjMTIzIn0=\n\n',
        ],
      ]);

      const gitLog = cmd('git log --format=%B', {cwd: cloneDir}).toString(
        'utf-8'
      );
      assert.strictEqual(
        gitLog,
        'Copy-Tag: eyJwIjoiLmdpdGh1Yi8uT3dsQm90LnlhbWwiLCJoIjoiYWJjMTIzIn0=\n' +
          '\n' +
          'Hello OwlBot\n' +
          '\n'
      );
    });

    it('squashes a pull request with post processor changes', async () => {
      const cloneDir = cloneLib();
      cmd('git checkout -b owl-bot-copy', {cwd: cloneDir});
      makeDirTree(cloneDir, ['.github/.OwlBot.yaml:garbage']);
      cmd('git add -A', {cwd: cloneDir});
      const copyTag = copyTagFrom('.github/.OwlBot.yaml', 'abc123');
      cmd(`git commit -m "Copy-Tag: ${copyTag}"`, {cwd: cloneDir});
      makeDirTree(cloneDir, ['y.txt:Created by Owl Bot post processor.']);
      cmd('git add -A', {cwd: cloneDir});
      cmd(
        'git remote set-url origin https://github.com/googleapis/nodejs-data-fusion.git',
        {cwd: cloneDir}
      );

      const octokit = newFakeOctokit();
      const factory = newFakeOctokitFactory(octokit);
      await createPullRequestForCopyBranch(
        factory,
        Force.Yes,
        undefined,
        cloneDir,
        recordCall,
        console
      );

      assert.deepStrictEqual(calls, [
        [
          'googleapis',
          'nodejs-data-fusion',
          cloneDir,
          'owl-bot-copy',
          'https://x-access-token:b3@github.com/googleapis/nodejs-data-fusion.git',
          ['owl-bot-copy'],
          octokit,
          WithRegenerateCheckbox.Yes,
          undefined,
          Force.No,
          console,
          'Copy-Tag: eyJwIjoiLmdpdGh1Yi8uT3dsQm90LnlhbWwiLCJoIjoiYWJjMTIzIn0=\n\n',
        ],
      ]);

      const gitLog = cmd('git log --format=%B', {cwd: cloneDir}).toString(
        'utf-8'
      );
      assert.match(
        gitLog,
        new RegExp(
          '.*🦉 Updates from OwlBot post-processor\n' +
            '\n' +
            'See https://github.com/googleapis/repo-automation-bots/blob/main/packages/owl-bot/README.md\n' +
            '\n' +
            'Copy-Tag: eyJwIjoiLmdpdGh1Yi8uT3dsQm90LnlhbWwiLCJoIjoiYWJjMTIzIn0=\n' +
            '\n' +
            'Hello OwlBot\n' +
            '\n'
        )
      );
    });
  });
});
