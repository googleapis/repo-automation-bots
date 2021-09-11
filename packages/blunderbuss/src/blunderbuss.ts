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
import {logger} from 'gcf-utils';
import {DatastoreLock} from '@google-automations/datastore-lock';
import {
  ConfigChecker,
  getConfigWithDefault,
} from '@google-automations/bot-config-utils';
import {syncLabels} from '@google-automations/label-utils';
import schema from './config-schema.json';
import {CONFIGURATION_FILE_PATH, Configuration} from './config';
import {BLUNDERBUSS_LABELS, assign, isIssue} from './utils';

export = (app: Probot) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('schedule.repository' as any, async context => {
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;
    await syncLabels(context.octokit, owner, repo, BLUNDERBUSS_LABELS);
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
    ],
    async (context: Context<'issues'> | Context<'pull_request'>) => {
      const {owner, repo} = context.repo();
      // First check the config schema for pull requests.
      if (!isIssue(context.payload)) {
        if (
          context.payload.pull_request &&
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
            context.octokit,
            owner,
            repo,
            context.payload.pull_request.head.sha,
            context.payload.pull_request.number
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
          context.octokit,
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

      let lockTarget: string;
      if (isIssue(context.payload)) {
        lockTarget = context.payload.issue.url;
      } else {
        lockTarget = context.payload.pull_request.url;
      }

      // Acquire the lock.
      const lock = new DatastoreLock('blunderbuss', lockTarget);
      const lockResult = await lock.acquire();
      if (!lockResult) {
        throw new Error('Failed to acquire a lock for ${lockTarget}');
      }

      try {
        await assign(context, config);
      } finally {
        lock.release();
      }
    }
  );
};
