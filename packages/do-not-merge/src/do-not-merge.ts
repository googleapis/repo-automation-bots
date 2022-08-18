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

/* eslint-disable node/no-extraneous-import */

import {Probot, Context} from 'probot';
import {Octokit} from '@octokit/rest';
import {getAuthenticatedOctokit, getContextLogger} from 'gcf-utils';
import {
  ConfigChecker,
  getConfigWithDefault,
} from '@google-automations/bot-config-utils';
import {
  ConfigurationOptions,
  CONFIGURATION_FILE_PATH,
  DEFAULT_CONFIGURATION,
} from './configuration';
import schema from './config-schema.json';

const DO_NOT_MERGE = 'do not merge';
const DO_NOT_MERGE_2 = 'do-not-merge';
const CHECK_NAME = 'Do Not Merge';

const FAILURE_OUTPUT = {
  title: 'Remove the do not merge label before merging',
  summary: 'Remove the do not merge label before merging',
};

const SUCCESS_OUTPUT = {
  title: 'OK to merge, label not found',
  summary: 'OK to merge, label not found',
};

export = (app: Probot) => {
  app.on(
    [
      'pull_request.labeled',
      'pull_request.unlabeled',
      'pull_request.synchronize', // To run the check on every commit.
    ],
    async (context: Context<'pull_request'>) => {
      const logger = getContextLogger(context);
      let octokit: Octokit;
      if (context.payload.installation && context.payload.installation.id) {
        octokit = await getAuthenticatedOctokit(
          context.payload.installation.id
        );
      } else {
        throw new Error(
          `Installation ID not provided in ${context.payload.action} event.` +
            ' We cannot authenticate Octokit.'
        );
      }
      if (context.payload.pull_request.state === 'closed') {
        logger.info(
          `The pull request ${context.payload.pull_request.url} is closed, exiting.`
        );
        return;
      }

      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const sha = context.payload.pull_request.head.sha;

      const labelFound = context.payload.pull_request.labels.find(
        l => l.name === DO_NOT_MERGE || l.name === DO_NOT_MERGE_2
      );

      let config = DEFAULT_CONFIGURATION;
      try {
        config = await getConfigWithDefault<ConfigurationOptions>(
          octokit,
          owner,
          repo,
          CONFIGURATION_FILE_PATH,
          DEFAULT_CONFIGURATION
        );
      } catch (err) {
        logger.error(err as Error);
      }

      const existingCheck = await findCheck(context, owner, repo, sha);

      if (!labelFound) {
        logger.info(
          `Do not merge label not found on ${context.payload.pull_request.url}`
        );
        // If the check already exists, but it's not a success, make it a success.
        if (existingCheck && existingCheck.conclusion !== 'success') {
          logger.info(
            `Updating check on ${context.payload.pull_request.url} to success`
          );
          await octokit.checks.update({
            conclusion: 'success',
            check_run_id: existingCheck.id,
            owner,
            repo,
            output: SUCCESS_OUTPUT,
          });
        } else if (config.alwaysCreateStatusCheck) {
          await octokit.checks.create({
            conclusion: 'success',
            name: CHECK_NAME,
            owner,
            repo,
            head_sha: sha,
            output: SUCCESS_OUTPUT,
          });
        }
        return;
      }
      if (existingCheck) {
        // If the check already exists and is _not_ a failure, make it a failure.
        if (existingCheck.conclusion !== 'failure') {
          logger.info(
            `Updating check on ${context.payload.pull_request.url} to failure`
          );
          await octokit.checks.update({
            conclusion: 'failure',
            check_run_id: existingCheck.id,
            owner,
            repo,
            output: FAILURE_OUTPUT,
          });
        } else {
          logger.info(
            `Check on ${context.payload.pull_request.url} is already failure`
          );
        }
        // Already checked!
        return;
      }

      logger.info(
        `Creating failed check on ${context.payload.pull_request.url}`
      );
      await octokit.checks.create({
        conclusion: 'failure',
        name: CHECK_NAME,
        owner,
        repo,
        head_sha: sha,
        output: FAILURE_OUTPUT,
      });
      logger.metric('do_not_merge.add_label');
    }
  );

  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.edited',
      'pull_request.synchronize',
    ],
    async context => {
      const logger = getContextLogger(context);
      let octokit: Octokit;
      if (context.payload.installation && context.payload.installation.id) {
        octokit = await getAuthenticatedOctokit(
          context.payload.installation.id
        );
      } else {
        throw new Error(
          `Installation ID not provided in ${context.payload.action} event.` +
            ' We cannot authenticate Octokit.'
        );
      }
      // Exit if the PR is closed.
      if (context.payload.pull_request.state === 'closed') {
        logger.info(
          `The pull request ${context.payload.pull_request.url} is closed, exiting.`
        );
        return;
      }
      // If the head repo is null, we can not proceed.
      if (
        context.payload.pull_request.head.repo === undefined ||
        context.payload.pull_request.head.repo === null
      ) {
        logger.info(
          `The head repo is undefined for ${context.payload.pull_request.url}, exiting.`
        );
        return;
      }
      const {owner, repo} = context.repo();

      // We should first check the config schema. Otherwise, we'll miss
      // the opportunity for checking the schema when adding the config
      // file for the first time.
      const configChecker = new ConfigChecker<ConfigurationOptions>(
        schema,
        CONFIGURATION_FILE_PATH
      );
      await configChecker.validateConfigChanges(
        octokit,
        owner,
        repo,
        context.payload.pull_request.head.sha,
        context.payload.pull_request.number
      );
    }
  );
};

async function findCheck(
  context: Context<'pull_request'>,
  owner: string,
  repo: string,
  sha: string
): Promise<{id: number; conclusion: string | null} | undefined> {
  const checks = (
    await context.octokit.checks.listForRef({
      owner,
      repo,
      check_name: CHECK_NAME,
      filter: 'latest',
      ref: sha,
    })
  ).data;
  return checks.check_runs?.length ? checks.check_runs[0] : undefined;
}
