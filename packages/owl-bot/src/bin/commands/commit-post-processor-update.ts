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

// Invoked by update-pr.yaml to commit changes to an open pull request after
// the post processor runs.
//
// This used to be a simple "git commit ...", but the addition of the
// squash flag in .OwlBot.yaml makes it more complicated.  When squash
// is true and the most recent commit was a copy from googleapis-gen, then
// we want to squash the changes made by the post processor.
//

import {cwd} from 'process';
import yargs = require('yargs');
import {newCmd} from '../../cmd';
import {findCopyTag, loadOwlBotYaml, unpackCopyTag} from '../../copy-code';
import * as proc from 'child_process';
import path = require('path');

export const commitPostProcessorUpdateCommand: yargs.CommandModule<{}, {}> = {
  command: 'commit-post-processor-update',
  describe:
    'Runs either `git commit -m "Updates from OwlBot"` or ' +
    '`git commit --amend --no-edit`\n' +
    'depending on the squash flag in .OwlBot.yaml.\n\n' +
    'Run this command in the root directory of a client library repository ' +
    'after running the post processor.',
  handler: () => commitPostProcessorUpdate(),
};

export async function commitPostProcessorUpdate(repoDir = ''): Promise<void> {
  const cmd = newCmd(console);
  if (['', '.'].includes(repoDir)) {
    repoDir = cwd();
  }
  // Add all pending changes to the commit.
  cmd('git add -A .', {cwd: repoDir});
  const status = cmd('git status --porcelain', {cwd: repoDir}).toString(
    'utf-8'
  );
  // `git status` --porcelain returns empty stdout when no changes are pending.
  if (!status) {
    return; // No changes made.  Nothing to do.
  }
  // Unpack the Copy-Tag.
  const body = cmd('git log -1 --format=%B', {cwd: repoDir}).toString('utf-8');
  const copyTagText = findCopyTag(body);
  if (copyTagText) {
    try {
      const copyTag = unpackCopyTag(copyTagText);
      // Look in .OwlBot.yaml for a squash flag.
      const yaml = await loadOwlBotYaml(path.join(repoDir, copyTag.p));
      if (yaml.squash) {
        // Amend (squash) pending changes into the previous commit.
        cmd('git commit --amend --no-edit', {cwd: repoDir});
        // Must force push back to origin.
        cmd('git push -f', {cwd: repoDir});
        return;
      }
    } catch (e) {
      console.error(e);
    }
  }
  // Commit new changes as a new commit.
  // Use spawn() instead of cmd() to avoid the shell potentially
  // misinterpreting commit message.
  const commitMessage =
    '🦉 Updates from OwlBot\n\nSee https://github.com/googleapis/repo-automation-bots/blob/main/packages/owl-bot/README.md';
  console.log(`git commit -m "${commitMessage}"`);
  proc.spawnSync('git', ['commit', '-m', commitMessage], {cwd: repoDir});
  // Pull any recent changes to minimize risk of missing refs for the user.
  cmd('git pull', {cwd: repoDir});
  // Push changes back to origin.
  cmd('git push', {cwd: repoDir});
}
