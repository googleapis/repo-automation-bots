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

interface Configuration {
  repo: 
  [
    {
    repoName?: string;
    assign_issues?: string[];
    assign_prs?: string[];
    }
  ] 
}

interface Issue {
  owner: string;
  repo: string;
  number: number;
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
    
      const issue = context.issue() as Issue;
      const repoInPayload = context.payload.repository.name;

      if (!config.repo) {
        return
      }

      const repoMatch = config.repo.find(element => element.repoName == repoInPayload);

      if (repoMatch) {
        if ((context.payload.issue && !repoMatch?.assign_issues) || (context.payload.pull_request && !repoMatch?.assign_prs)) {
          const paramName = context.payload.issue
          ? 'assign_issues'
          : 'assign_prs';
        console.log(paramName)
        context.log.info(
          util.format(
            '[%s/%s] #%s ignored: "%s" not in repo-match config',
            issue.owner,
            issue.repo,
            issue.number,
            paramName
          )
        );
        return;
        }
      } else {
        if((context.payload.issue && !config.repo[0].assign_issues) || (context.payload.pull_request && !config.repo[0].assign_prs)) {
            const paramName = context.payload.issue
            ? 'assign_issues'
            : 'assign_prs';
          console.log(paramName)
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
        }
    
        
      const isLabeled = context.payload.action === 'labeled';
      if (isLabeled) {
        if (context.payload.label.name !== ASSIGN_LABEL) {
          context.log.info(
            '[%s/%s] #%s ignored: incorrect label ("%s")',
            issue.owner,
            issue.repo,
            issue.number,
            context.payload.label.name
          );
          return;
        }
        // Remove the label so the user knows the event was processed (even if not successfully).
        await context.github.issues.removeLabel(
          context.issue({name: ASSIGN_LABEL})
        );
      }

      // PRs are a superset of issues, so we can handle them similarly.
  
      let assignees;
      if (repoMatch) {
        assignees = context.payload.issue
        ? repoMatch?.assign_issues!
        : repoMatch?.assign_prs!;
      } else {
        assignees = context.payload.issue
        ? config.repo[0].assign_issues!
        : config.repo[0].assign_prs!;
      }
      
      const issuePayload =
        context.payload.issue || context.payload.pull_request;


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

      const assignee = randomFrom(assignees, issuePayload.user.login);
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
  
}