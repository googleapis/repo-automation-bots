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

import {Storage} from '@google-cloud/storage';
/* eslint-disable-next-line node/no-extraneous-import */
import {Probot, Context} from 'probot';
import {logger} from 'gcf-utils';
import * as helper from './helper';
import {
  CONFIG_FILE_NAME,
  DEFAULT_CONFIGS,
  LABEL_PRODUCT_BY_DEFAULT,
  DriftRepo,
  DriftApi,
  Label,
  Config,
} from './helper';
import schema from './config-schema.json';
import {Endpoints} from '@octokit/types';
import {
  ConfigChecker,
  getConfigWithDefault,
} from '@google-automations/bot-config-utils';

type IssueResponse = Endpoints['GET /repos/{owner}/{repo}/issues']['response'];

import colorsData from './colors.json';

const storage = new Storage();

handler.getDriftFile = async (file: string) => {
  const bucket = 'devrel-prod-settings';
  const [contents] = await storage.bucket(bucket).file(file).download();
  return contents.toString();
};

handler.getDriftRepos = async () => {
  const jsonData = await handler.getDriftFile('public_repos.json');
  if (!jsonData) {
    logger.error(
      new Error('public_repos.json downloaded from Cloud Storage was empty')
    );
    return null;
  }
  return JSON.parse(jsonData).repos as DriftRepo[];
};

handler.getDriftApis = async () => {
  const jsonData = await handler.getDriftFile('apis.json');
  if (!jsonData) {
    logger.error(
      new Error('apis.json downloaded from Cloud Storage was empty')
    );
    return null;
  }
  return JSON.parse(jsonData).apis as DriftApi[];
};

handler.addLabeltoRepoAndIssue = async function addLabeltoRepoAndIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  issueTitle: string,
  driftRepos: DriftRepo[],
  context: Context
) {
  const driftRepo = driftRepos.find(x => x.repo === `${owner}/${repo}`);
  const res = await context.octokit.issues
    .listLabelsOnIssue({
      owner,
      repo,
      issue_number: issueNumber,
    })
    .catch(logger.error);
  const labelsOnIssue = res ? res.data : undefined;
  let wasNotAdded = true;
  let autoDetectedLabel: string | undefined;

  if (!driftRepo?.github_label) {
    logger.info(
      `There was no configured match for the repo ${repo}, trying to auto-detect the right label`
    );
    const apis = await handler.getDriftApis();
    autoDetectedLabel = helper.autoDetectLabel(apis, issueTitle);
  }
  const index = driftRepos?.findIndex(r => driftRepo === r) % colorsData.length;
  const colorNumber = index >= 0 ? index : 0;
  const githubLabel = driftRepo?.github_label || autoDetectedLabel;

  if (githubLabel) {
    try {
      await context.octokit.issues.createLabel({
        owner,
        repo,
        name: githubLabel,
        color: colorsData[colorNumber].color,
      });
      logger.info(`Label added to ${owner}/${repo} is ${githubLabel}`);
    } catch (e) {
      // HTTP 422 means the label already exists on the repo
      if (e.status !== 422) {
        e.message = `Error creating label: ${e.message}`;
        logger.error(e);
      }
    }
    if (labelsOnIssue) {
      const foundAPIName = helper.labelExists(labelsOnIssue, githubLabel);

      const cleanUpOtherLabels = labelsOnIssue.filter(
        (element: Label) =>
          element.name.startsWith('api') &&
          element.name !== foundAPIName?.name &&
          element.name !== autoDetectedLabel
      );
      if (!foundAPIName) {
        await context.octokit.issues
          .addLabels({
            owner,
            repo,
            issue_number: issueNumber,
            labels: [githubLabel],
          })
          .catch(logger.error);
        logger.info(
          `Label added to ${owner}/${repo} for issue ${issueNumber} is ${githubLabel}`
        );
        wasNotAdded = false;
      }
      for (const dirtyLabel of cleanUpOtherLabels) {
        await context.octokit.issues
          .removeLabel({
            owner,
            repo,
            issue_number: issueNumber,
            name: dirtyLabel.name,
          })
          .catch(logger.error);
      }
    } else {
      await context.octokit.issues
        .addLabels({
          owner,
          repo,
          issue_number: issueNumber,
          labels: [githubLabel],
        })
        .catch(logger.error);
      logger.info(
        `Label added to ${owner}/${repo} for issue ${issueNumber} is ${githubLabel}`
      );
      wasNotAdded = false;
    }
  }

  let foundSamplesTag: Label | undefined;
  if (labelsOnIssue) {
    foundSamplesTag = labelsOnIssue.find(e => e.name === 'samples');
  }
  const isSampleIssue =
    repo.includes('samples') || issueTitle?.includes('sample');
  if (!foundSamplesTag && isSampleIssue) {
    await context.octokit.issues
      .createLabel({
        owner,
        repo,
        name: 'samples',
        color: colorsData[colorNumber].color,
      })
      .catch(logger.error);
    await context.octokit.issues
      .addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels: ['samples'],
      })
      .catch(logger.error);
    logger.info(
      `Issue ${issueNumber} is in a samples repo but does not have a sample tag, adding it to the repo and issue`
    );
    wasNotAdded = false;
  }

  return wasNotAdded;
};

