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
import {newCmd} from './cmd';
import {core} from './core';
import * as createPr from './create-pr';
import {GithubRepo, githubRepoFromUri} from './github-repo';
import {OctokitFactory} from './octokit-util';

export async function maybeCreatePullRequestForLockUpdate(
  octokitFactory: OctokitFactory,
  githubRepo?: GithubRepo,
  localRepoDir?: string,
  createPullRequestFromLastCommit = createPr.createPullRequestFromLastCommit,
  logger = console
): Promise<void> {
  const cmd = newCmd(logger);
  const cwd = localRepoDir ?? '.';
  // 'git status' returns the empty string when no changes are pending.
  const status = cmd('git status --porcelain', {cwd}).toString('utf8').trim();
  if (status) {
    // Commit additional changes.
    cmd('git add -A', {cwd});
    cmd('git commit --amend --no-edit', {cwd});

    // Create credentials.
    const token = await octokitFactory.getGitHubShortLivedAccessToken();

    // Create the pull request.
    const uri = cmd('git remote get-url origin', {cwd}).toString('utf8').trim();
    if (!githubRepo) {
      githubRepo = githubRepoFromUri(uri);
    }
    const branch = cmd('git branch --show-current', {cwd})
      .toString('utf8')
      .trim();
    const octokit = await octokitFactory.getShortLivedOctokit(token);
    await createPullRequestFromLastCommit(
      githubRepo.owner,
      githubRepo.repo,
      cwd,
      branch,
      githubRepo.getCloneUrl(token),
      [core.OWL_BOT_LOCK_UPDATE],
      octokit,
      '',
      logger
    );
  } else {
    logger.log(
      "The post processor made no changes; I won't create a pull request."
    );
  }
}
