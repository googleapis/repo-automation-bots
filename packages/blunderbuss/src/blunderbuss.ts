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
import {Probot, Context} from 'probot';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {DatastoreLock} from '@google-automations/datastore-lock';
import {
  ConfigChecker,
  getConfigWithDefault,
} from '@google-automations/bot-config-utils';
import {syncLabels} from '@google-automations/label-utils';
import schema from './config-schema.json';
import {CONFIGURATION_FILE_PATH, Configuration} from './config';
import {BLUNDERBUSS_LABELS, assign, isIssue} from './utils';
import {getAuthenticatedOctokit, getContextLogger} from 'gcf-utils';
import {IssuesEvent, PullRequestEvent} from '@octokit/webhooks-types/schema';

export = (app: Probot) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('schedule.repository' as any, async context => {
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;
    let octokit: Octokit;
    if (context.payload.installation && context.payload.installation.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        'Installation ID not provided in schedule.repository event.' +
          ' We cannot authenticate Octokit.'
      );
    }
    await syncLabels(octokit, owner, repo, BLUNDERBUSS_LABELS);
  });
  app.on(
    [
      'issues.opened',
      'issues.reopened',
      'issues.labeled',
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.edited',
      'pull_request.labeled',
      'pull_request.synchronize',
      'pull_request.ready_for_review'
    ],
    async (context: Context<'issues'> | Context<'pull_request'>) => {
      const logger = getContextLogger(context);
      const {owner, repo} = context.repo();

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
      // First check the config schema for pull requests.
      if (!isIssue(context.payload as IssuesEvent | PullRequestEvent)) {
        if (
          (context.payload as PullRequestEvent).pull_request &&
          (context.payload.action === 'opened' ||
            context.payload.action === 'reopened' ||
            context.payload.action === 'synchronize')
        ) {
          const configChecker = new ConfigChecker<Configuration>(
            schema,
            CONFIGURATION_FILE_PATH
          );
          const {owner, repo} = context.repo();
          await configChecker.validateConfigChanges(
            octokit,
            owner,
            repo,
            (context.payload as PullRequestEvent).pull_request.head.sha,
            (context.payload as PullRequestEvent).pull_request.number
          );
        }
        // For the blunderbuss main logic, synchronize event is irrelevant.
        if (context.payload.action === 'synchronize') {
          return;
        }
      }
      let config: Configuration = {};
      try {
        // Reading the config requires access to code permissions, which are not
        // always available for private repositories.
        config = await getConfigWithDefault<Configuration>(
          octokit,
          owner,
          repo,
          CONFIGURATION_FILE_PATH,
          {},
          {schema: schema}
        );
      } catch (e) {
        const err = e as Error;
        err.message = `Error reading configuration: ${err.message}`;
        logger.error(err);
        return;
      }

      let url: string;
      let user: string;

      if (isIssue(context.payload as IssuesEvent | PullRequestEvent)) {
        url = (context.payload as IssuesEvent).issue.url;
        user = (context.payload as IssuesEvent).issue.user.login;
      } else {
        url = (context.payload as PullRequestEvent).pull_request.url;
        user = (context.payload as PullRequestEvent).pull_request.user.login;
      }

      if (config.ignore_authors?.includes(user)) {
        logger.info(
          `Skipping ${url} because ${user} is on the ignore_authors list.`
        );
        return;
      }

      // Acquire the lock.
      const lock = new DatastoreLock('blunderbuss', url);
      const lockResult = await lock.acquire();
      if (!lockResult) {
        throw new Error('Failed to acquire a lock for ${lockTarget}');
      }

      try {
        await assign(context, config, logger);
      } finally {
        await lock.release();
      }
    }
  );
};
