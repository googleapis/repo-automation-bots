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
import {EventPayloads} from '@octokit/webhooks';

type PullRequestPayload = EventPayloads.WebhookPayloadPullRequestPullRequest;
type IssuePayload = EventPayloads.WebhookPayloadIssuesIssue;

const CONFIGURATION_FILE_PATH = 'blunderbuss.yml';
const ASSIGN_LABEL = 'blunderbuss: assign';

class ByConfig {
  labels: string[] = [];
  to: string[] = [];
}

interface Configuration {
  assign_issues?: string[];
  assign_issues_by?: ByConfig[];
  assign_prs?: string[];
  assign_prs_by?: ByConfig[];
}

interface Issue {
  owner?: string;
  repo?: string;
  number: number;
  labels: {name: string}[];
  draft?: boolean;
}

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

async function getConfig(context: Context) {
  let config: Configuration = {};
  try {
    // Reading the config requires access to code permissions, which are not
    // always available for private repositories.
    config = (await context.config<Configuration>(
      CONFIGURATION_FILE_PATH,
      {}
    ))!;
  } catch (err) {
    err.message = `Error reading configuration: ${err.message}`;
    logger.error(err);
    return;
  }
  return config || {};
}

async function checkIfIssueAlreadyAssigned(
  context: Context,
  repoName: string,
  issue: Issue,
  issuePayload: PullRequestPayload | IssuePayload,
  byConfig: ByConfig[] | undefined
) {
  let ignored = false;
  const isLabeled = context.payload.action === 'labeled';
  if (isLabeled) {
    // Only assign an issue that already has an assignee if labeled with
    // ASSIGN_LABEL.
    if (
      context.payload.label.name !== ASSIGN_LABEL &&
      issuePayload.assignees?.length
    ) {
      context.log.info(
        '[%s] #%s ignored: incorrect label ("%s") because it is already assigned',
        repoName,
        issue.number,
        context.payload.label.name
      );
      ignored = true;
      return ignored;
    }
    // Check if the new label has a possible assignee.
    // Don't check all labels to avoid updating an old issue when someone
    // changes a random label.
    const assigneesForNewLabel = findAssignees(byConfig, [
      context.payload.label.name,
    ]);
    if (
      assigneesForNewLabel.length === 0 &&
      context.payload.label.name !== ASSIGN_LABEL
    ) {
      context.log.info(
        '[%s] #%s ignored: incorrect label ("%s")',
        repoName,
        issue.number,
        context.payload.label.name
      );
      ignored = true;
      return ignored;
    }
    if (context.payload.label.name === ASSIGN_LABEL) {
      // Remove the label so the user knows the event was processed (even if not successfully).
      await context.octokit.issues.removeLabel(
        context.issue({name: ASSIGN_LABEL})
      );
    }
  }

  // Allow the label to force a new assignee, even if one is already assigned.
  if (!isLabeled && issuePayload.assignees?.length !== 0) {
    context.log.info(
      util.format(
        '[%s] #%s ignored: already has assignee(s)',
        repoName,
        issue.number
      )
    );
    ignored = true;
    return ignored;
  }

  return ignored;
}

async function assign(
  context: Context,
  issue: Issue,
  byConfig: ByConfig[] | undefined,
  assignConfig: string[] | undefined,
  issuePayload: PullRequestPayload | IssuePayload,
  repoName: string
) {
  let labels: string[] = [];
  if (byConfig !== undefined && context.payload.action === 'opened') {
    // It is possible that blunderbuss is running before other bots have
    // a chance to add extra labels. Wait and re-pull fresh labels
    // before comparing against the config.
    await sleep(10_000);
    const labelResp = await context.octokit.issues.listLabelsOnIssue({
      issue_number: issue.number,
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
    });
    labels = labelResp.data.map(lr => lr.name);
  } else {
    labels = issue.labels?.map(l => l.name);
  }
  const preferredAssignees = findAssignees(byConfig, labels);
  let possibleAssignees = preferredAssignees.length
    ? preferredAssignees
    : assignConfig || [];
  possibleAssignees = await expandTeams(possibleAssignees, context);
  const assignee = randomFrom(possibleAssignees, issuePayload.user.login);
  if (!assignee) {
    context.log.info(
      util.format(
        '[%s] #%s not assigned: no valid assignee(s)',
        repoName,
        issue.number
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
        issue.number,
        assignee,
        resp.status
      )
    );
    return;
  }
  context.log.info(
    util.format(
      '[%s] #%s was assigned to %s',
      issue.owner,
      issue.repo,
      issue.number,
      assignee
    )
  );
}

export const sleep = (ms: number) => {
  return new Promise(r => setTimeout(r, ms));
};

export function blunderbuss(app: Probot) {
  app.on(
    ['issues.opened', 'issues.reopened', 'issues.labeled'],
    async context => {
      const config = await getConfig(context);

      const issue: Issue = context.payload.issue;
      const repoName = context.payload.repository.full_name;

      // Check if the config specifically asks to not assign issues or PRs
      if (
        context.payload.issue &&
        !config!.assign_issues &&
        !config!.assign_issues_by
      ) {
        const paramName = '"assign_issues" and "assign_issues_by"';
        context.log.info(
          util.format(
            '[%s] #%s ignored: %s not in config',
            repoName,
            issue.number,
            paramName
          )
        );
        return;
      }

      // PRs are a superset of issues, so we can handle them similarly.
      const assignConfig = config!.assign_issues;
      const byConfig = config!.assign_issues_by;
      const issuePayload = context.payload.issue;

      const ignore = await checkIfIssueAlreadyAssigned(
        context,
        repoName,
        issue,
        issuePayload,
        byConfig
      );

      if (ignore) {
        return;
      }

      await assign(
        context,
        issue,
        byConfig,
        assignConfig,
        issuePayload,
        repoName
      );
    }
  );
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.edited',
      'pull_request.labeled',
    ],
    async context => {
      const config = await getConfig(context);
      console.log(config);

      const issue: Issue = context.payload.pull_request;
      const repoName = context.payload.repository.full_name;

      // If this is a PR, and it's in draft mode, don't assign it
      if (issue.draft === true) {
        logger.info(`Skipping ${repoName}#${issue.number} as it's a draft PR`);
        return;
      }

      // Check if the config specifically asks to not assign issues or PRs
      if (
        context.payload.pull_request &&
        !config!.assign_prs &&
        !config!.assign_prs_by
      ) {
        const paramName = '"assign_prs" and "assign_prs_by"';
        context.log.info(
          util.format(
            '[%s] #%s ignored: %s not in config',
            repoName,
            issue.number,
            paramName
          )
        );
        return;
      }

      // PRs are a superset of issues, so we can handle them similarly.
      const assignConfig = config!.assign_prs!;
      const byConfig = config!.assign_prs_by;
      const issuePayload = context.payload.pull_request;

      const ignore = await checkIfIssueAlreadyAssigned(
        context,
        repoName,
        issue,
        issuePayload,
        byConfig
      );

      if (ignore) {
        return;
      }

      await assign(
        context,
        issue,
        byConfig,
        assignConfig,
        issuePayload,
        repoName
      );
    }
  );
}

function findAssignees(
  config: ByConfig[] | undefined,
  labels: string[]
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
      result.push(member!.login);
    }
  }
  return result;
}
