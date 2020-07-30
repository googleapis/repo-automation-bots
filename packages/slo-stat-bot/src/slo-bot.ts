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

// eslint-disable-next-line node/no-extraneous-import
import {Application, Context, GitHubAPI} from 'probot';
import {logger} from 'gcf-utils';

import {doesSloApply} from './slo-appliesTo';
import {isIssueCompliant, getFilePathContent} from './slo-compliant';
import {removeLabel, handleLabeling} from './slo-label';
import {handleLint} from './slo-lint';
import {IssuesListCommentsItem} from './types';

const CONFIGURATION_FILE_PATH = 'slo-stat-bot.yaml';
const DEFAULT_CONFIGURATION: Config = {
  name: ':rotating_light:',
};

interface Config {
  name: string;
}

interface IssueLabelResponseItem {
  name: string;
}

/**
 * Function handles labeling ooslo based on compliancy if issue applies to the given slo
 * @param context of issue or pr
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param type specifies if event is issue or pr
 * @param sloString json string of the slo rules
 * @param labels on the given issue or pr
 * @param comment login of the user who commented on the pr
 * @param name of OOSLO label in repo
 * @returns void
 */
async function handleIssues(
  context: Context,
  owner: string,
  repo: string,
  type: string,
  sloString: string,
  labels: string[] | null,
  name: string,
  comment?: IssuesListCommentsItem,
) {
  const sloList = JSON.parse(sloString);

  for (const slo of sloList) {
    const number = context.payload[type].number;
    const createdAt = context.payload[type].created_at;
    const assignees = context.payload[type].assignees;

    const appliesToIssue = await doesSloApply(type, slo, labels, number);

    if (appliesToIssue) {
      const isCompliant = await isIssueCompliant(
        context.github,
        owner,
        repo,
        number,
        assignees,
        createdAt,
        slo,
        comment
      );
      await handleLabeling(context, owner, repo, number, isCompliant, labels, name);

      // Keep OOSLO label if issue is not compliant with any one of the slos
      if (!isCompliant) {
        break;
      }
    }
  }
}

/**
 * Function gets ooslo label name in repo from the config file. Defaults to rotating light OOSLO label name if config file does not exist
 * @param context of issue or pr
 * @returns the name of ooslo label
 */
async function getOoSloLabelName(
  context: Context
): Promise<string> {
  try {
    const labelName = (await context.config(CONFIGURATION_FILE_PATH)) as Config;
    return labelName.name;
  } catch (err) {
    logger.warn(
      `Unable to get ooslo name from config-label file \n ${err.message}. \n Using default config for OOSLO label name.`
    );
    return DEFAULT_CONFIGURATION.name;
  }
};

/**
 * Function gets content of slo rules from checking repo config file. If repo config file is missing defaults to org config file
 * @param github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @returns json string of the slo rules
 */
async function getSloFile(
  github: GitHubAPI,
  owner: string,
  repo: string
): Promise<string> {
  let path = '.github/issue_slo_rules.json';
  let sloRules = await getFilePathContent(github, owner, repo, path);

  if (!sloRules) {
    path = 'issue_slo_rules.json';
    sloRules = await getFilePathContent(github, owner, '.github', path);
  }
  if (!sloRules) {
    throw new Error(`Error in finding org level config file in ${owner}`);
  }
  return sloRules;
}

/**
 * Function will run slo logic and handle labeling when issues or pull request event prompted,
 * Deletes ooslo label on closed issues,
 * Lints issue_slo_rules.json on pull request
 * @param app type probot
 * @returns void
 */
export = function handler(app: Application) {
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
      const number = context.payload.number;

      await handleLint(context, owner, repo, number);
    }
  );
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.edited',
      'pull_request.synchronize',
      'pull_request.labeled',
      'pull_request.unlabeled',
      'pull_request.assigned',
      'pull_request.unassigned',
    ],
    async (context: Context) => {
      if (context.payload.pull_request.state === 'closed') {
        return;
      }

      const name = await getOoSloLabelName(context);
      if (context.payload.label?.name === name) {
        return;
      }

      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const labelsResponse = context.payload.pull_request.labels;

      const labels = labelsResponse.map(
        (label: IssueLabelResponseItem) => label.name
      );
      const sloString = await getSloFile(context.github, owner, repo);
      await handleIssues(
        context,
        owner,
        repo,
        'pull_request',
        sloString,
        labels,
        name
      );
    }
  );
  app.on(['issues.closed', 'pull_request.closed'], async (context: Context) => {
    const type = context.payload.issue !== undefined ? 'issue' : 'pull_request';

    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const number = context.payload[type].number;
    const labelsResponse = context.payload[type].labels;

    const labels = labelsResponse.map((label: IssueLabelResponseItem) =>
      label.name
    );

    const name = await getOoSloLabelName(context);
    if (labels?.includes(name)) {
      await removeLabel(context.github, owner, repo, number, name);
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
      'issue_comment.created',
    ],
    async (context: Context) => {
      if (context.payload.issue.state === 'closed') {
        return;
      }

      const name = await getOoSloLabelName(context);
      if (context.payload.label?.name === name) {
        return;
      }

      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const labelsResponse = context.payload.issue.labels;
      const comment = context.payload.issue.comment;

      const labels = labelsResponse.map(
        (label: IssueLabelResponseItem) => label.name
      );
      const sloString = await getSloFile(context.github, owner, repo);
      await handleIssues(
        context,
        owner,
        repo,
        'issue',
        sloString,
        labels,
        name,
        comment
      );
    }
  );
};
