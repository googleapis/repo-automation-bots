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

export async function createPullRequestFromLastCommit(
  owner: string,
  repo: string,
  localRepoDir: string,
  branch: string,
  pushUrl: string,
  labels: string[],
  octokit: OctokitType,
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
  const commitBody: string = cmd('git log -1 --format=%b', {
    cwd: localRepoDir,
  })
    .toString('utf8')
    .trim();

  const {title, body} = resplit(commitSubject, commitBody);

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
