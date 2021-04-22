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
import Webhooks from '@octokit/webhooks';
import {logger} from 'gcf-utils';

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
    async (
      context: Context<Webhooks.EventPayloads.WebhookPayloadPullRequest>
    ) => {
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
          await context.octokit.checks.update({
            conclusion: 'success',
            check_run_id: existingCheck.id,
            owner,
            repo,
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
          await context.octokit.checks.update({
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
      await context.octokit.checks.create({
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
};

async function findCheck(
  context: Context<Webhooks.EventPayloads.WebhookPayloadPullRequest>,
  owner: string,
  repo: string,
  sha: string
): Promise<{id: number; conclusion: string} | undefined> {
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