// Main job for PRs.
handler.autoLabelOnPR = async function autoLabelOnPR(
  context: Context,
  owner: string,
  repo: string,
  config: Config
) {
  if (config?.enabled === false) {
    logger.info(`Skipping for ${owner}/${repo}`);
    return;
  }
  const pull_number = context.payload.pull_request.number;

  if (config?.product) {
    const driftRepos = await handler.getDriftRepos();
    if (!driftRepos) {
      return;
    }
    await handler.addLabeltoRepoAndIssue(
      owner,
      repo,
      pull_number,
      context.payload.pull_request.title,
      driftRepos,
      context
    );
  }

  // Only need to fetch PR contents if config.path or config.language are configured.
  if (!config?.path?.pullrequest && !config?.language?.pullrequest) {
    return;
  }

  const filesChanged = await context.octokit.pulls.listFiles({
    owner,
    repo,
    pull_number,
  });
  const labels = context.payload.pull_request.labels;

  // If user has turned on path labels by configuring {path: {pullrequest: false, }}
  // By default, this feature is turned off
  if (config.path?.pullrequest) {
    logger.info(`Labeling path in PR #${pull_number} in ${owner}/${repo}...`);
    const path_label = helper.getLabel(filesChanged.data, config.path, 'path');
    if (path_label && !helper.labelExists(labels, path_label)) {
      logger.info(
        `Path label added to PR #${pull_number} in ${owner}/${repo} is ${path_label}`
      );
      await context.octokit.issues.addLabels({
        owner,
        repo,
        issue_number: pull_number,
        labels: [path_label],
      });
    }
  }

  // If user has turned on language labels by configuring {language: {pullrequest: false,}}
  // By default, this feature is turned off
  if (config.language?.pullrequest) {
    logger.info(
      `Labeling language in PR #${pull_number} in ${owner}/${repo}...`
    );
    const language_label = helper.getLabel(
      filesChanged.data,
      config.language,
      'language'
    );
    if (language_label && !helper.labelExists(labels, language_label)) {
      logger.info(
        `Language label added to PR #${pull_number} in ${owner}/${repo} is ${language_label}`
      );
      await context.octokit.issues.addLabels({
        owner,
        repo,
        issue_number: pull_number,
        labels: [language_label],
      });
    }
  }
};

/**
 * Main function, responds to label being added
 */
