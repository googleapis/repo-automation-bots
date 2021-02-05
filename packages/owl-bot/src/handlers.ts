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

import {OwlBotLock} from './config-files';
import {Configs, ConfigsStore} from './database';
import {Octokit} from '@octokit/rest';

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
  octokit: Octokit,
  dockerImageName: string,
  dockerImageDigest: string,
  logger = console
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
      logger.log(repo + ' did not have a valid .OwlBot.yaml.lock file.');
    }
    if (stale) {
      const lock: OwlBotLock = {
        docker: {
          digest: dockerImageDigest,
          image: dockerImageName,
        },
      };
      // TODO(bcoe): construct an octokit with configs.installationId or
      // pass an octokit into this function.
      createOnePullRequestForUpdatingLock(configsStore, octokit, repo, lock);
    }
  }
}

/**
 * Creates a pull request to update .OwlBot.lock.yaml, if one doesn't already
 * exist.
 * @param db: database
 * @param octokit: Octokit.
 * @param repo: full repo name like "googleapis/nodejs-vision"
 * @param lock: The new contents of the lock file.
 * @returns: the uri of the new or existing pull request
 */
async function createOnePullRequestForUpdatingLock(
  configsStore: ConfigsStore,
  octokit: Octokit,
  repo: string,
  lock: OwlBotLock
): Promise<string> {
  const existingPullRequest = await configsStore.findPullRequestForUpdatingLock(
    repo,
    lock
  );
  if (existingPullRequest) {
    return existingPullRequest;
  }
  const newPullRequest = 'TODO(bcoe): create the pull request.';
  await configsStore.recordPullRequestForUpdatingLock(
    repo,
    lock,
    newPullRequest
  );
  return newPullRequest;
}
