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
import {getAuthenticatedOctokit, getContextLogger, GCFLogger} from 'gcf-utils';
import {addOrUpdateIssueComment} from '@google-automations/issue-utils';
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
  delay,
  TriggerError,
  invokeAutoreleaseWithArgs,
} from './release-trigger';

const TRIGGER_LOCK_ID = 'release-trigger';
const TRIGGER_LOCK_DURATION_MS = 60 * 1000;
const TRIGGER_LOCK_ACQUIRE_TIMEOUT_MS = 120 * 1000;

/**
 * Execute a function while holding a lock.
 *
 * @param targetUrl The lock's identifier.  Example: the pull request url.
 * @param f The function to execute while holding the lock.
 * @returns the value returned by f().
 */
async function withTriggerLock<R>(
  targetUrl: string,
  f: () => Promise<R>
): Promise<R> {
  const lock = new DatastoreLock(
    TRIGGER_LOCK_ID,
    targetUrl,
    TRIGGER_LOCK_DURATION_MS,
    TRIGGER_LOCK_ACQUIRE_TIMEOUT_MS
  );
  const acquired = await lock.acquire();
  if (!acquired) {
    // throw an error and expect gcf-utils infrastructure to retry
    throw new Error(
      `Failed to acquire lock in ${TRIGGER_LOCK_ACQUIRE_TIMEOUT_MS}ms for ${targetUrl}`
    );
  }
  try {
    return await f();
  } finally {
    lock.release();
  }
}

/**
 * Try to trigger a the release job for a release pull request under
 * a lock. This is to try to avoid a race condition and double-triggering
 *
 * @param {Octokit} octokit An authenticated octokit instance
 * @param {PullRequest} pullRequest The release pull request
 * @param {string} token An authenticated auth token for releasetool to use
 * @param {GCFLogger} logger A context logger
 * @param {number} installationId The GitHub app installation id, used for authentication
 * @param {string} multiScmName Optional. If provided, trigger the Kokoro job as a multi_scm job
 * @throws {Error} if we fail to acquire the lock
 */
async function doTriggerWithLock(
  octokit: Octokit,
  pullRequest: PullRequest,
  token: string,
  logger: GCFLogger,
  installationId: number,
  multiScmName?: string
): Promise<void> {
  await withTriggerLock(pullRequest.html_url, async () => {
    // fetch the pull request and ensure it is triggerable
    pullRequest = (
      await octokit.pulls.get({
        owner: pullRequest.base.repo.owner!.login!,
        repo: pullRequest.base.repo.name,
        pull_number: pullRequest.number,
      })
    ).data;

    // double-check that the pull request is triggerable
    if (isReleasePullRequest(pullRequest)) {
      await doTrigger(
        octokit,
        pullRequest,
        token,
        logger,
        installationId,
        multiScmName
      );
    } else {
      logger.warn(`Skipping triggering release PR: ${pullRequest.html_url}`);
    }
  });
}

/**
 * Try to trigger a the release job for a release pull request using releasetool.
 *
 * @param {Octokit} octokit An authenticated octokit instance
 * @param {PullRequest} pullRequest The release pull request
 * @param {string} token An authenticated auth token for releasetool to use
 * @param {GCFLogger} logger A context logger
 * @param {number} installationId The GitHub app installation id, used for authentication
 * @param {string} multiScmName Optional. If provided, trigger the Kokoro job as a multi_scm job
 */
async function doTrigger(
  octokit: Octokit,
  pullRequest: PullRequest,
  token: string,
  logger: GCFLogger,
  installationId: number,
  multiScmName?: string
) {
  const owner = pullRequest.base.repo.owner?.login;
  if (!owner) {
    logger.error(`no owner for ${pullRequest.number}`);
    return;
  }
  const repo = pullRequest.base.repo.name;
  const number = pullRequest.number;
  try {
    const {jobName} = await triggerKokoroJob(pullRequest.html_url, token, {
      logger,
      multiScmName,
    });
    if (jobName) {
      const commentBody = `Triggered job: ${jobName} (${new Date().toISOString()})\n\nTo trigger again, remove the ${TRIGGERED_LABEL} label (in a few minutes).`;
      await addOrUpdateIssueComment(
        octokit,
        owner,
        repo,
        number,
        installationId,
        commentBody
      );
    }
  } catch (e) {
    logger.metric('release.trigger_failed', {
      owner,
      repo,
      number,
    });
    await markFailed(
      octokit,
      {
        owner,
        repo,
        number,
      },
      logger
    );
    if (e instanceof TriggerError) {
      const commentBody = `Release triggering failed:\n\nstdout:\n \`\`\`\n${e.stdout}\n\`\`\`\n\nstderr: \`\`\`\n${e.stderr}\n\`\`\``;
      await addOrUpdateIssueComment(
        octokit,
        owner,
        repo,
        number,
        installationId,
        commentBody
      );
    }
  } finally {
    logger.metric('release.triggered', {
      owner,
      repo,
      number,
    });
    await markTriggered(
      octokit,
      {
        owner,
        repo,
        number,
      },
      logger
    );
  }
}

