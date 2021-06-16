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

/* eslint-disable-next-line node/no-extraneous-import */
import {Probot} from 'probot';
import {logger} from 'gcf-utils';
import {autoLabelOnIssue, autoLabelOnPR} from './helper';
import {
  CONFIG_FILE_NAME,
  DEFAULT_CONFIGS,
  LABEL_PRODUCT_BY_DEFAULT,
  Config,
} from './helper';
import schema from './config-schema.json';
import {Endpoints} from '@octokit/types';
import {
  ConfigChecker,
  getConfigWithDefault,
} from '@google-automations/bot-config-utils';

type IssueResponse = Endpoints['GET /repos/{owner}/{repo}/issues']['response'];

import {getDriftRepo} from './drift';

/**
 * Main function, responds to label being added
 */
export = (app: Probot) => {
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
      DEFAULT_CONFIGS,
      {schema: schema}
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

    const driftRepo = await getDriftRepo(owner, repo);

    // all the issues in the repository
    const issues = context.octokit.issues.listForRepo.endpoint.merge({
      owner,
      repo,
    });
    let labelWasNotAddedCount = 0;
    //goes through issues in repository, adds labels as necessary
    for await (const response of context.octokit.paginate.iterator(issues)) {
      const issues = response.data as IssueResponse['data'];
      for (const issue of issues) {
        const wasNotAdded = await autoLabelOnIssue(
          context.octokit,
          owner,
          repo,
          issue.number,
          issue.title,
          config,
          driftRepo
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
      DEFAULT_CONFIGS,
      {schema: schema}
    );
    const issueNumber = context.payload.issue.number;
    const issueTitle = context.payload.issue.title;
    const driftRepo = await getDriftRepo(owner, repo);

    await autoLabelOnIssue(
      context.octokit,
      owner,
      repo,
      issueNumber,
      issueTitle,
      config,
      driftRepo
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
      DEFAULT_CONFIGS,
      {schema: schema}
    );
    const prNumber = context.payload.pull_request.number;
    const prTitle = context.payload.pull_request.title;

    await autoLabelOnPR(
      context.octokit,
      owner,
      repo,
      prNumber,
      prTitle,
      config
    );
  });

  app.on(['installation.created'], async context => {
    const repositories = context.payload.repositories;
    if (!LABEL_PRODUCT_BY_DEFAULT) return;

    for await (const repository of repositories) {
      const [owner, repo] = repository.full_name.split('/');

      const config = await getConfigWithDefault<Config>(
        context.octokit,
        owner,
        repo,
        CONFIG_FILE_NAME,
        DEFAULT_CONFIGS,
        {schema: schema}
      );
      if (!config?.product) {
        break;
      }

      const driftRepo = await getDriftRepo(owner, repo);

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
          await autoLabelOnIssue(
            context.octokit,
            owner,
            repo,
            issue.number,
            issue.title,
            config,
            driftRepo
          );
        }
      }
    }
  });
};
