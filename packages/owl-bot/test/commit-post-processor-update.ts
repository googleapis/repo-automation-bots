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
import {newCmd} from '../src/cmd';
import {commitPostProcessorUpdate} from '../src/bin/commands/commit-post-processor-update';
import {copyTagFrom} from '../src/copy-code';

export function makeOrigin(logger = console): string {
  const cmd = newCmd(logger);

  // Create a git repo.
  const dir = tmp.dirSync().name;
  logger.info(`Origin dir: ${dir}`);
  cmd('git init -b main', {cwd: dir});
  cmd('git config user.email "test@example.com"', {cwd: dir});
  cmd('git config user.name "test"', {cwd: dir});

  // One commit in the history.
  makeDirTree(dir, ['a.txt:Hello from a file.', 'b.txt:Bees make honey.']);
  cmd('git add -A', {cwd: dir});
  cmd('git commit -m a', {cwd: dir});

  return dir;
}

export function cloneRepo(dir: string, logger = console): string {
  const cmd = newCmd(logger);

  // Create a git repo.
  const clone = tmp.dirSync().name;
  cmd(`git clone ${dir} ${clone}`);
  cmd('git config user.email "test@example.com"', {cwd: clone});
  cmd('git config user.name "test"', {cwd: clone});
  cmd('git config pull.rebase false', {cwd: clone});

  // Check out another branch so we can push back to the main branch of origin.
  cmd('git checkout -b some-other-branch', {cwd: dir});

  return clone;
}

describe('commitPostProcessorUpdate', () => {
  const cmd = newCmd();
  const yamlPath = '.github/.OwlBot.yaml';

  it("adds commit when there's no Copy-Tag", async () => {
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, ['a.txt:The post processor ran.']);
    await commitPostProcessorUpdate(clone);
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.match(log, /Updates from OwlBot/);
  });

  it('adds commit when Copy-Tag is corrupt', async () => {
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, ['c.txt:See the sea.']);
    cmd('git add c.txt', {cwd: clone});
    cmd('git commit -m "Copy-Tag: abc123"', {cwd: clone});
    makeDirTree(clone, ['a.txt:The post processor ran.']);
    await commitPostProcessorUpdate(clone);
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.match(log, /Updates from OwlBot/);
  });

  it('adds commit when .OwlBot.yaml is missing', async () => {
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, ['c.txt:See the sea.']);
    cmd('git add c.txt', {cwd: clone});
    const copyTag = copyTagFrom(yamlPath, 'abc123');
    cmd(`git commit -m "Copy-Tag: ${copyTag}"`, {cwd: clone});
    makeDirTree(clone, ['a.txt:The post processor ran.']);
    await commitPostProcessorUpdate(clone);
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.match(log, /Updates from OwlBot/);
  });

  it('adds commit when .OwlBot.yaml is corrupt', async () => {
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, [`${yamlPath}:corrupt`]);
    cmd(`git add ${yamlPath}`, {cwd: clone});
    const copyTag = copyTagFrom(yamlPath, 'abc123');
    cmd(`git commit -m "Copy-Tag: ${copyTag}"`, {cwd: clone});
    makeDirTree(clone, ['a.txt:The post processor ran.']);
    await commitPostProcessorUpdate(clone);
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.match(log, /Updates from OwlBot/);
  });

  it('adds commit when .OwlBot.yaml contains no flag', async () => {
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, [`${yamlPath}:deep-remove-regex:\n  - /pasta.txt`]);
    cmd(`git add ${yamlPath}`, {cwd: clone});
    const copyTag = copyTagFrom(yamlPath, 'abc123');
    cmd(`git commit -m "Copy-Tag: ${copyTag}"`, {cwd: clone});
    makeDirTree(clone, ['a.txt:The post processor ran.']);
    await commitPostProcessorUpdate(clone);
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.match(log, /Updates from OwlBot/);
  });

  it('squashes commit when .OwlBot.yaml contains flag', async () => {
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, [`${yamlPath}:squash: true`]);
    cmd(`git add ${yamlPath}`, {cwd: clone});
    const copyTag = copyTagFrom(yamlPath, 'abc123');
    cmd(`git commit -m "Copy-Tag: ${copyTag}"`, {cwd: clone});
    makeDirTree(clone, ['a.txt:The post processor ran.']);
    await commitPostProcessorUpdate(clone);
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.doesNotMatch(log, /Updates from OwlBot/);
    assert.match(log, /Copy-Tag/);
  });

  it("doesn't create a commit when no changes are pending", async () => {
    const origin = makeOrigin();
    makeDirTree(origin, [`${yamlPath}:squash: true`]);
    cmd(`git add ${yamlPath}`, {cwd: origin});
    const copyTag = copyTagFrom(yamlPath, 'abc123');
    cmd(`git commit -m "Copy-Tag: ${copyTag}"`, {cwd: origin});
    const head = cmd('git log -1 --format=%H main', {cwd: origin}).toString(
      'utf-8'
    );
    const clone = cloneRepo(origin);
    await commitPostProcessorUpdate(clone);
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.doesNotMatch(log, /Updates from OwlBot/);
    assert.match(log, /Copy-Tag/);
    // No commits should have been pushed.
    assert.strictEqual(
      head,
      cmd('git log -1 --format=%H main', {cwd: origin}).toString('utf-8')
    );
  });
});
