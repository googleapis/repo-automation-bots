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

import {Octokit} from '@octokit/rest';
import {newCmd} from './cmd';
import {Logger} from './logger';

// Limits imposed by Github.
export const MAX_TITLE_LENGTH = 255;
export const MAX_BODY_LENGTH = 64 * 1024 - 1;

export const REGENERATE_CHECKBOX_TEXT =
  '- [x] Regenerate this pull request now.';
export const EMPTY_REGENERATE_CHECKBOX_TEXT = REGENERATE_CHECKBOX_TEXT.replace(
  '[x]',
  '[ ]'
);

interface PullRequestContent {
  title: string;
  body: string;
}

/***
 * Github will reject the pull request if the title is longer than 255
 * characters.  This function will move characters from the title to the body
 * if the title is too long.
 *
 * @param rawBody the subject and body of the commit message.
 */
export function resplit(
  rawBody: string,
  withRegenerateCheckbox: WithRegenerateCheckbox
): PullRequestContent {
  const regexp = /([^\r\n]*)([\r\n]*)((.|\r|\n)*)/;
  const match = regexp.exec(rawBody)!;
  let title = match[1];
  let body = match[3];
  if (title.length > MAX_TITLE_LENGTH) {
    const splitIndex = MAX_TITLE_LENGTH - 3; // 3 dots.
    title = rawBody.substring(0, splitIndex) + '...';
    body = rawBody.substring(splitIndex);
  }
  if (withRegenerateCheckbox === WithRegenerateCheckbox.Yes) {
    body = EMPTY_REGENERATE_CHECKBOX_TEXT + '\n\n' + body;
  }
  return {title, body: body.substring(0, MAX_BODY_LENGTH)};
}

const NESTED_COMMIT_SEPARATOR = 'BEGIN_NESTED_COMMIT';

/**
 * Given pull request content and a new commit message. Rewrite the pull request
 * title and body using the newest message as the title. If the initial pull
 * request title was truncated with ellipses, rejoin the title to the remaining part.
 *
 * For example, if the existing pull request is something like:
 * Title: `feat: original feature`
 * Body: `Copy-Tag: 1234`
 *
 * and we prepend a new message of `feat: another new feature\nCopy-Tag: 2345`, the
 * output will be:
 * Title: `feat: another new feature`
 * Body: `Copy-Tag: 2345\nBEGIN_NESTED_COMMIT\nfeat: original feature\nCopy-Tag:1234\nEND_NESTED_COMMIT`
 *
 * @param {string} newCommitMessage the new commit message
 * @param {PullRequestContent} existingContent exisiting pull request title and body
 * @param {WithRegenerateCheckbox} withRegenerateCheckbox whether to include the
 *   checkbox to regenerate the pull request
 */
export function prependCommitMessage(
  newCommitMessage: string,
  existingContent: PullRequestContent,
  withRegenerateCheckbox: WithRegenerateCheckbox,
  withNestedCommitDelimiters: WithNestedCommitDelimiters = WithNestedCommitDelimiters.No
): PullRequestContent {
  // remove any regenerate checkbox content and leading/trailing whitespace
  const oldStrippedBody = existingContent.body
    .replace(EMPTY_REGENERATE_CHECKBOX_TEXT, '')
    .replace(REGENERATE_CHECKBOX_TEXT, '')
    .trim();
  // if title was truncated, re-add it to the beginning of the commit message
  const oldBody = existingContent.title.endsWith('...')
    ? `${existingContent.title.substring(
        0,
        existingContent.title.length - 3
      )}${oldStrippedBody}`
    : `${existingContent.title}\n${oldStrippedBody}`;
  if (withNestedCommitDelimiters === WithNestedCommitDelimiters.Yes) {
    // anything before the first BEGIN_NESTED_COMMIT marker, is considered part of
    // the previous commit
    const bodyParts = oldBody
      .split(NESTED_COMMIT_SEPARATOR)
      .map(part => part.trim());
    const oldBodyWithNestedCommitMarkers =
      bodyParts.length === 1
        ? // there is a single commit -- wrap the old body in the nested commit tags
          `${NESTED_COMMIT_SEPARATOR}\n${oldBody}\nEND_NESTED_COMMIT`
        : // there are already existing nested commit tags, content before the first
          // one is wrapped in a new nested commit tag
          `${NESTED_COMMIT_SEPARATOR}\n${
            bodyParts[0]
          }\nEND_NESTED_COMMIT\n${NESTED_COMMIT_SEPARATOR}\n${bodyParts
            .slice(1)
            .join(`\n${NESTED_COMMIT_SEPARATOR}\n`)}`;

    // prepend the new commit message and use original title truncation logic
    return resplit(
      `${newCommitMessage}\n\n${oldBodyWithNestedCommitMarkers}`,
      withRegenerateCheckbox
    );
  }
  return resplit(`${newCommitMessage}\n\n${oldBody}`, withRegenerateCheckbox);
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
 * Should createPullRequestFromLastCommit() force push to github?
 *
 * More type safe and readable than a boolean.
 */
export enum Force {
  Yes = '-f',
  No = '',
}

/**
 * Should createPullRequestFromLastCommit() create a pull request body with
 * a "[x] Regenerate this pull request now" checkbox?
 *
 * More type safe and readable than a boolean.
 */
export enum WithRegenerateCheckbox {
  Yes = 'yes',
  No = 'no',
}

/**
 * Should createPullRequestFromLastCommit() separate multiple commit message
 * bodies with `BEGIN_NESTED_COMMIT`/`END_NESTED_COMMIT`?
 *
 * More type safe and readable than a boolean.
 */
export enum WithNestedCommitDelimiters {
  Yes = 'yes',
  No = 'no',
}

/**
 * Creates a pull request using the title and commit message from the most
 * recent commit.
 * @param apiName Name of the API to optionally include in the PR title.
 * @param commitMessage The commit message to use to create the PR title and body.
 *        Uses the most recent commit message when omitted.
 * @returns an link to the pull request
 */
export async function createPullRequestFromLastCommit(
  owner: string,
  repo: string,
  localRepoDir: string,
  branch: string,
  pushUrl: string,
  labels: string[],
  octokit: Octokit,
  withRegenerateCheckbox = WithRegenerateCheckbox.No,
  apiName = '',
  forceFlag: Force = Force.No,
  logger: Logger = console,
  commitMessage?: string,
  draft = false
): Promise<string> {
  const cmd = newCmd(logger);
  const githubRepo = await octokit.repos.get({owner, repo});

  cmd(`git remote set-url origin ${pushUrl}`, {cwd: localRepoDir});
  cmd(`git push ${forceFlag} origin ${branch}`, {cwd: localRepoDir});

  // Use the commit's subject and body as the pull request's title and body.
  const rawBody: string =
    commitMessage ??
    cmd('git log -1 --format=%B', {
      cwd: localRepoDir,
    })
      .toString('utf8')
      .trim();

  const {title, body} = resplit(
    insertApiName(rawBody, apiName),
    withRegenerateCheckbox
  );

  // Create a pull request.
  const draftFlag = draft ? {draft: true} : {};
  const pull = await octokit.pulls.create({
    owner,
    repo,
    title,
    body,
    head: branch,
    base: githubRepo.data.default_branch,
    ...draftFlag,
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
  return pull.data.html_url;
}
