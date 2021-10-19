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

import {cwd} from 'process';
import {newCmd} from './cmd';
import {findCopyTag, loadOwlBotYaml, unpackCopyTag} from './copy-code';
import * as proc from 'child_process';
import path = require('path');
import AdmZip from 'adm-zip';
import {Storage} from '@google-cloud/storage';
import tmp from 'tmp';

/**
 * Returns the current working directory if the argument is empty or '.'.
 */
function emptyToCwd(dir?: string): string {
  if (!dir || '.' === dir) {
    return cwd();
  } else {
    return dir;
  }
}

export async function commitPostProcessorUpdate(
  repoDir = ''
): Promise<'nochange' | 'squashed' | 'committed'> {
  const cmd = newCmd(console);
  repoDir = emptyToCwd(repoDir);
  // Add all pending changes to the commit.
  cmd('git add -A .', {cwd: repoDir});
  const status = cmd('git status --porcelain', {cwd: repoDir}).toString(
    'utf-8'
  );
  // `git status` --porcelain returns empty stdout when no changes are pending.
  if (!status) {
    console.info('no change');
    return 'nochange'; // No changes made.  Nothing to do.
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
        return 'squashed';
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
  return 'committed';
}

/**
 * Commits changes, and pushes changes back up to the open pull request.
 */
export async function commitAndPushPostProcessorUpdate(
  repoDir = ''
): Promise<void> {
  repoDir = emptyToCwd(repoDir);
  const whatHappened = await commitPostProcessorUpdate(repoDir);
  const cmd = newCmd(console);
  switch (whatHappened) {
    case 'committed':
      // Pull any recent changes to minimize risk of missing refs for the user.
      cmd('git pull', {cwd: repoDir});
      // Push changes back to origin.
      cmd('git push', {cwd: repoDir});
      break;
    case 'squashed':
      // Must force push back to origin.
      cmd('git push -f', {cwd: repoDir});
      break;
  }
}

/**
 * Returns the path to the temporary zip file.
 */
export function zipRepoDir(repoDir: string, comment: string): string {
  const zip = new AdmZip();
  zip.addLocalFolder(repoDir, undefined, filename => filename !== '.git');
  zip.addZipComment(comment);
  const tmpPath = tmp.fileSync({discardDescriptor: true}).name;
  zip.writeZip(tmpPath);
  return tmpPath;
}

/**
 * Commits changes, and stores them in a google cloud storage bucket.
 */
export async function commitAndStorePostProcessorUpdate(
  repoDir: string,
  storageClient: Storage,
  bucketName: string,
  storagePath: string
): Promise<void> {
  repoDir = emptyToCwd(repoDir);
  const whatHappened = await commitPostProcessorUpdate(repoDir);
  if ('nochange' === whatHappened) {
    return;
  }
  const zipPath = zipRepoDir(repoDir, whatHappened);
  console.info(`Uploading ${zipPath} to gs://${bucketName}/${storagePath}`);
  await storageClient
    .bucket(bucketName)
    .upload(zipPath, {destination: storagePath});
}
