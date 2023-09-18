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

// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {GCFLogger, logger as defaultLogger} from 'gcf-utils';
export {addOrUpdateIssueComment} from './issue-comments';

export interface Issue {
  owner: string;
  repo: string;
  number: number;
  title: string;
  body: string;
  labels: string[];
}

function issueFromGitHubIssue(
  owner: string,
  repo: string,
  issue: {
    number: number;
    title: string;
    body?: string | null;
    labels: (string | {name?: string})[];
  }
): Issue {
  return {
    owner,
    repo,
    number: issue.number,
    title: issue.title,
    body: issue.body || '',
    labels: issue.labels.map(label =>
      typeof label === 'string' ? label : label.name || ''
    ),
  };
}

async function findOpenIssueByCreator(
  octokit: Octokit,
  owner: string,
  repo: string,
  creator: string
): Promise<Issue[]> {
  const issues: Issue[] = [];
  for (const issue of await octokit.paginate(octokit.issues.listForRepo, {
    owner,
    repo,
    state: 'open',
    creator,
  })) {
    issues.push(issueFromGitHubIssue(owner, repo, issue));
  }
  return issues;
}

function issueNeedsUpdating(issue: Issue, expectedBody: string) {
  return issue.body !== expectedBody;
}

/**
 * Return the authenticated username of the installed GitHub app. Apps are
 * not allowed to use the users.getAuthenticated() endpoint.
 * @param {Octokit} octokit
 * @return {string} The username of the authenticated app
 */
async function getAuthenticatedBotUser(octokit: Octokit): Promise<string> {
  const {
    data: {slug},
  } = await octokit.apps.getAuthenticated();
  return `${slug}[bot]`;
}

/**
 * Opens or edits an existing issue that matches the issue title and
 * authenticated user.
 *
 * @param {Octokit} octokit - The Octokit instance.
 * @param {string} owner - The owner of the repository.
 * @param {string} repo - The name of the repository.
 * @param {string} title - The issue title.
 * @param {string} body - The issue body.
 * @param {string[]} labels - Labels to attach to the issue.
 * @param {GCFLogger} logger - A context logger.
 * @returns {Issue} The created or updated issue.
 */
export async function addOrUpdateIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  title: string,
  body: string,
  labels: string[],
  logger: GCFLogger = defaultLogger
): Promise<Issue> {
  const issueOpener = await getAuthenticatedBotUser(octokit);
  const issues = await findOpenIssueByCreator(
    octokit,
    owner,
    repo,
    issueOpener
  );
  const issue = issues.find(issue => issue.title === title);
  if (issue) {
    logger.info(`Found existing issue: #${issue.number}`);

    if (!issueNeedsUpdating(issue, body)) {
      // no need to update the issue
      logger.info('Issue remains unchanged');
      logger.metric('issue.unchanged', {opener: issueOpener});
      return issue;
    } else {
      // issue body has changed, maybe update it
      logger.info('Updating issue');
      const {data: updatedIssue} = await octokit.issues.update({
        owner,
        repo,
        issue_number: issue.number,
        body,
      });
      logger.metric('issue.updated', {opener: issueOpener});
      return issueFromGitHubIssue(owner, repo, updatedIssue);
    }
  }

  // no existing issue - open a new one
  logger.info('No existing issue found - opening new issue');
  const {data: newIssue} = await octokit.issues.create({
    owner,
    repo,
    title,
    body,
    labels,
  });
  logger.metric('issue.opened', {opener: issueOpener});
  return issueFromGitHubIssue(owner, repo, newIssue);
}

/**
 * Closes an existing issue that matches the issue title and
 * authenticated user.
 *
 * @param {Octokit} octokit - The Octokit instance.
 * @param {string} owner - The owner of the repository.
 * @param {string} repo - The name of the repository.
 * @param {string} title - The issue title.
 * @param {GCFLogger} logger - A context logger.
 * @returns {Issue} The created or updated issue.
 */
export async function closeIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  title: string,
  logger: GCFLogger = defaultLogger
): Promise<Issue | null> {
  const issueOpener = await getAuthenticatedBotUser(octokit);
  const issues = await findOpenIssueByCreator(
    octokit,
    owner,
    repo,
    issueOpener
  );
  const issue = issues.find(issue => issue.title === title);
  if (!issue) {
    // No existing issue found, nothing to do.
    return null;
  }

  logger.info(`Found existing issue: #${issue.number}, closing`);
  const {data: updatedIssue} = await octokit.issues.update({
    owner,
    repo,
    issue_number: issue.number,
    state: 'closed',
    state_reason: 'completed',
  });
  logger.metric('issue.closed', {opener: issueOpener});
  return issueFromGitHubIssue(owner, repo, updatedIssue);
}
