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
import {DatastoreLock} from '@google-automations/datastore-lock';
import {ConfigChecker, getConfig} from '@google-automations/bot-config-utils';
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
  PUBLISHED_LABEL,
  ALLOWED_ORGANIZATIONS,
  PullRequest,
  TAGGED_LABEL,
  cleanupPublished,
  isReleasePullRequest,
} from './release-trigger';

const TRIGGER_LOCK_ID = 'release-trigger';
const TRIGGER_LOCK_DURATION_MS = 60 * 1000;
const TRIGGER_LOCK_ACQUIRE_TIMEOUT_MS = 120 * 1000;

/**
 * Try to trigger a the release job for a release pull request under
 * a lock. This is to try to avoid a race condition and double-triggering
 *
 * @param {Octokit} octokit An authenticated octokit instance
 * @param {PullRequest} pullRequest The release pull request
 * @param {string} token An authenticated auth token for releasetool to use
 * @throws {Error} if we fail to acquire the lock
 */
async function doTriggerWithLock(
  octokit: Octokit,
  pullRequest: PullRequest,
  token: string
) {
  const lock = new DatastoreLock(
    TRIGGER_LOCK_ID,
    pullRequest.html_url,
    TRIGGER_LOCK_DURATION_MS,
    TRIGGER_LOCK_ACQUIRE_TIMEOUT_MS
  );
  const result = await lock.acquire();
  if (!result) {
    // throw an error and expect gcf-utils infrastructure to retry
    throw new Error(
      `Failed to acquire lock in ${TRIGGER_LOCK_ACQUIRE_TIMEOUT_MS}ms for ${pullRequest.html_url}`
    );
  }
  // fetch the pull request and ensure it is triggerable
  pullRequest = (
    await octokit.pulls.get({
      owner: pullRequest.base.repo.owner!.login!,
      repo: pullRequest.base.repo.name,
      pull_number: pullRequest.number,
    })
  ).data;

  try {
    // double-check that the pull request is triggerable
    if (isReleasePullRequest(pullRequest)) {
      await doTrigger(octokit, pullRequest, token);
    } else {
      logger.warn(`Skipping triggering release PR: ${pullRequest.html_url}`);
    }
  } finally {
    await lock.release();
  }
}

/**
 * Try to trigger a the release job for a release pull request using releasetool.
 *
 * @param {Octokit} octokit An authenticated octokit instance
 * @param {PullRequest} pullRequest The release pull request
 * @param {string} token An authenticated auth token for releasetool to use
 */
async function doTrigger(
  octokit: Octokit,
  pullRequest: PullRequest,
  token: string
) {
  const owner = pullRequest.base.repo.owner?.login;
  if (!owner) {
    logger.error(`no owner for ${pullRequest.number}`);
    return;
  }
  try {
    await triggerKokoroJob(pullRequest.html_url, token);
  } catch (e) {
    await markFailed(octokit, {
      owner,
      repo: pullRequest.base.repo.name,
      number: pullRequest.number,
    });
  } finally {
    await markTriggered(octokit, {
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

    const remoteConfiguration = await getConfig<ConfigurationOptions>(
      context.octokit,
      owner,
      repo,
      WELL_KNOWN_CONFIGURATION_FILE,
      {schema: schema}
    );
    if (!remoteConfiguration) {
      logger.info(`release-trigger not configured for ${repoUrl}`);
      return;
    }
    const configuration = {
      ...DEFAULT_CONFIGURATION,
      ...remoteConfiguration,
    };
    if (!configuration.enabled) {
      logger.info(`release-trigger not enabled for ${repoUrl}`);
      return;
    }

    const releasePullRequests = await findPendingReleasePullRequests(
      context.octokit,
      {owner: repository.owner.login, repo: repository.name}
    );
    const {token} = (await context.octokit.auth({type: 'installation'})) as {
      token: string;
    };
    for (const pullRequest of releasePullRequests) {
      if (
        !pullRequest.labels.some(label => {
          return label.name === TAGGED_LABEL;
        })
      ) {
        logger.info('ignore pull non-tagged pull request');
        continue;
      }

      await doTriggerWithLock(context.octokit, pullRequest, token);
    }
  });

  // When a release PR is labeled with `autorelease: published`, remove
  // the `autorelease: tagged` and `autorelease: triggered` labels
  app.on('pull_request.labeled', async context => {
    const repository = context.payload.repository;
    const repoUrl = repository.full_name;
    const owner = repository.owner.login;
    const repo = repository.name;

    if (!ALLOWED_ORGANIZATIONS.includes(owner)) {
      logger.info(`release-trigger not allowed for owner: ${owner}`);
      return;
    }

    const remoteConfiguration = await getConfig<ConfigurationOptions>(
      context.octokit,
      owner,
      repo,
      WELL_KNOWN_CONFIGURATION_FILE,
      {schema: schema}
    );
    if (!remoteConfiguration) {
      logger.info(`release-trigger not configured for ${repoUrl}`);
      return;
    }
    const configuration = {
      ...DEFAULT_CONFIGURATION,
      ...remoteConfiguration,
    };
    if (!configuration.enabled) {
      logger.info(`release-trigger not enabled for ${repoUrl}`);
      return;
    }

    const label = context.payload.label?.name;
    if (label !== PUBLISHED_LABEL) {
      logger.info(`ignoring non-published label: ${label}`);
      return;
    }
    await cleanupPublished(context.octokit, {
      owner,
      repo,
      number: context.payload.pull_request.number,
    });
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

    const remoteConfiguration = await getConfig<ConfigurationOptions>(
      context.octokit,
      owner,
      repo,
      WELL_KNOWN_CONFIGURATION_FILE,
      {schema: schema}
    );
    if (!remoteConfiguration) {
      logger.info(`release-trigger not configured for ${repoUrl}`);
      return;
    }
    const configuration = {
      ...DEFAULT_CONFIGURATION,
      ...remoteConfiguration,
    };
    if (!configuration.enabled) {
      logger.info(`release-trigger not enabled for ${repoUrl}`);
      return;
    }

    const label = context.payload.label?.name;
    if (label !== TRIGGERED_LABEL) {
      logger.info(`ignoring non-autorelease label: ${label}`);
      return;
    }

    if (
      !context.payload.pull_request.labels.some(label => {
        return label.name === TAGGED_LABEL;
      })
    ) {
      logger.info('ignore pull non-tagged pull request');
      return;
    }

    const {token} = (await context.octokit.auth({type: 'installation'})) as {
      token: string;
    };
    await doTriggerWithLock(
      context.octokit,
      context.payload.pull_request,
      token
    );
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
