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

// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {logger} from 'gcf-utils';
import {
  ConfigChecker,
  getConfigWithDefault,
} from '@google-automations/bot-config-utils';
import schema from './config-schema.json';
import {
  ConfigurationOptions,
  WELL_KNOWN_CONFIGURATION_FILE,
  DEFAULT_CONFIGURATION,
} from './config-constants';
import {
  findPendingReleasePullRequests,
  triggerKokoroJob,
  markTriggered,
  markFailed,
  TRIGGERED_LABEL,
  PullRequest,
} from './release-trigger';

const ALLOWED_ORGANIZATIONS = [
  'googleapis',
  'GoogleCloudPlatform',
];

async function doTrigger(octokit: Octokit, pullRequest: PullRequest) {
  const owner = pullRequest.base.repo.owner?.login;
  if (!owner) {
    logger.error(`no owner for ${pullRequest.number}`);
    return;
  }
  try {
    await triggerKokoroJob(pullRequest.html_url);
    await markTriggered(octokit, {
      owner,
      repo: pullRequest.base.repo.name,
      number: pullRequest.number,
    });
  } catch (e) {
    await markFailed(octokit, {
      owner,
      repo: pullRequest.base.repo.name,
      number: pullRequest.number,
    });
  }
}

export = (app: Probot) => {
  // When a release is published, try to trigger the release
  app.on('release.published', async context => {
    const repository = context.payload.repository;
    const repoUrl = repository.full_name;
    const owner = repository.owner.login;
    const repo = repository.name;

    if (!ALLOWED_ORGANIZATIONS.includes(owner)) {
      logger.info(`release-trigger not allowed for owner: ${owner}`);
      return;
    }

    const remoteConfiguration =
      await getConfigWithDefault<ConfigurationOptions>(
        context.octokit,
        owner,
        repo,
        WELL_KNOWN_CONFIGURATION_FILE,
        DEFAULT_CONFIGURATION,
        {schema: schema}
      );
    if (!remoteConfiguration) {
      logger.info(`release-trigger not configured for ${repoUrl}`);
      return;
    }
    if (!remoteConfiguration.enabled) {
      logger.info(`release-trigger not enabled for ${repoUrl}`);
      return;
    }

    const releasePullRequests = await findPendingReleasePullRequests(
      context.octokit,
      {owner: repository.owner.login, repo: repository.name}
    );
    for (const pullRequest of releasePullRequests) {
      await doTrigger(context.octokit, pullRequest);
    }
  });

  // Try to trigger the job on removing the `autorelease: triggered` label.
  // This functionality is to retry a failed release.
  app.on('pull_request.unlabeled', async context => {
    const repository = context.payload.repository;
    const repoUrl = repository.full_name;
    const owner = repository.owner.login;
    const repo = repository.name;

    if (!ALLOWED_ORGANIZATIONS.includes(owner)) {
      logger.info(`release-trigger not allowed for owner: ${owner}`);
      return;
    }

    const remoteConfiguration =
      await getConfigWithDefault<ConfigurationOptions>(
        context.octokit,
        owner,
        repo,
        WELL_KNOWN_CONFIGURATION_FILE,
        DEFAULT_CONFIGURATION,
        {schema: schema}
      );
    if (!remoteConfiguration) {
      logger.info(`release-trigger not configured for ${repoUrl}`);
      return;
    }
    if (!remoteConfiguration.enabled) {
      logger.info(`release-trigger not enabled for ${repoUrl}`);
      return;
    }

    const label = context.payload.label?.name;
    if (label !== TRIGGERED_LABEL) {
      logger.info(`ignoring non-autorelease label: ${label}`);
      return;
    }

    await doTrigger(context.octokit, context.payload.pull_request);
  });

  // Check the config schema on PRs.
  app.on(['pull_request.opened', 'pull_request.synchronize'], async context => {
    const {owner, repo} = context.repo();

    if (!ALLOWED_ORGANIZATIONS.includes(owner)) {
      logger.info(`release-trigger not allowed for owner: ${owner}`);
      return;
    }

    const configChecker = new ConfigChecker<ConfigurationOptions>(
      schema,
      WELL_KNOWN_CONFIGURATION_FILE
    );
    await configChecker.validateConfigChanges(
      context.octokit,
      owner,
      repo,
      context.payload.pull_request.head.sha,
      context.payload.pull_request.number
    );
  });
};
