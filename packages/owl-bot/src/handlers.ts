// Copyright 2021 Google LLC
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

import {logger} from 'gcf-utils';
import {OwlBotLock, OWL_BOT_LOCK_PATH} from './config-files';
import {Configs, ConfigsStore} from './configs-store';
import {core} from './core';
// Conflicting linters think the next line is extraneous or necessary.
// eslint-disable-next-line node/no-extraneous-import
import {Endpoints} from '@octokit/types';
import {
  OctokitType,
  createIssueIfTitleDoesntExist,
  OctokitFactory,
} from './octokit-util';
import {githubRepoFromOwnerSlashName} from './github-repo';
import {fetchConfigs} from './fetch-configs';

type ListReposResponse = Endpoints['GET /orgs/{org}/repos']['response'];

/**
 * Invoked when a new pubsub message arrives because a new post processor
 * docker image has been published to Google Container Registry.
 * @param db: database
 * @param dockerImageName: the name of the docker image that was updated.
 *   example: "gcr.io/repo-automation-bots/nodejs-post-processor:latest"
 * @param dockerImageDigest: the new digest for the image.
 *   example: "sha256:1245151230998"
 */
export async function onPostProcessorPublished(
  configsStore: ConfigsStore,
  privateKey: string,
  appId: number,
  dockerImageName: string,
  dockerImageDigest: string
): Promise<void> {
  // Examine all the repos that use the specified docker image for post
  // processing.
  const repos: [string, Configs][] =
    await configsStore.findReposWithPostProcessor(dockerImageName);
  for (const [repo, configs] of repos) {
    let stale = true;
    // The lock file may be missing, for example when a new repo is created.
    try {
      stale = configs.lock!.docker.digest !== dockerImageDigest;
    } catch (e) {
      logger.error(repo + ' did not have a valid .OwlBot.yaml.lock file.');
    }
    logger.info(
      `${repo} ${configs?.lock?.docker?.digest} wants ${dockerImageDigest}`
    );
    if (stale) {
      const lock: OwlBotLock = {
        docker: {
          digest: dockerImageDigest,
          image: dockerImageName,
        },
      };
      if (!process.env.PROJECT_ID) {
        throw Error('must set environment variable PROJECT_ID');
      }
      const project: string = process.env.PROJECT_ID;
      if (!process.env.UPDATE_LOCK_BUILD_TRIGGER_ID) {
        throw Error(
          'must set environment variable UPDATE_LOCK_BUILD_TRIGGER_ID'
        );
      }
      const triggerId: string = process.env.UPDATE_LOCK_BUILD_TRIGGER_ID;
      await triggerOneBuildForUpdatingLock(
        configsStore,
        repo,
        lock,
        project,
        triggerId,
        configs
      );
      // We were hitting GitHub's abuse detection algorithm,
      // add a short sleep between creating PRs to help circumvent:
      await new Promise(resolve => {
        setTimeout(resolve, 500, null);
      });
    }
  }
}

// const UPDATE_LOCK_BUILD_TRIGGER_ID = 'd63288e8-3fb9-4469-b11a-9302fbe7783e';

/**
 * Creates a cloud build to update .OwlBot.lock.yaml, if one doesn't already
 * exist.
 * @param db: database
 * @param repoFull: full repo name like "googleapis/nodejs-vision"
 * @param lock: The new contents of the lock file.
 * @param project: a google cloud project id
 * @returns: the build id.
 */
