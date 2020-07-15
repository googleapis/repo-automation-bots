// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {Application, Context} from 'probot';
import {GitHubAPI} from 'probot/lib/github';
import {getSLOStatus} from './slo-logic';
import {handle_labeling} from './slo-label';
import {handle_lint} from './slo-lint';

interface IssueLabelResponseItem {
  name: string;
}

function handler(app: Application) {
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.edited',
      'pull_request.synchronize',
    ],
    async (context: Context) => {
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const pullNumber = context.payload.number;
      const labelsResponse = context.payload.pull_request.labels;

      //Checks if config file exists and lint and places check on pr
      await handle_lint(context, owner, repo, pullNumber);
      // Check slo-logic and label issue according to slo status
      const labels = await handler.getIssueLabels(labelsResponse);
      const sloString = await handler.getSloFile(context.github, owner, repo);
      await handler.handle_issues(
        context,
        owner,
        repo,
        'pull_request',
        sloString,
        labels
      );
    }
  );
  app.on(['issues.closed'], async (context: Context) => {
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const issueNumber = context.payload.issue.number;
    const labelsResponse = context.payload.issue.labels;

    const labels = await handler.getIssueLabels(labelsResponse);
    const name = await handle_labeling.getLabelName();
    if (labels?.includes(name)) {
      await handle_labeling.removeIssueLabel(
        context.github,
        owner,
        repo,
        issueNumber,
        name
      );
    }
  });
  app.on(
    [
      'issues.opened',
      'issues.reopened',
      'issues.labeled',
      'issues.unlabeled',
      'issues.edited',
      'issues.assigned',
      'issues.unassigned',
    ],
    async (context: Context) => {
      if (context.payload.issue.state === 'closed') {
        return;
      }
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const labelsResponse = context.payload.issue.labels;

      // Check slo-logic and label issue according to slo status
      const labels = await handler.getIssueLabels(labelsResponse);
      const sloString = await handler.getSloFile(context.github, owner, repo);
      await handler.handle_issues(
        context,
        owner,
        repo,
        'issue',
        sloString,
        labels
      );
    }
  );
}

// Labels OOSLO if issue applies to slo and is not compliant. It also removes OOSLO label if it is compliant
handler.handle_issues = async function handle_issues(
  context: Context,
  owner: string,
  repo: string,
  type: string,
  sloString: string,
  labels: string[] | null
) {
  const sloList = JSON.parse(sloString);

  for (const slo of sloList) {
    const issueNumber = context.payload[type].number;
    const issueCreatedTime = context.payload[type].created_at;
    const assignees = context.payload[type].assignees;

    const sloStatus = await getSLOStatus(
      context.github,
      owner,
      repo,
      issueCreatedTime,
      assignees,
      issueNumber,
      type,
      slo,
      labels
    );

    //Labeling based on slo status for the given issue
    if (sloStatus.appliesTo) {
      await handle_labeling(
        context.github,
        owner,
        repo,
        issueNumber,
        sloStatus,
        labels
      );
    }
  }
};

//Get issue label names from webhook event payload
handler.getIssueLabels = async function getIssueLabels(
  labelsResponse: IssueLabelResponseItem[]
): Promise<string[]> {
  const labels: string[] = [];
  labelsResponse.forEach((label: IssueLabelResponseItem) =>
    labels.push(label.name.toLowerCase())
  );
  return labels;
};

// If the repo level config file does not exist defaults to org config file
handler.getSloFile = async function getSloFile(
  github: GitHubAPI,
  owner: string,
  repo: string
): Promise<string> {
  let path = '.github/issue_slo_rules.json';
  let sloRules: string = await getSLOStatus.getFilePathContent(
    github,
    owner,
    repo,
    path
  );

  if (sloRules === 'not found') {
    path = 'issue_slo_rules.json';
    sloRules = await getSLOStatus.getFilePathContent(
      github,
      owner,
      '.github',
      path
    );
  }
  if (sloRules === 'not found') {
    //Error if org level does not exist
    throw `Error in finding org level config file in ${owner}`;
  }
  return sloRules;
};

export = handler;
