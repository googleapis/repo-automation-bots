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

class OnLabel {
  by_labels: {
    labels: string[];
    to: string[];
  }[] = [];
}

interface Configuration {
  assign_issues?: (string | OnLabel)[];
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
        // Check if the new label has a possible assignee.
        // Don't check all labels to avoid updating an old issue when someone
        // changes a random label.
        const assigneesForNewLabel = assigneesForLabels(assignConfig, [
          context.payload.label.name,
        ]);
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
      const possibleAssignees = assigneesForLabels(assignConfig, labels);
      // If we didn't find a label based assignee, look for a general one.
      if (possibleAssignees.length === 0) {
        for (const a of assignConfig) {
          if (typeof a === 'string') {
            possibleAssignees.push(a);
          }
        }
      }
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

function assigneesForLabels(
  config: (string | OnLabel)[],
  labels: string[]
): string[] {
  let assignees: string[] = [];
  if (labels) {
    for (const a of config) {
      if (typeof a !== 'string') {
        for (const h of a.by_labels) {
          for (const l of labels) {
            if (h.labels.includes(l)) {
              assignees = assignees.concat(h.to);
            }
          }
        }
      }
    }
  }
  return assignees;
}
