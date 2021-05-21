// Copyright 2019 Google LLC
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
import {Probot, Context} from 'probot';
import * as util from 'util';
import {logger} from 'gcf-utils';
import {
  PullRequestEvent,
  IssuesEvent,
  Issue,
  PullRequest,
} from '@octokit/webhooks-definitions/schema';
import {Endpoints} from '@octokit/types';
import {DatastoreLock} from '@google-automations/datastore-lock';
import {
  ConfigChecker,
  getConfigWithDefault,
} from '@google-automations/bot-config-utils';
import {sleep} from './utils';
import schema from './config-schema.json';
import {ByConfig, CONFIGURATION_FILE_PATH, Configuration} from './config';

const ASSIGN_LABEL = 'blunderbuss: assign';

type getIssueResponse =
  Endpoints['GET /repos/{owner}/{repo}/issues/{issue_number}']['response'];

// Randomly returns an item from an array, while ignoring the provided value.
// Returns undefined if no options remain.
function randomFrom(items: string[], ignore: string): string | undefined {
  const unique = new Set(items);
  unique.delete(ignore);
  items = [...unique];
  if (items.length === 0) {
    return undefined;
  }
  return items[Math.floor(Math.random() * items.length)];
}

function isIssue(issue: IssuesEvent | PullRequestEvent): issue is IssuesEvent {
  return (issue as IssuesEvent).issue !== undefined;
}

export = (app: Probot) => {
  app.on(
    [
      'issues.opened',
      'issues.reopened',
      'issues.labeled',
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.edited',
      'pull_request.labeled',
      'pull_request.synchronize',
    ],
    async (context: Context) => {
      const {owner, repo} = context.repo();
      // First check the config schema for pull requests.
      if (
        context.payload.pull_request &&
        (context.payload.action === 'opened' ||
          context.payload.action === 'reopened' ||
          context.payload.action === 'synchronize')
      ) {
        const configChecker = new ConfigChecker<Configuration>(
          schema,
          CONFIGURATION_FILE_PATH
        );
        const {owner, repo} = context.repo();
        await configChecker.validateConfigChanges(
          context.octokit,
          owner,
          repo,
          context.payload.pull_request.head.sha,
          context.payload.pull_request.number
        );
      }
      // For blunderbuss, synchronize event is irelevant.
      if (context.payload.action === 'synchronize') {
        return;
      }
      let config: Configuration = {};
      try {
        // Reading the config requires access to code permissions, which are not
        // always available for private repositories.
        config = await getConfigWithDefault<Configuration>(
          context.octokit,
          owner,
          repo,
          CONFIGURATION_FILE_PATH,
          {}
        );
      } catch (err) {
        err.message = `Error reading configuration: ${err.message}`;
        logger.error(err);
        return;
      }

      let lockTarget: string;
      if (isIssue(context.payload)) {
        lockTarget = context.payload.issue.url;
      } else {
        lockTarget = context.payload.pull_request.url;
      }

      // Acquire the lock.
      const lock = new DatastoreLock('blunderbuss', lockTarget);
      const lockResult = await lock.acquire();
      if (!lockResult) {
        throw new Error('Failed to acquire a lock for ${lockTarget}');
      }

      try {
        await assign(context, config);
      } finally {
        lock.release();
      }
    }
  );
};

