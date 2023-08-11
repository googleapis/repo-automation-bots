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

/* eslint-disable node/no-extraneous-import */

import {Context} from 'probot';
import {components} from '@octokit/openapi-types';
import {PullRequest} from '@octokit/webhooks-types';
import {Octokit} from '@octokit/rest';

//import {ILint} from '@commitlint/lint';
import lint from '@commitlint/lint';

import {addOrUpdateIssueComment, GCFLogger} from 'gcf-utils';

import {rules} from '@commitlint/config-conventional';

type PullsListCommitsResponseData = components['schemas']['commit'][];

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | undefined;

type Label = {
  name: string;
};

const AUTOMERGE_LABEL = 'automerge';

// modify rules slightly:
// see: https://github.com/conventional-changelog/commitlint/blob/master/%40commitlint/config-conventional/index.js
delete rules['type-enum'];
delete rules['subject-full-stop'];
rules['header-max-length'] = [2, 'always', Number.MAX_VALUE];
rules['body-max-line-length'] = [2, 'always', Number.MAX_VALUE];
rules['footer-max-line-length'] = [2, 'always', Number.MAX_VALUE];

export async function scanPullRequest(
  context: Context<'pull_request'> | Context<'issue_comment'>,
  pull_request: PullRequest,
  logger: GCFLogger,
  octokit: Octokit,
  always_check_pr_title = false
) {
  // Fetch last 100 commits stored on a specific PR.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const commitParams = context.repo({
    pull_number: pull_request.number,
    per_page: 100,
  });
  const prParams = context.repo({
    pull_number: pull_request.number,
  });

  const commits: PullsListCommitsResponseData = [];
  try {
    for await (const response of octokit.paginate.iterator(
      octokit.rest.pulls.listCommits,
      commitParams
    )) {
      for (const commit of response.data) {
        commits.push(commit);
      }
    }
  } catch (e) {
    const err = e as Error;
    logger.error(err);
    return;
  }

  if (commits.length === 0) {
    logger.info(`Pull request ${pull_request.html_url} has no commits!`);
    return;
  }

  let message = pull_request.title;
  let target = 'The PR title';

  const hasAutomergeLabel = pull_request.labels
    .map((label: Label) => {
      return label.name;
    })
    .includes(AUTOMERGE_LABEL);

  let refreshed_pr: PullRequest;

  // Refreshing PR probably because we want to know the most updated data.
  try {
    refreshed_pr = (await octokit.pulls.get(prParams)).data as PullRequest;
  } catch (e) {
    const err = e as Error;
    logger.error(err);
    return;
  }
  const autoMergeEnabledStatus = refreshed_pr.auto_merge;

  const hasAutoMergeEnabled =
    autoMergeEnabledStatus && autoMergeEnabledStatus?.merge_method === 'squash';

  // if there is only one commit, and we're not not using automerge
  // to land the pull request, lint the commit rather than the title.
  // This is done becaues GitHub uses the commit title, rather than the
  // issue title, if there is only one commit:
  let usingCommitMessage = false;
  if (
    commits.length === 1 &&
    !hasAutomergeLabel &&
    !hasAutoMergeEnabled &&
    always_check_pr_title !== true
  ) {
    message = commits[0].commit.message;
    usingCommitMessage = true;
    target = 'Some of your commit messages';
  }

  let text = '';
  let lintError = false;

  // support "foo!: message" syntax, see:
  // https://github.com/conventional-changelog/commitlint/pull/767
  message = message.replace('!:', ':');

  const result = await lint(message.toLowerCase(), rules);

  if (result.valid === false) {
    lintError = true;
    text += ':x: The following linting errors found:\n';
    result.errors.forEach(error => {
      text += `* ${error.message}\n`;
    });
    text += `for the following input:\n"*${result.input}*"\n\n`;

    // And if there's only one commit and the commit message and the
    // PR title are not the same value, it's mostly because the PR
    // author edited the PR title in an intention to please this bot.
    // Let them know how to use the PR title for the commit history.
    if (
      usingCommitMessage &&
      commits[0].commit.message.split('\n')[0] !== pull_request.title
    ) {
      logger.info(
        `commit message: ${commits[0].commit.message.split('\n')[0]}`
      );
      logger.info(`PR title: ${pull_request.title}`);
      const owner = pull_request.base.repo.owner?.login;
      const repo = context.payload.repository.name;
      const prNumber = pull_request.number;
      const installationId = context.payload.installation?.id;
      const message =
        '🤖 I detect that the PR title and the commit message' +
        " differ and there's only one commit. To use the PR title for the" +
        " commit history, you can use Github's automerge feature with" +
        ' squashing, or use `automerge` label. Good luck human!\n\n' +
        ' -- conventional-commit-lint bot\n' +
        'https://conventionalcommits.org/';
      try {
        await addOrUpdateIssueComment(
          octokit,
          owner as string,
          repo,
          prNumber,
          installationId as number,
          message,
          false
        );
      } catch (err) {
        // This is a solely convenience feature, so we ignore errors.
        logger.warn(`Failed to add a comment: ${err}`);
      }
    }
  }

  // post the status of commit linting to the PR, using:
  // https://developer.github.com/v3/checks/
  let checkParams = context.repo({
    name: 'conventionalcommits.org',
    conclusion: 'success' as Conclusion,
    // commit.sha can be null as per GitHub's OpenAPI spec  ¯\_(ツ)_/¯
    head_sha: commits[commits.length - 1].sha as string,
  });

  if (lintError) {
    let summary = `${target} failed linting.\n\nVisit [conventionalcommits.org](https://conventionalcommits.org) to learn our conventions.\n\n`;
    if (usingCommitMessage) {
      summary +=
        'Run `git commit --amend` and edit your message to match Conventional Commit guidelines.';
    } else {
      summary +=
        'edit your pull request title to match Conventional Commit guidelines.';
    }

    checkParams = context.repo({
      head_sha: commits[commits.length - 1].sha as string,
      conclusion: 'failure' as Conclusion,
      name: 'conventionalcommits.org',
      output: {
        title: 'Commit message did not follow Conventional Commits',
        summary,
        text,
      },
    });
  }

  await octokit.checks.create(checkParams);
}
