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
import {Application} from 'probot';
import * as util from 'util';

const CONFIGURATION_FILE_PATH = 'blunderbuss.yml';
const ASSIGN_LABEL = 'blunderbuss: assign';

class ByConfig {
  by: {
    labels: string[];
    to: string[];
  }[] = [];
}

interface Configuration {
  assign_issues?: (string | ByConfig)[];
  assign_prs?: string[];
}

interface Issue {
  owner: string;
  repo: string;
  number: number;
  labels: {name: string}[];
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

export = (app: Application) => {
  app.on(
    [
      'issues.opened',
      'issues.reopened',
      'issues.labeled',
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.labeled',
    ],
    async context => {
      const config = (await context.config(
        CONFIGURATION_FILE_PATH,
        {}
      )) as Configuration;
      const issue = (context.payload.issue
        ? context.payload.issue
        : context.payload.pull_request) as Issue;

      if (
        (context.payload.issue && !config.assign_issues) ||
        (context.payload.pull_request && !config.assign_prs)
      ) {
        const paramName = context.payload.issue
          ? 'assign_issues'
          : 'assign_prs';
        context.log.info(
          util.format(
            '[%s/%s] #%s ignored: "%s" not in config',
            issue.owner,
            issue.repo,
            issue.number,
            paramName
          )
        );
        return;
      }

      // PRs are a superset of issues, so we can handle them similarly.
      const assignConfig = context.payload.issue
        ? config.assign_issues!
        : config.assign_prs!;
      const issuePayload =
        context.payload.issue || context.payload.pull_request;

      const isLabeled = context.payload.action === 'labeled';
      if (isLabeled) {
        // Only assign an issue that already has an assignee if labeled with
        // ASSIGN_LABEL.
        if (
          context.payload.label.name !== ASSIGN_LABEL &&
          issuePayload.assignees?.length
        ) {
          console.log('bad label!', context.payload.label.name);
          context.log.info(
            '[%s/%s] #%s ignored: incorrect label ("%s") because it is already assigned',
            issue.owner,
            issue.repo,
            issue.number,
            context.payload.label.name
          );
          return;
        }
        // Check if the new label has a possible assignee.
        // Don't check all labels to avoid updating an old issue when someone
        // changes a random label.
        const assigneesForNewLabel = findAssignees(
          assignConfig,
          [context.payload.label.name],
          true
        );
        if (
          assigneesForNewLabel.length === 0 &&
          context.payload.label.name !== ASSIGN_LABEL
        ) {
          context.log.info(
            '[%s/%s] #%s ignored: incorrect label ("%s")',
            issue.owner,
            issue.repo,
            issue.number,
            context.payload.label.name
          );
          return;
        }
        if (context.payload.label.name === ASSIGN_LABEL) {
          // Remove the label so the user knows the event was processed (even if not successfully).
          await context.github.issues.removeLabel(
            context.issue({name: ASSIGN_LABEL})
          );
        }
      }

      // Allow the label to force a new assignee, even if one is already assigned.
      if (!isLabeled && issuePayload.assignees.length !== 0) {
        context.log.info(
          util.format(
            '[%s/%s] #%s ignored: already has assignee(s)',
            issue.owner,
            issue.repo,
            issue.number
          )
        );
        return;
      }

      const labels = issue.labels?.map(l => l.name);
      const possibleAssignees = findAssignees(assignConfig, labels, false);
      const assignee = randomFrom(possibleAssignees, issuePayload.user.login);
      if (!assignee) {
        context.log.info(
          util.format(
            '[%s/%s] #%s not assigned: no valid assignee(s)',
            issue.owner,
            issue.repo,
            issue.number
          )
        );
        return;
      }

      await context.github.issues.addAssignees(
        context.issue({assignees: [assignee]})
      );
      context.log.info(
        util.format(
          '[%s/%s] #%s was assigned to %s',
          issue.owner,
          issue.repo,
          issue.number,
          assignee
        )
      );
    }
  );
};

function findAssignees(
  config: (string | ByConfig)[],
  labels: string[],
  onlyPreferred: boolean
): string[] {
  let preferredAssignees: string[] = [];
  const fallbackAssignees: string[] = [];
  if (labels) {
    for (const c of config) {
      if (typeof c === 'string') {
        fallbackAssignees.push(c);
      } else {
        for (const b of c.by) {
          for (const l of labels) {
            if (b.labels.includes(l)) {
              preferredAssignees = preferredAssignees.concat(b.to);
            }
          }
        }
      }
    }
  }
  if (preferredAssignees.length || onlyPreferred) {
    return preferredAssignees;
  }
  return fallbackAssignees;
}
