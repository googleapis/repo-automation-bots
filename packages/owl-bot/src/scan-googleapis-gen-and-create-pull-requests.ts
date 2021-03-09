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

import {ConfigsStore} from './configs-store';
import {OctokitType, OctokitFactory} from './octokit-util';
import tmp from 'tmp';
import {
  copyCodeAndCreatePullRequest,
  copyExists,
  newCmd,
  toLocalRepo,
} from './copy-code';
import {getFilesModifiedBySha} from '.';
import {GithubRepo} from './github-repo';

interface Todo {
  repo: GithubRepo;
  commitHash: string;
}

export async function scanGoogleapisGenAndCreatePullRequests(
  sourceRepo: string,
  octokitFactory: OctokitFactory,
  configsStore: ConfigsStore,
  cloneDepth = 100,
  logger = console
): Promise<number> {
  // Clone the source repo.
  const workDir = tmp.dirSync().name;
  // cloneDepth + 1 because the final commit in a shallow clone is grafted: it contains
  // the combined state of all earlier commits, so we don't want to examine it.
  const sourceDir = toLocalRepo(sourceRepo, workDir, logger, cloneDepth + 1);

  // Collect the history of commit hashes.
  const cmd = newCmd(logger);
  const stdout = cmd(`git log -${cloneDepth} --format=%H`, {cwd: sourceDir});
  const text = stdout.toString('utf8');
  const commitHashes = text.split(/\r?\n/).filter(x => x);

  const todoStack: Todo[] = [];
  let octokit: null | OctokitType = null;

  // Search the commit history for commits that still need to be copied
  // to destination repos.
  for (const commitHash of commitHashes) {
    const commitText = cmd(`git log -1 --pretty=oneline ${commitHash}`, {
      cwd: sourceDir,
    }).toString('utf8');
    let touchedFiles = await getFilesModifiedBySha(sourceDir, commitHash);
    // The regular expressions in an OwlBot.yaml file expect file paths to
    // begin with a slash.
    touchedFiles = touchedFiles.map(f => (f.startsWith('/') ? f : '/' + f));
    logger.info(commitText);
    touchedFiles.forEach(f => logger.info(f));
    const repos = await configsStore.findReposAffectedByFileChanges(
      touchedFiles
    );
    logger.info(`affecting ${repos.length} repos.`);
    repos.forEach(repo => logger.info(repo));
    const stackSize = todoStack.length;
    for (const repo of repos) {
      octokit = octokit ?? (await octokitFactory.getShortLivedOctokit());
      if (!(await copyExists(octokit, repo, commitHash, logger))) {
        const todo: Todo = {repo, commitHash};
        logger.info(`Pushing todo onto stack: ${todo}`);
        todoStack.push(todo);
      }
    }
    // We're done searching through the history when all pull requests have
    // been generated for a commit hash.
    if (repos.length > 0 && todoStack.length === stackSize) {
      logger.info(`Created all necessary pull requests for ${commitText}.`);
      break;
    }
  }
  logger.info('Done searching through commit history.');
  logger.info(`${todoStack.length} items in the todo stack.`);

  // Copy files beginning with the oldest commit hash.
  for (const todo of todoStack.reverse()) {
    await copyCodeAndCreatePullRequest(
      sourceDir,
      todo.commitHash,
      todo.repo,
      octokitFactory,
      logger
    );
  }
  return todoStack.length;
}