export async function triggerOneBuildForUpdatingLock(
  configsStore: ConfigsStore,
  repoFull: string,
  lock: OwlBotLock,
  project: string,
  triggerId: string,
  configs?: Configs,
  owlBotCli = 'gcr.io/repo-automation-bots/owlbot-cli'
): Promise<string> {
  const existingBuildId = await configsStore.findBuildIdForUpdatingLock(
    repoFull,
    lock
  );
  if (existingBuildId) {
    logger.info(`existing build id ${existingBuildId} found.`);
    return existingBuildId;
  }
  const repo = githubRepoFromOwnerSlashName(repoFull);
  const cb = core.getCloudBuildInstance();
  const [, digest] = lock.docker.digest.split(':'); // Strip sha256: prefix
  logger.info(`triggering build for ${repoFull}.`);
  const [resp] = await cb.runBuildTrigger({
    projectId: project,
    triggerId: triggerId,
    source: {
      projectId: project,
      substitutions: {
        _PR_OWNER: repo.owner,
        _REPOSITORY: repo.repo,
        _PR_BRANCH: `owl-bot-update-lock-${digest}`,
        _LOCK_FILE_PATH: OWL_BOT_LOCK_PATH,
        _CONTAINER: `${lock.docker.image}@${lock.docker.digest}`,
        _OWL_BOT_CLI: owlBotCli,
      },
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buildId: string = (resp as any).metadata.build.id;
  logger.info(`created build id ${buildId}.`);
  await configsStore.recordBuildIdForUpdatingLock(repoFull, lock, buildId);
  return buildId;
}

/**
 * Iterates through all the paginated responses to collect the full list.
 */
async function listReposInOrg(
  octokit: OctokitType,
  githubOrg: string
): Promise<ListReposResponse['data']> {
  const result: ListReposResponse['data'] = [];
  for await (const response of octokit.paginate.iterator(
    octokit.repos.listForOrg,
    {
      org: githubOrg,
    }
  )) {
    const repos = response.data as ListReposResponse['data'];
    result.push(...repos);
  }
  return result;
}

/**
 * Scans a whole github org for config files, and updates stale entries in
 * the config store.
 * @param configStore where to store config file contents
 * @param octokit Octokit
 * @param githubOrg the name of the github org whose repos will be scanned
 * @param orgInstallationId the installation id of the github app.
 */
export async function scanGithubForConfigs(
  configsStore: ConfigsStore,
  octokitFactory: OctokitFactory,
  githubOrg: string,
  orgInstallationId: number
): Promise<void> {
  logger.info(`scan ${githubOrg} installation = ${orgInstallationId}`);
  logger.metric('owlbot.scan_github_for_configs', {
    org: githubOrg,
    installationId: orgInstallationId,
  });
  const repos = await listReposInOrg(
    await octokitFactory.getShortLivedOctokit(),
    githubOrg
  );
  for (const repo of repos) {
    // Load the current configs from the db.
    const repoFull = `${githubOrg}/${repo.name}`;
    const configs = await configsStore.getConfigs(repoFull);
    const defaultBranch = repo.default_branch ?? 'master';
    logger.info(`Refreshing configs for ${githubOrg}/${repo.name}`);
    try {
      await refreshConfigs(
        configsStore,
        configs,
        await octokitFactory.getShortLivedOctokit(),
        githubOrg,
        repo.name,
        defaultBranch,
        orgInstallationId
      );
    } catch (err) {
      if (err.status === 404) {
        logger.warn(`received 404 refreshing ${githubOrg}/${repo.name}`);
        continue;
      } else {
        throw err;
      }
    }
  }
  logger.info('finished iterating over repos');
}

/**
 * If the configs in the repo are newer than the configs in the configStore,
 * update the configStore.
 * @param configStore where to store config file contents
 * @param configs the configs recently fetch from the configStore; may be
 *   undefined if there were no configs in the configStore.
 * @param octokit Octokit
 * @param githubOrg the name of the github org whose repos will be scanned
 * @param repoName the name of the repo; ex: "nodejs-vision".
 * @param defaultBranch the name of the repo's default branch; ex: "main"
 * @param installationId the installation id of the github app.
 */
export async function refreshConfigs(
  configsStore: ConfigsStore,
  configs: Configs | undefined,
  octokit: OctokitType,
  githubOrg: string,
  repoName: string,
  defaultBranch: string,
  installationId: number
): Promise<void> {
  // Query github for the commit hash of the default branch.
  const {data: branchData} = await octokit.repos.getBranch({
    owner: githubOrg,
    repo: repoName,
    branch: defaultBranch,
  });
  const repoFull = `${githubOrg}/${repoName}`;
  const commitHash = branchData.commit.sha;
  if (!commitHash) {
    logger.error(`${repoFull}:${defaultBranch} is missing a commit sha!`);
    return;
  }
  if (
    configs?.commitHash === commitHash &&
    configs?.branchName === defaultBranch
  ) {
    logger.info(`Configs for ${repoFull} are up to date.`);
    return; // configsStore is up to date.
  }

  // Update the configs.
  const newConfigs: Configs = {
    branchName: defaultBranch,
    installationId: installationId,
    commitHash: commitHash,
  };

  const {lock, yamls, badConfigs} = await fetchConfigs(octokit, {
    owner: githubOrg,
    repo: repoName,
    ref: commitHash,
  });
  if (lock) {
    newConfigs.lock = lock;
  }
  if (yamls.length > 0) {
    newConfigs.yamls = yamls;
  }

  // Store the new configs back into the database.
  const stored = await configsStore.storeConfigs(
    repoFull,
    newConfigs,
    configs?.commitHash ?? null
  );
  if (stored) {
    logger.info(`Stored new configs for ${repoFull}`);
    for (const badConfig of badConfigs) {
      await createIssueIfTitleDoesntExist(
        octokit,
        githubOrg,
        repoName,
        badConfig.path + ' is broken.',
        'This repo will not receive automatic updates until this issue is fixed.\n\n' +
          String(badConfig.error)
      );
    }
  } else {
    logger.info(
      `Mid-air collision! ${repoFull}'s configs were already updated.`
    );
  }
}
