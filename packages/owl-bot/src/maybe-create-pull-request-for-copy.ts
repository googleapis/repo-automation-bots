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
import {OWL_BOT_COPY} from '.';
import {newCmd} from './cmd';
import {findCopyTag, loadOwlBotYaml, unpackCopyTag} from './copy-code';
import path from 'path';
import * as createPr from './create-pr';
import {GithubRepo, githubRepoFromUri} from './github-repo';
import {OctokitFactory} from './octokit-util';
import {DEFAULT_OWL_BOT_YAML_PATH} from './config-files';
import {commitOwlbotUpdate} from './bin/commands/commit-post-processor-update';

/**
 * scan-googleapis-gen-and-create-pull-requests has created a branch
 * containing the new code.
 *
 * update-copy-branch.yaml has run the post processor on the branch,
 * checked out in localRepoDir, and run `git add -A`.
 *
 * This function inspects the contents of the branch and returns true if
 * there are changes for which we should open a pull request.
 */
export function shouldCreatePullRequestForCopyBranch(
  mainBranch: string,
  localRepoDir = '.',
  logger = console
): boolean {
  const cmd = newCmd(logger);
  const cwd = localRepoDir;

  // Find the most recent common ancestor between the main branch and the
  // pull request branch.
  const ancestor = cmd(`git merge-base HEAD ${mainBranch}`, {cwd})
    .toString('utf-8')
    .trim();

  const diff = cmd(`git diff --staged ${ancestor}`, {cwd})
    .toString('utf-8')
    .trim();
  return Boolean(diff);
}

/**
 * Deletes the currently checked out branch from github.
 */
export async function deleteCopyBranch(
  octokitFactory: OctokitFactory,
  localRepoDir = '.',
  logger = console
): Promise<void> {
  const cmd = newCmd(logger);
  const cwd = localRepoDir;

  const branch = cmd('git branch --show-current', {cwd})
    .toString('utf-8')
    .trim();
  const uri = cmd('git remote get-url origin', {cwd}).toString('utf8').trim();
  const githubRepo = githubRepoFromUri(uri);
  (await octokitFactory.getShortLivedOctokit()).git.deleteRef({
    owner: githubRepo.owner,
    repo: githubRepo.repo,
    ref: `heads/${branch}`,
  });
}

/**
 * Create a pull request for the code in localRepoDir.
 */
export async function createPullRequestForCopyBranch(
  octokitFactory: OctokitFactory,
  force: createPr.Force = createPr.Force.No,
  githubRepo?: GithubRepo,
  localRepoDir = '.',
  createPullRequestFromLastCommit = createPr.createPullRequestFromLastCommit,
  logger = console
): Promise<void> {
  const cmd = newCmd(logger);
  const cwd = localRepoDir;

  // Load the most recent commit message and OwlBot.yaml.
  const lastCommitMessage = cmd('git log -1 --format=%B', {cwd}).toString(
    'utf-8'
  );
  let squash = false;
  let apiName: string | undefined;
  if (force === createPr.Force.Yes) {
    // Don't attempt to parse the commit message and yamls because that may
    // be what's causing the non-forced attempts to fail.
  } else {
    const copyTag = unpackCopyTag(findCopyTag(lastCommitMessage));
    const yaml = await loadOwlBotYaml(path.join(localRepoDir, copyTag.p));
    const rootYaml = await loadOwlBotYaml(
      path.join(localRepoDir, DEFAULT_OWL_BOT_YAML_PATH)
    );
    squash = Boolean(yaml.squash || rootYaml.squash);
    apiName = yaml['api-name'];
  }

  const changes = cmd('git status --porcelain', {cwd}).toString('utf-8').trim();
  if (!changes) {
    // There are no changes to commit.
  } else if (squash) {
    // Squash the copy-code commit and the post-processor commit into a
    // single commit.
    cmd('git commit --amend --no-edit', {cwd});
  } else {
    commitOwlbotUpdate(localRepoDir);
  }

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
    [OWL_BOT_COPY],
    octokit,
    createPr.WithRegenerateCheckbox.Yes,
    apiName,
    squash ? createPr.Force.Yes : createPr.Force.No,
    logger,
    lastCommitMessage
  );
}
