// Copyright 2021 Google LLC
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
import {Octokit} from '@octokit/rest';
import {getAuthenticatedOctokit, getContextLogger} from 'gcf-utils';
import {scanRepoAndOpenIssues} from './core';

const DEFAULT_PRIMARY_BRANCH = 'main';

/**
 * Main function, run on schedule and on PRs, checking validity of .repo-metadata.json.
 */
export function handler(app: Probot) {
  // Nightly cron opens tracking issues for fixing errors in .repo-metadata.json.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('schedule.repository' as any, async context => {
    const logger = getContextLogger(context);
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;
    const branch =
      context.payload.repository.default_branch ?? DEFAULT_PRIMARY_BRANCH;

    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        'Installation ID not provided in schedule.repository event.' +
          ' We cannot authenticate Octokit.'
      );
    }

    await scanRepoAndOpenIssues(octokit, owner, repo, branch, logger);
  });

  // Adds failing check to pull requests if .repo-metadata.json is invalid.
  app.on(['pull_request.opened', 'pull_request.synchronize'], async context => {
    const logger = getContextLogger(context);
    const owner = context.payload.repository.owner.login;
    // const repo = context.payload.repository.name;
    logger.info('pr opened endpoint', owner);
  });
}
