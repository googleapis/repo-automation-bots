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
import {createPullRequest} from 'code-suggester';
import {dump} from 'js-yaml';
import {
  OwlBotLock,
  owlBotLockFrom,
  owlBotLockPath,
  owlBotYamlFromText,
  owlBotYamlPath,
} from './config-files';
import {Configs, ConfigsStore} from './configs-store';
import {getAuthenticatedOctokit, core} from './core';
import {Octokit} from '@octokit/rest';
import yaml from 'js-yaml';
// Conflicting linters think the next line is extraneous or necessary.
// eslint-disable-next-line node/no-extraneous-import
import {Endpoints} from '@octokit/types';
import {OctokitType} from './octokit-util';

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
  const repos: [
    string,
    Configs
  ][] = await configsStore.findReposWithPostProcessor(dockerImageName);
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
      const octokit = await getAuthenticatedOctokit({
        privateKey,
        appId,
        installation: configs.installationId,
      });
      // TODO(bcoe): switch updatedAt to date from PubSub payload:
      await createOnePullRequestForUpdatingLock(
        configsStore,
        octokit,
        repo,
        lock,
        configs
      );
    }
  }
}

/**
 * Creates a pull request to update .OwlBot.lock.yaml, if one doesn't already
 * exist.
 * @param db: database
 * @param octokit: Octokit.
 * @param repoFull: full repo name like "googleapis/nodejs-vision"
 * @param lock: The new contents of the lock file.
 * @returns: the uri of the new or existing pull request
 */
export async function createOnePullRequestForUpdatingLock(
  configsStore: ConfigsStore,
  octokit: OctokitType,
  repoFull: string,
  lock: OwlBotLock,
  configs?: Configs
): Promise<string> {
  const existingPullRequest = await configsStore.findPullRequestForUpdatingLock(
    repoFull,
    lock
  );
  if (existingPullRequest) {
    logger.info(`existing pull request ${existingPullRequest} found`);
    return existingPullRequest;
  }
  const [owner, repo] = repoFull.split('/');
  // createPullRequest expects file updates as a Map
  // of objects with content/mode:
  const changes = new Map();
  changes.set(owlBotLockPath, {
    content: dump(lock),
    mode: '100644',
  });
  // Opens a pull request with any files represented in changes:
  logger.info(`opening pull request for ${lock.docker.digest}`);
  const prNumber = await createPullRequest(
    octokit as Octokit,
    changes,
    {
      upstreamOwner: owner,
      upstreamRepo: repo,
      // TODO(rennie): we should provide a context aware commit
      // message for this:
      title: 'build: update .OwlBot.lock with new version of post-processor',
      branch: `owlbot-lock-${Date.now()}`,
      description: `Version ${
        lock.docker.digest
      } was published at ${new Date().toISOString()}.`,
      primary: configs?.branchName ?? 'main',
      force: true,
      fork: false,
      // TODO(bcoe): replace this message with last commit to synthtool:
      message: 'build: update .OwlBot.lock with new version of post-processor',
    },
    {level: 'error'}
  );
  const newPullRequest = `https://github.com/${repoFull}/pull/${prNumber}`;
  await configsStore.recordPullRequestForUpdatingLock(
    repoFull,
    lock,
    newPullRequest
  );
  return newPullRequest;
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