export function handler(app: Probot) {
  // Nightly cron that backfills and corrects api labels
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('schedule.repository' as '*', async context => {
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;
    const config = await getConfigWithDefault<Config>(
      context.octokit,
      owner,
      repo,
      CONFIG_FILE_NAME,
      DEFAULT_CONFIGS
    );

    if (!config?.product || config?.enabled === false) {
      logger.info(`Skipping for ${owner}/${repo}`);
      return;
    }

    logger.info(`running for org ${context.payload.cron_org}`);
    if (context.payload.cron_org !== owner) {
      logger.info(`skipping run for ${context.payload.cron_org}`);
      return;
    }
    const driftRepos = await handler.getDriftRepos();
    if (!driftRepos) {
      return;
    }
    //all the issues in the repository
    const issues = context.octokit.issues.listForRepo.endpoint.merge({
      owner,
      repo,
    });
    let labelWasNotAddedCount = 0;
    //goes through issues in repository, adds labels as necessary
    for await (const response of context.octokit.paginate.iterator(issues)) {
      const issues = response.data as IssueResponse['data'];
      for (const issue of issues) {
        const wasNotAdded = await handler.addLabeltoRepoAndIssue(
          owner,
          repo,
          issue.number,
          issue.title,
          driftRepos,
          context
        );
        if (wasNotAdded) {
          logger.info(
            `label for ${issue.number} in ${owner}/${repo} was not added`
          );
          labelWasNotAddedCount++;
        }
        if (labelWasNotAddedCount > 5) {
          logger.info(
            `${
              owner / repo
            } has 5 issues where labels were not added; skipping the rest of this repo check.`
          );
          return;
        }
      }
    }
  });

  // Labels issues with product labels.
  // By default, this is turned on without user configuration.
  app.on(['issues.opened', 'issues.reopened'], async context => {
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const config = await getConfigWithDefault<Config>(
      context.octokit,
      owner,
      repo,
      CONFIG_FILE_NAME,
      DEFAULT_CONFIGS
    );
    const issueNumber = context.payload.issue.number;

    if (!config?.product || config?.enabled === false) {
      logger.info(`Skipping for ${owner}/${repo}`);
      return;
    }

    const driftRepos = await handler.getDriftRepos();
    if (!driftRepos) {
      return;
    }
    await handler.addLabeltoRepoAndIssue(
      owner,
      repo,
      issueNumber,
      context.payload.issue.title,
      driftRepos,
      context
    );
  });

  // Labels pull requests with product, language, and/or path labels.
  // By default, product labels are turned on and language/path labels are
  // turned off.
  app.on(['pull_request.opened', 'pull_request.synchronize'], async context => {
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    // First check the config schema for PR.
    const configChecker = new ConfigChecker<Config>(schema, CONFIG_FILE_NAME);
    await configChecker.validateConfigChanges(
      context.octokit,
      owner,
      repo,
      context.payload.pull_request.head.sha,
      context.payload.pull_request.number
    );
    // For the auto label main logic, synchronize event is irrelevant.
    if (context.payload.action === 'synchronize') {
      return;
    }

    const config = await getConfigWithDefault<Config>(
      context.octokit,
      owner,
      repo,
      CONFIG_FILE_NAME,
      DEFAULT_CONFIGS
    );

    await handler.autoLabelOnPR(context, owner, repo, config);
  });

  app.on(['installation.created'], async context => {
    const repositories = context.payload.repositories;
    const driftRepos = await handler.getDriftRepos();
    if (!LABEL_PRODUCT_BY_DEFAULT) return;
    if (!driftRepos) return;

    for await (const repository of repositories) {
      const [owner, repo] = repository.full_name.split('/');

      const config = await getConfigWithDefault<Config>(
        context.octokit,
        owner,
        repo,
        CONFIG_FILE_NAME,
        DEFAULT_CONFIGS
      );
      if (!config?.product) {
        break;
      }

      // goes through issues in repository, adds labels as necessary
      for await (const response of context.octokit.paginate.iterator(
        context.octokit.issues.listForRepo,
        {
          owner,
          repo,
        }
      )) {
        const issues = response.data;
        // goes through each issue in each page
        for (const issue of issues) {
          await handler.addLabeltoRepoAndIssue(
            owner,
            repo,
            issue.number,
            issue.title,
            driftRepos,
            context
          );
        }
      }
    }
  });
}
