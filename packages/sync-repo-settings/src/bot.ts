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
import {operations} from '@octokit/openapi-types';
import {SyncRepoSettings} from './sync-repo-settings';
import {configFileName, getConfig, validateConfig} from './config';

type PullsListFilesResponseData = operations['pulls/list-files']['responses']['200']['content']['application/json'];

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | undefined;

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
    async (context: Context) => {
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const number = context.payload.number;
      let files: PullsListFilesResponseData;
      try {
        files = await context.octokit.paginate(
          context.octokit.pulls.listFiles.endpoint.merge({
            owner,
            repo,
            pull_number: number,
            per_page: 100,
          })
        );
      } catch (e) {
        e.message = `Error fetching files for PR ${owner}/${repo}#${number}\n\n${e.message}`;
        logger.error(e);
        return;
      }
      for (const file of files) {
        if (
          file.status === 'deleted' ||
          (file.filename !== `.github/${configFileName}` &&
            (repo !== '.github' || file.filename !== configFileName))
        ) {
          continue;
        }
        const blob = await context.octokit.git.getBlob({
          owner,
          repo,
          file_sha: file.sha,
        });
        const configYaml = Buffer.from(blob.data.content, 'base64').toString(
          'utf8'
        );
        const {errorText, isValid} = await validateConfig(configYaml);
        const checkParams = context.repo({
          name: 'sync-repo-settings-check',
          head_sha: context.payload.pull_request.head.sha,
          conclusion: 'success' as Conclusion,
          output: {
            title: `Successful ${configFileName} check`,
            summary: `${configFileName} matches the required schema`,
            text: 'Success',
          },
        });
        if (!isValid) {
          (checkParams.conclusion = 'failure'),
            (checkParams.output = {
              title: `Invalid ${configFileName} schema 😱`,
              summary: `${configFileName} does not match the required schema 😱`,
              text: errorText,
            });
        }
        try {
          await context.octokit.checks.create(checkParams);
        } catch (e) {
          e.message = `Error creating validation status check: ${e.message}`;
          logger.error(e);
        }
      }
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
    if (branch !== `refs/head/${defaultBranch}`) {
      return;
    }
    // Look at all commits, and all files changed during those commits.
    // If they contain a `sync-repo-settings.yaml`, re-sync the repo.
    function includesConfig() {
      const fileChangedLists = ['added', 'modified', 'removed'];
      for (const commit of context.payload.commits) {
        for (const list of fileChangedLists) {
          if (commit[list]) {
            for (const file of commit[list]) {
              if (file?.includes(configFileName)) {
                return true;
              }
            }
          }
        }
      }
      return false;
    }
    if (!includesConfig()) {
      return;
    }

    const owner = context.payload.organization?.login;
    const name = context.payload.repository.name;
    const config = await getConfig({
      octokit: context.octokit,
      owner: context.repo().owner,
      repo: context.repo().repo,
    });
    const repoSettings = new SyncRepoSettings(context.octokit, logger);
    await repoSettings.syncRepoSettings({
      repo: `${owner}/${name}`,
      config: config!,
    });
  });

  // meta comment about the '*' here: https://github.com/octokit/webhooks.js/issues/277
  app.on(['schedule.repository' as '*'], async (context: Context) => {
    logger.info(`running for org ${context.payload.cron_org}`);
    const owner = context.payload.organization.login;
    const name = context.payload.repository.name;

    if (context.payload.cron_org !== owner) {
      logger.info(`skipping run for ${context.payload.cron_org}`);
      return;
    }

    const config = await getConfig({
      octokit: context.octokit,
      owner: context.repo().owner,
      repo: context.repo().repo,
    });
    const repoSettings = new SyncRepoSettings(context.octokit, logger);
    await repoSettings.syncRepoSettings({
      repo: `${owner}/${name}`,
      config: config!,
    });
  });
}
