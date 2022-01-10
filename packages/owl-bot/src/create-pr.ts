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
import {OctokitType} from './octokit-util';

// Limits imposed by Github.
export const MAX_TITLE_LENGTH = 255;
export const MAX_BODY_LENGTH = 64 * 1024 - 1;

/***
 * Github will reject the pull request if the title is longer than 255
 * characters.  This function will move characters from the title to the body
 * if the title is too long.
 */
export function resplit(
  title: string,
  body: string
): {title: string; body: string} {
  if (title.length > MAX_TITLE_LENGTH) {
    const splitIndex = MAX_TITLE_LENGTH - 3; // 3 dots.
    body = '...' + title.substring(splitIndex) + '\n\n' + body;
    title = title.substring(0, splitIndex) + '...';
  }
  return {title, body: body.substring(0, MAX_BODY_LENGTH)};
}

/**
 * Returns the body of the most recent commit message in a git directory.
 */
export function getLastCommitBody(
  localRepoDir: string,
  logger = console
): string {
  const cmd = newCmd(logger);
  return cmd('git log -1 --format=%b', {
    cwd: localRepoDir,
  })
    .toString('utf8')
    .trim();
}

// Exported for testing only.
/**
 * Inserts an API name into a pr title after the first colon.
 * Ex:
 *   chore(bazel): Update gapic-generator-php to v1.2.1
 * bocomes
 *   chore(bazel): [Billing] Update gapic-generator-php to v1.2.1
 */
export function insertApiName(prTitle: string, apiName: string): string {
  if (!apiName) {
    return prTitle;
  }
  // Only search for the colon in the first 40 characters of the title,
  // and stop at new lines.  A conventional commit message shouldn't
  // exceed 40 characters.
  const match = /^[^\r\n]{1,40}/.exec(prTitle);
  const firstForty = match ? match[0] : '';
  const firstColon = firstForty.indexOf(':');
  if (firstColon < 0) {
    return `[${apiName}] ${prTitle}`;
  } else {
    const left = prTitle.substring(0, firstColon + 1);
    const right = prTitle.substring(firstColon + 1);
    return `${left} [${apiName}]${right}`;
  }
}

/**
 * Creates a pull request using the title and commit message from the most
 * recent commit.
 * @argument apiName Name of the API to optionally include in the PR title.
 */
export async function createPullRequestFromLastCommit(
  owner: string,
  repo: string,
  localRepoDir: string,
  branch: string,
  pushUrl: string,
  labels: string[],
  octokit: OctokitType,
  prBody = '',
  apiName = '',
  logger = console
): Promise<void> {
  const cmd = newCmd(logger);
  const githubRepo = await octokit.repos.get({owner, repo});

  cmd(`git remote set-url origin ${pushUrl}`, {cwd: localRepoDir});
  cmd(`git push origin ${branch}`, {cwd: localRepoDir});

  // Use the commit's subject and body as the pull request's title and body.
  const commitSubject: string = cmd('git log -1 --format=%s', {
    cwd: localRepoDir,
  })
    .toString('utf8')
    .trim();
  const commitBody = prBody ?? getLastCommitBody(localRepoDir, logger);

  const {title, body} = resplit(
    insertApiName(commitSubject, apiName),
    commitBody
  );

  // Create a pull request.
  const pull = await octokit.pulls.create({
    owner,
    repo,
    title,
    body,
    head: branch,
    base: githubRepo.data.default_branch,
  });
  logger.info(`Created pull request ${pull.data.html_url}`);
  if (labels.length > 0) {
    await octokit.issues.update({
      owner,
      repo,
      issue_number: pull.data.number,
      labels,
    });
  }
}
