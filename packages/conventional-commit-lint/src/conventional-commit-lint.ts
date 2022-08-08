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

import {
  getConfigWithDefault,
  ConfigChecker,
} from '@google-automations/bot-config-utils';

// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
import {PullRequest} from '@octokit/webhooks-types';

import {getContextLogger} from 'gcf-utils';

import schema from './schema.json';
import {scanPullRequest} from './utils';

const CONFIGURATION_FILE = 'conventional-commit-lint.yaml';
interface Configuration {
  enabled?: boolean;
}

export = (app: Probot) => {
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.edited',
      'pull_request.synchronize',
      'pull_request.labeled',
    ],
    async context => {
      const {owner, repo} = context.repo();
      const logger = getContextLogger(context);
      // Exit if the PR is closed.
      if (context.payload.pull_request.state === 'closed') {
        logger.info(
          `The pull request ${context.payload.pull_request.url} is closed, exiting.`
        );
        return;
      }
      // Create a failing check if an attempt is made to submit an invalid config file.
      try {
        const configChecker = new ConfigChecker<Configuration>(
          schema,
          CONFIGURATION_FILE
        );
        const valid = await configChecker.validateConfigChanges(
          context.octokit,
          owner,
          repo,
          context.payload.pull_request.head.sha,
          context.payload.pull_request.number
        );
        // valid === false indicates that a failed check was created on the PR,
        // we can return immediately in this case:
        if (valid === false) {
          logger.warn(
            `Invalid config file in PR ${context.payload.pull_request.number} for ${owner}/${repo}`
          );
          return;
        }
      } catch (e) {
        const err = e as Error;
        err.message = `Error validating configuration: ${err.message} ${owner}/${repo}`;
        logger.warn(err);
      }
      // Conventional Commit Lint (unlike most automations) is opt-out, vs.,
      // opt in. For this reason config is loaded with default values.
      let config: Configuration | undefined = undefined;
      try {
        config = await getConfigWithDefault<Configuration>(
          context.octokit,
          owner,
          repo,
          CONFIGURATION_FILE,
          {}
        );
      } catch (e) {
        const err = e as Error;
        err.message = `Error reading configuration: ${err.message} ${owner}/${repo}`;
        logger.warn(err);
      }

      // Skip linting if it's explicitly turned off:
      if (config?.enabled === false) {
        logger.info(`commit linting not enabled for ${owner}/${repo}`);
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
      await scanPullRequest(
        context,
        context.payload.pull_request as PullRequest,
        logger
      );
    }
  );
};
