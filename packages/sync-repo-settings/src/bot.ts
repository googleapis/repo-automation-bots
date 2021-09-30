// Copyright 2020 Google LLC
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
import {ConfigChecker, getConfig} from '@google-automations/bot-config-utils';

import {SyncRepoSettings} from './sync-repo-settings';
import {RepoConfig} from './types';
import schema from './schema.json';
import {CONFIG_FILE_NAME} from './config';

/**
 * Main.  On a nightly cron, update the settings for a given repository.
 */
export function handler(app: Probot) {
  // Lint any pull requests that touch configuration
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.synchronize',
    ],
    async (context: Context<'pull_request'>) => {
      const configChecker = new ConfigChecker<RepoConfig>(
        schema,
        CONFIG_FILE_NAME
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
  );

  /**
   * On pushes to the default branch, check to see if the
   * .github/sync-repo-settings.yaml file was included.
   * If so, run the settings sync for that repo.
   */
  app.on('push', async context => {
    const branch = context.payload.ref;
    const defaultBranch = context.payload.repository.default_branch;
    if (branch !== `refs/heads/${defaultBranch}`) {
      logger.info(`skipping non-default branch: ${branch}`);
      return;
    }
    // Look at all commits, and all files changed during those commits.
    // If they contain a `sync-repo-settings.yaml`, re-sync the repo.
    function includesConfig() {
      for (const commit of context.payload.commits) {
        for (const files of [commit.added, commit.modified, commit.removed]) {
          if (files === undefined) {
            continue;
          }
          for (const file of files) {
            if (file?.includes(CONFIG_FILE_NAME)) {
              return true;
            }
          }
        }
      }
      return false;
    }
    if (!includesConfig()) {
      logger.info('skipping push that does not modify config');
      logger.debug(context.payload.commits);
      return;
    }

    const {owner, repo} = context.repo();
    const config = await getConfig<RepoConfig>(
      context.octokit,
      owner,
      repo,
      CONFIG_FILE_NAME,
      {fallbackToOrgConfig: false, schema: schema}
    );
    const repoSettings = new SyncRepoSettings(context.octokit, logger);
    await repoSettings.syncRepoSettings({
      repo: `${owner}/${repo}`,
      config: config || undefined,
      defaultBranch: repo.default_branch,
    });
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on(['schedule.repository' as any], async context => {
    logger.info(`running for org ${context.payload.cron_org}`);
    const {owner, repo} = context.repo();
    if (context.payload.cron_org !== owner) {
      logger.info(`skipping run for ${context.payload.cron_org}`);
      return;
    }

    const config = await getConfig<RepoConfig>(
      context.octokit,
      owner,
      repo,
      CONFIG_FILE_NAME,
      {fallbackToOrgConfig: false, schema: schema}
    );

    const repoSettings = new SyncRepoSettings(context.octokit, logger);
    await repoSettings.syncRepoSettings({
      repo: `${owner}/${repo}`,
      config: config || undefined,
    });
  });

  app.on('repository.transferred', async context => {
    const {owner, repo} = context.repo();
    const config = await getConfig<RepoConfig>(
      context.octokit,
      owner,
      repo,
      CONFIG_FILE_NAME,
      {fallbackToOrgConfig: false, schema: schema}
    );
    const repoSettings = new SyncRepoSettings(context.octokit, logger);
    await repoSettings.syncRepoSettings({
      repo: `${owner}/${repo}`,
      config: config || undefined,
      defaultBranch: repo.default_branch,
    });
  });
}
