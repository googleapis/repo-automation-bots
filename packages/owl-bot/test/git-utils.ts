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

import {describe, it, before, afterEach} from 'mocha';
import * as assert from 'assert';
import tmp from 'tmp';
import {newCmd} from '../src/cmd';
import {makeDirTree} from './dir-tree';
import {hasGitChanges} from '../src/git-utils';

describe('hasGitChanges', () => {
  let workDir: string;
  const cmd = newCmd();
  before(() => {
    workDir = tmp.dirSync().name;
    console.info(`Origin dir: ${workDir}`);
    // Create a git repo.
    cmd('git init -b main', {cwd: workDir});
    cmd('git config user.email "test@example.com"', {cwd: workDir});
    cmd('git config user.name "test"', {cwd: workDir});

    // One commit in the history.
    makeDirTree(workDir, [
      'a.txt:Hello from a file.',
      'b.txt:Bees make honey.',
    ]);
    cmd('git add -A', {cwd: workDir});
    cmd('git commit -m a', {cwd: workDir});
  });
  afterEach(() => {
    cmd('git reset . && git checkout . && git clean -fdx', {cwd: workDir});
  });
  it('should return true for modified files', () => {
    cmd('echo foo > a.txt', {cwd: workDir});
    assert.ok(hasGitChanges(workDir));
  });
  it('should return true for modified staged files', () => {
    cmd('echo foo > a.txt', {cwd: workDir});
    cmd('git add a.txt', {cwd: workDir});
    assert.ok(hasGitChanges(workDir));
  });
  it('should return true for added files', () => {
    cmd('echo foo > new-file.txt', {cwd: workDir});
    assert.ok(hasGitChanges(workDir));
  });
  it('should return true for added staged files', () => {
    cmd('echo foo > new-file.txt', {cwd: workDir});
    cmd('git add new-file.txt', {cwd: workDir});
    assert.ok(hasGitChanges(workDir));
  });
  it('should return false for an untouched directory', () => {
    assert.ok(!hasGitChanges(workDir));
  });
});
