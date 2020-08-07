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
import {IssueAssigneesItem, IssueItem} from './types';

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

interface IssueListForRepoItem {
  number: number;
  user: {
    login: string;
  };
  labels: IssueLabelResponseItem[];
  assignees: IssueAssigneesItem[];
  created_at: string;
  updated_at: string;
  pull_request?: {
    url: string;
  };
}

/**
 * Function handles labeling ooslo based on compliancy if issue applies to the given slo
 * @param github unique installation id for each function
 * @param issueItem is an object that has issue owner, repo, number, type, created time of issue, assignees, labels, and comments
 * @param sloString json string of the slo rules
 * @param labelName of OOSLO label in repo
 * @returns void
 */
async function handleIssues(
  github: GitHubAPI,
  issueItem: IssueItem,
  sloString: string,
  labelName: string
) {
  const sloList = JSON.parse(sloString);

  for (const slo of sloList) {
    const appliesToIssue = await doesSloApply(
      issueItem.type,
      slo,
      issueItem.labels,
      issueItem.number
    );

    if (appliesToIssue) {
      const isCompliant = await isIssueCompliant(github, issueItem, slo);
      await handleLabeling(github, issueItem, isCompliant, labelName);

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
async function getOoSloLabelName(context: Context): Promise<string> {
  try {
    const labelName = (await context.config(CONFIGURATION_FILE_PATH)) as Config;
    return labelName.name;
  } catch (err) {
    logger.warn(
      `Unable to get ooslo name from config-label file \n ${err.message}. \n Using default config for OOSLO label name.`
    );
    return DEFAULT_CONFIGURATION.name;
  }
}

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
    logger.debug(
      `Could not find repo level config file in repo ${repo} for org ${owner}`
    );
    sloRules = await getFilePathContent(github, owner, '.github', path);
  }
  if (!sloRules) {
    logger.warn(`Error in finding org level config file in org ${owner}`);
    return '[]';
  }
  return sloRules;
}

/**
 * Function gets list of open issues from the repository
 * @param github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @returns IssueListForRepoItem which contains issue number, user login, labels, assignees, issue created time, & issue updated time
 */
async function getIssueList(
  github: GitHubAPI,
  owner: string,
  repo: string
): Promise<IssueListForRepoItem[] | null> {
  try {
    const state = 'open';
    const issueList = await github.issues.listForRepo({
      owner,
      repo,
      state,
    });
    return issueList.data;
  } catch (err) {
    err.message = `Error in getting list of issues from repo ${repo}: ${err.message}`;
    logger.error(err);
    return null;
  }
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
      //Igrnores labeling issues that are closed
      if (context.payload.pull_request.state === 'closed') {
        return;
      }

      //Ignores re-computing slo status if OOSLO label was added or removed
      const labelName = await getOoSloLabelName(context);
      if (context.payload.label?.name === labelName) {
        return;
      }

      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const number = context.payload.number;
      const createdAt = context.payload.pull_request.created_at;
      const assignees = context.payload.pull_request.assignees;
      const labelsResponse = context.payload.pull_request.labels;

      const labels = labelsResponse.map(
        (label: IssueLabelResponseItem) => label.name
      );
      const sloString = await getSloFile(context.github, owner, repo);
      const issueItem = {
        owner,
        repo,
        number,
        type: 'pull_request',
        createdAt,
        assignees,
        labels,
      } as IssueItem;

      await handleIssues(context.github, issueItem, sloString, labelName);
    }
  );
  app.on(['issues.closed', 'pull_request.closed'], async (context: Context) => {
    const type = context.payload.issue !== undefined ? 'issue' : 'pull_request';

    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const number = context.payload[type].number;
    const labelsResponse = context.payload[type].labels;

    const labels = labelsResponse.map(
      (label: IssueLabelResponseItem) => label.name
    );

    const labelName = await getOoSloLabelName(context);
    if (labels?.includes(labelName)) {
      await removeLabel(context.github, owner, repo, number, labelName);
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
      //Igrnores labeling issues that are closed
      if (context.payload.issue.state === 'closed') {
        return;
      }

      //Ignores re-computing slo status if OOSLO label was added or removed
      const labelName = await getOoSloLabelName(context);
      if (context.payload.label?.name === labelName) {
        return;
      }

      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const number = context.payload.issue.number;
      const createdAt = context.payload.issue.created_at;
      const assignees = context.payload.issue.assignees;
      const labelsResponse = context.payload.issue.labels;
      const comment = context.payload.issue.comment;

      const labels = labelsResponse.map(
        (label: IssueLabelResponseItem) => label.name
      );
      const sloString = await getSloFile(context.github, owner, repo);
      const issueItem = {
        owner,
        repo,
        number,
        type: 'issue',
        createdAt,
        assignees,
        labels,
        comment,
      } as IssueItem;

      await handleIssues(context.github, issueItem, sloString, labelName);
    }
  );
  app.on(['schedule.repository'], async (context: Context) => {
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;

    const issueList = await getIssueList(context.github, owner, repo);

    if (!issueList) {
      return;
    }

    const sloString = await getSloFile(context.github, owner, repo);
    const labelName = await getOoSloLabelName(context);

    for (const issue of issueList) {
      const number = issue.number;
      const createdAt = issue.created_at;
      const assignees = issue.assignees;

      const labels = issue.labels.map((label: IssueLabelResponseItem) =>
        label.name.toLowerCase()
      );
      const type = issue.pull_request === undefined ? 'issue' : 'pull_request';
      const issueItem = {
        owner,
        repo,
        number,
        type,
        createdAt,
        assignees,
        labels,
      } as IssueItem;

      await handleIssues(context.github, issueItem, sloString, labelName);
    }
  });
};