async function assign(context: Context, config: Configuration) {
  let issue: Issue | undefined;
  let pullRequest: PullRequest | undefined;
  if (isIssue(context.payload)) {
    issue = context.payload.issue;
  } else {
    pullRequest = context.payload.pull_request;
  }

  const repoName = context.payload.repository.full_name;

  const issueOrPRNumber = issue?.number || pullRequest?.number;
  const issueOrPROwner = issue?.user.login || pullRequest?.user.login;
  const issueOrPRRepo = context.payload.repository.name;
  // If this is a PR, and it's in draft mode, don't assign it
  if (pullRequest?.draft === true) {
    logger.info(
      `Skipping ${repoName}#${pullRequest.number} as it's a draft PR`
    );
    return;
  }

  // Check if the config specifically asks to not assign issues or PRs
  if (
    (issue && !config.assign_issues && !config.assign_issues_by) ||
    (pullRequest && !config.assign_prs && !config.assign_prs_by)
  ) {
    const paramName = issue
      ? '"assign_issues" and "assign_issues_by"'
      : '"assign_prs" and "assign_prs_by"';
    context.log.info(
      util.format(
        '[%s] #%s ignored: %s not in config',
        repoName,
        issueOrPRNumber,
        paramName
      )
    );
    return;
  }

  // PRs are a superset of issues, so we can handle them similarly.
  const assignConfig = issue ? config.assign_issues : config.assign_prs!;
  const byConfig = issue ? config.assign_issues_by : config.assign_prs_by;
  const user = issue ? issue.user.login : pullRequest!.user.login;

  // Reload the issue and use the assignee for counting.
  let refreshedIssueResponse: getIssueResponse | null = null;

  try {
    refreshedIssueResponse = await context.octokit.issues.get(
      context.repo({issue_number: issueOrPRNumber as number})
    );
  } catch (err) {
    if (err.status === 404) {
      context.log.info(
        '[%s] #%s ignored: got 404 on refreshing the issue',
        repoName,
        issueOrPRNumber
      );
      return;
    } else {
      throw err;
    }
  }

  const isLabeled = context.payload.action === 'labeled';
  if (isLabeled) {
    // Only assign an issue that already has an assignee if labeled with
    // ASSIGN_LABEL.
    if (
      context.payload.label?.name !== ASSIGN_LABEL &&
      refreshedIssueResponse!.data.assignees?.length
    ) {
      context.log.info(
        '[%s] #%s ignored: incorrect label ("%s") because it is already assigned',
        repoName,
        issueOrPRNumber,
        context.payload.label?.name
      );
      return;
    }
    // Check if the new label has a possible assignee.
    // Don't check all labels to avoid updating an old issue when someone
    // changes a random label.
    let assigneesForNewLabel: string[] | undefined;
    if (context.payload.label?.name) {
      assigneesForNewLabel = findAssignees(byConfig, [
        context.payload.label.name,
      ]);
    }

    if (
      assigneesForNewLabel?.length === 0 &&
      context.payload.label?.name !== ASSIGN_LABEL
    ) {
      context.log.info(
        '[%s] #%s ignored: incorrect label ("%s")',
        repoName,
        issueOrPRNumber,
        context.payload.label?.name
      );
      return;
    }
    if (context.payload.label?.name === ASSIGN_LABEL) {
      // Remove the label so the user knows the event was processed (even if not successfully).
      await context.octokit.issues.removeLabel(
        context.issue({name: ASSIGN_LABEL})
      );
    }
  }

  // Allow the label to force a new assignee, even if one is already assigned.
  if (!isLabeled && refreshedIssueResponse!.data.assignees?.length !== 0) {
    context.log.info(
      util.format(
        '[%s] #%s ignored: already has assignee(s)',
        repoName,
        issueOrPRNumber
      )
    );
    return;
  }

  let labels: string[] | undefined = [];
  if (byConfig !== undefined && context.payload.action === 'opened') {
    // It is possible that blunderbuss is running before other bots have
    // a chance to add extra labels. Wait and re-pull fresh labels
    // before comparing against the config.
    await sleep(10_000);
    const labelResp = await context.octokit.issues.listLabelsOnIssue({
      issue_number: issueOrPRNumber!,
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
    });
    labels = labelResp.data.map(lr => lr.name);
  } else {
    labels = issue
      ? issue.labels?.map(l => l.name)
      : pullRequest?.labels?.map(l => l.name);
  }
  const preferredAssignees = findAssignees(byConfig, labels);
  let possibleAssignees = preferredAssignees.length
    ? preferredAssignees
    : assignConfig || [];
  possibleAssignees = await expandTeams(possibleAssignees, context);
  const assignee = randomFrom(possibleAssignees, user);
  if (!assignee) {
    context.log.info(
      util.format(
        '[%s] #%s not assigned: no valid assignee(s)',
        repoName,
        issueOrPRNumber
      )
    );
    return;
  }

  const resp = await context.octokit.issues.addAssignees(
    context.issue({assignees: [assignee]})
  );
  if (resp.status !== 201) {
    context.log.error(
      util.format(
        '[%s] #%s could not be assined to %s: status %d',
        repoName,
        issueOrPRNumber,
        assignee,
        resp.status
      )
    );
    return;
  }
  context.log.info(
    util.format(
      '[%s] #%s was assigned to %s',
      issueOrPROwner,
      issueOrPRRepo,
      issueOrPRNumber,
      assignee
    )
  );
}

function findAssignees(
  config: ByConfig[] | undefined,
  labels: string[] | undefined
): string[] {
  let assignees: string[] = [];
  if (labels && config) {
    for (const c of config) {
      for (const l of labels) {
        if (c.labels.includes(l)) {
          assignees = assignees.concat(c.to);
        }
      }
    }
  }
  return assignees;
}

async function expandTeams(
  usernames: string[],
  context: Context
): Promise<string[]> {
  const result: string[] = [];
  for (const user of usernames) {
    if (user.indexOf('/') === -1) {
      // Normal user. Not a team.
      result.push(user);
      continue;
    }
    // There is a slash. Probably a team.
    const [org, slug] = user.split('/');
    const members = (
      await context.octokit.teams.listMembersInOrg({
        org,
        team_slug: slug,
      })
    ).data;
    for (const member of members) {
      if (member?.login) {
        result.push(member?.login);
      }
    }
  }
  return result;
}
