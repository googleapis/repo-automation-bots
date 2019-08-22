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

import {Application} from 'probot';
import * as util from 'util';

const CONFIGURATION_FILE_PATH = 'blunderbuss.yml';

interface Configuration {
  assign_issues?: string[];
  assign_prs?: string[];
}

interface Repository {
  owner: string;
  repo: string;
}

// Returns a random item from an array
function randomFrom(items: string[]): string {
  return items[Math.floor(Math.random() * items.length)]
}

export = (app: Application) => {
  app.on(['issues.opened', 'issues.reopened'], async context => {
    const repo = context.repo() as Repository;
    const config = await context.config(CONFIGURATION_FILE_PATH) as Configuration;

    if (!config.assign_issues) {
      context.log.info(util.format('[%s/%s] issue #%s ignored: not configured', repo.owner, repo.repo, context.payload.issue.number));
      return;
    }

    if (context.payload.issue.assignees.length !== 0) {
      context.log.info(util.format('[%s/%s] issue #%s ignored: already has assignee(s)', repo.owner, repo.repo, context.payload.issue.number));
      return;
    }

    const assignee = randomFrom(config.assign_issues);
    const result = await context.github.issues.addAssignees(context.issue({assignees: [assignee]}));
    context.log.info(util.format('[%s/%s] issue #%s assigned to %s', repo.owner, repo.repo, context.payload.issue.number, assignee));
  });
};
