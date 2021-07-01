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
import {
  OwlBotLock,
  owlBotLockFrom,
  owlBotLockPath,
  owlBotYamlFromText,
  owlBotYamlPath,
} from './config-files';
import {Configs, ConfigsStore} from './configs-store';
import {core} from './core';
import yaml from 'js-yaml';
// Conflicting linters think the next line is extraneous or necessary.
// eslint-disable-next-line node/no-extraneous-import
import {Endpoints} from '@octokit/types';
import {OctokitType, createIssueIfTitleDoesntExist} from './octokit-util';
import {githubRepoFromOwnerSlashName} from './github-repo';

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
        setTimeout(resolve, 500);
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
        _LOCK_FILE_PATH: owlBotLockPath,
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
 * Scans a whole github org for config files, and updates stale entries in
 * the config store.
 * @param configStore where to store config file contents
 * @param octokit Octokit
 * @param githubOrg the name of the github org whose repos will be scanned
 * @param orgInstallationId the installation id of the github app.
 */
export async function scanGithubForConfigs(
  configsStore: ConfigsStore,
  octokit: OctokitType,
  githubOrg: string,
  orgInstallationId: number
): Promise<void> {
  let count = 0; // Count of repos scanned for debugging purposes.
  logger.info(`scan ${githubOrg} installation = ${orgInstallationId}`);
  logger.metric('owlbot.scan_github_for_configs', {
    org: githubOrg,
    installationId: orgInstallationId,
  });

  for await (const response of octokit.paginate.iterator(
    octokit.repos.listForOrg,
    {
      org: githubOrg,
    }
  )) {
    const repos = response.data as ListReposResponse['data'];
    logger.info(`count = ${count} page size = ${repos.length}`);
    for (const repo of repos) {
      count++;
      // Load the current configs from the db.
      const repoFull = `${githubOrg}/${repo.name}`;
      const configs = await configsStore.getConfigs(repoFull);
      const defaultBranch = repo.default_branch ?? 'master';
      logger.info(`refresh config for ${githubOrg}/${repo.name}`);
      try {
        await refreshConfigs(
          configsStore,
          configs,
          octokit,
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
    logger.info(`Configs for ${repoFull} or up to date.`);
    return; // configsStore is up to date.
  }

  // Update the configs.
  const newConfigs: Configs = {
    branchName: defaultBranch,
    installationId: installationId,
    commitHash: commitHash,
  };

  // Query github for the contents of the lock file.
  const lockContent = await core.getFileContent(
    githubOrg,
    repoName,
    owlBotLockPath,
    commitHash,
    octokit
  );
  if (lockContent) {
    try {
      newConfigs.lock = owlBotLockFrom(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yaml.load(lockContent) as Record<string, any>
      );
    } catch (e) {
      logger.error(
        `${repoFull} has an invalid ${owlBotLockPath} file: ${e.message}`
      );

      const title = `Invalid ${owlBotLockPath}`;
      const body = `\`owl-bot\` will not be able to update this repo until '${owlBotLockPath}' is fixed.

Please fix this as soon as possible so that your repository will not go stale.`;

      await createIssueIfTitleDoesntExist(
        octokit,
        githubOrg,
        repoName,
        title,
        body,
        logger
      );
    }
  }

  // Query github for the contents of the yaml file.
  const yamlContent = await core.getFileContent(
    githubOrg,
    repoName,
    owlBotYamlPath,
    commitHash,
    octokit
  );
  if (yamlContent) {
    try {
      newConfigs.yaml = owlBotYamlFromText(yamlContent);
    } catch (e) {
      logger.error(`${repoFull} has an invalid ${owlBotYamlPath} file: ${e}`);

      const title = `Invalid ${owlBotYamlPath}`;
      const body = `\`owl-bot\` will not be able to update this repo until '${owlBotYamlPath}' is fixed.

Please fix this as soon as possible so that your repository will not go stale.`;

      await createIssueIfTitleDoesntExist(
        octokit,
        githubOrg,
        repoName,
        title,
        body,
        logger
      );
    }
  }
  // Store the new configs back into the database.
  const stored = await configsStore.storeConfigs(
    repoFull,
    newConfigs,
    configs?.commitHash ?? null
  );
  if (stored) {
    logger.info(`Stored new configs for ${repoFull}`);
  } else {
    logger.info(
      `Mid-air collision! ${repoFull}'s configs were already updated.`
    );
  }
}