export = (app: Probot) => {
  // When a release is published, try to trigger the release
  app.on('release.published', async context => {
    const logger = getContextLogger(context);
    const repository = context.payload.repository;
    const repoUrl = repository.full_name;
    const owner = repository.owner.login;
    const repo = repository.name;

    if (!ALLOWED_ORGANIZATIONS.includes(owner)) {
      logger.info(`release-trigger not allowed for owner: ${owner}`);
      return;
    }
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        'Installation ID not provided in release.published event.' +
          ' We cannot authenticate Octokit.'
      );
    }
    const remoteConfiguration = await getConfig<ConfigurationOptions>(
      octokit,
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

    // release-please may take some time to add the tagged label - wait a
    // few seconds to let it tag the release PR
    await delay(10_000);

    const releasePullRequests = await findPendingReleasePullRequests(octokit, {
      owner: repository.owner.login,
      repo: repository.name,
    });
    const {token} = (await context.octokit.auth({type: 'installation'})) as {
      token: string;
    };
    if (releasePullRequests.length === 0) {
      logger.warn(
        `Failed to find any pending pull requests for ${owner}/${repo}`
      );
      /// Has this repo been configured to trigger without pull requests?
      if (configuration.triggerWithoutPullRequest) {
        const lang = configuration.lang;
        if (!lang) {
          logger.error(
            'In the configuration, `lang` must be set when `triggerWithoutPullRequest` is true.'
          );
          return;
        }
        const releaseUrl = context.payload.release.html_url;
        const options = {logger, multiScmName: configuration.multiScmName};
        const metric = {owner, repo, releaseUrl};
        await withTriggerLock(releaseUrl, async () => {
          try {
            logger.metric('release.triggered', metric);
            await invokeAutoreleaseWithArgs(
              releaseUrl,
              token,
              ['trigger-single', `--release=${releaseUrl}`, `--lang=${lang}`],
              options
            );
          } catch (e) {
            logger.metric('release.trigger_failed', metric);
          }
        });
      }
    }
    for (const pullRequest of releasePullRequests) {
      if (
        !pullRequest.labels.some(label => {
          return label.name === TAGGED_LABEL;
        })
      ) {
        logger.info('ignore pull non-tagged pull request');
        continue;
      }

      await doTriggerWithLock(
        octokit,
        pullRequest,
        token,
        logger,
        context.payload.installation!.id,
        configuration.multiScmName
      );
    }
  });

  // When a release PR is labeled with `autorelease: published`, remove
  // the `autorelease: tagged` and `autorelease: triggered` labels
  app.on('pull_request.labeled', async context => {
    const logger = getContextLogger(context);
    const repository = context.payload.repository;
    const repoUrl = repository.full_name;
    const owner = repository.owner.login;
    const repo = repository.name;

    if (!ALLOWED_ORGANIZATIONS.includes(owner)) {
      logger.info(`release-trigger not allowed for owner: ${owner}`);
      return;
    }
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        'Installation ID not provided in pull_request.labeled event.' +
          ' We cannot authenticate Octokit.'
      );
    }
    const remoteConfiguration = await getConfig<ConfigurationOptions>(
      octokit,
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
    await cleanupPublished(
      octokit,
      {
        owner,
        repo,
        number: context.payload.pull_request.number,
      },
      logger
    );
  });

  // Try to trigger the job on removing the `autorelease: triggered` label.
  // This functionality is to retry a failed release.
  app.on('pull_request.unlabeled', async context => {
    const logger = getContextLogger(context);
    const repository = context.payload.repository;
    const repoUrl = repository.full_name;
    const owner = repository.owner.login;
    const repo = repository.name;

    if (!ALLOWED_ORGANIZATIONS.includes(owner)) {
      logger.info(`release-trigger not allowed for owner: ${owner}`);
      return;
    }
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        'Installation ID not provided in pull_request.unlabeled event.' +
          ' We cannot authenticate Octokit.'
      );
    }
    const remoteConfiguration = await getConfig<ConfigurationOptions>(
      octokit,
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
      octokit,
      context.payload.pull_request,
      token,
      logger,
      context.payload.installation!.id,
      configuration.multiScmName
    );
  });

  // Check the config schema on PRs.
  app.on(['pull_request.opened', 'pull_request.synchronize'], async context => {
    const logger = getContextLogger(context);
    const {owner, repo} = context.repo();

    if (!ALLOWED_ORGANIZATIONS.includes(owner)) {
      logger.info(`release-trigger not allowed for owner: ${owner}`);
      return;
    }
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        `Installation ID not provided in ${context.payload.action} event.` +
          ' We cannot authenticate Octokit.'
      );
    }
    const configChecker = new ConfigChecker<ConfigurationOptions>(
      schema,
      WELL_KNOWN_CONFIGURATION_FILE
    );
    await configChecker.validateConfigChanges(
      octokit,
      owner,
      repo,
      context.payload.pull_request.head.sha,
      context.payload.pull_request.number
    );
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('schedule.repository' as any, async context => {
    const logger = getContextLogger(context);
    const repository = context.payload.repository;
    const repoUrl = repository.full_name;
    const owner = repository.owner.login;
    const repo = repository.name;

    if (!ALLOWED_ORGANIZATIONS.includes(owner)) {
      logger.info(`release-trigger not allowed for owner: ${owner}`);
      return;
    }
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        'Installation ID not provided in schedule.repository event.' +
          ' We cannot authenticate Octokit.'
      );
    }
    const remoteConfiguration = await getConfig<ConfigurationOptions>(
      octokit,
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
      octokit,
      {
        owner: repository.owner.login,
        repo: repository.name,
      },
      5,
      2,
      logger
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

      await doTriggerWithLock(
        octokit,
        pullRequest,
        token,
        logger,
        context.payload.installation!.id,
        configuration.multiScmName
      );
    }
  });
};
