/**
 * Copyright 2019 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Application, Context} from 'probot';
import * as util from 'util';

const CONFIGURATION_FILE_PATH = 'blunderbuss.yml';

interface Configuration {
  assign_issues?: string[];
  assign_prs?: string[];
}

interface Issue {
  owner: string;
  repo: string;
  number: number;
}

// Randomly returns an item from an array, while ignoring the provided value.
// Returns an empty string if no values remain.
function randomFrom(items: string[], ignore: string): string {
  const unique = new Set(items);
  unique.delete(ignore);
  items = [...unique];
  if (items.length == 0) {
    return '';
  }
  return items[Math.floor(Math.random() * items.length)]
}

async function assignRandomly(context: Context, user: string, isAssigned: boolean, assignees: string[]) {
  const issue = context.issue() as Issue;

  if (isAssigned) {
    context.log.info(util.format('[%s/%s] #%s ignored: already has assignee(s)', issue.owner, issue.repo, issue.number));
    return;
  }

  const assignee = randomFrom(assignees, user);
  if (assignee === '') {
    context.log.info(util.format('[%s/%s] #%s ignored: no valid assignee(s)', issue.owner, issue.repo, issue.number));
    return;
  }

  const response = await context.github.issues.addAssignees(context.issue({assignees: [assignee]}));
  context.log.info(util.format('[%s/%s] #%s was assigned to %s', issue.owner, issue.repo, issue.number, assignee));
}

export = (app: Application) => {
  app.on(['issues.opened', 'issues.reopened'], async context => {
    const config = await context.config(CONFIGURATION_FILE_PATH) as Configuration;

    if (!config.assign_issues) {
      const issue = context.issue() as Issue;
      context.log.info(util.format('[%s/%s] #%s ignored: "assign_issues" not in config', issue.owner, issue.repo, issue.number));
      return;
    }

    const isAssigned = context.payload.issue.assignees.length !== 0;
    await assignRandomly(context, context.payload.issue.user.login, isAssigned, config.assign_issues)
  });

  app.on(['pull_request.opened', 'pull_request.reopened'], async context => {
    const config = await context.config(CONFIGURATION_FILE_PATH) as Configuration;

    if (!config.assign_prs) {
      const issue = context.issue() as Issue;
      context.log.info(util.format('[%s/%s] #%s ignored: "assign_prs" not in config', issue.owner, issue.repo, issue.number));
      return;
    }

    const isAssigned = context.payload.pull_request.assignees.length !== 0;
    await assignRandomly(context, context.payload.pull_request.user.login, isAssigned, config.assign_prs)
  });
};
