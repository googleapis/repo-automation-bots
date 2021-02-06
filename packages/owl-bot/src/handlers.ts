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

import {createPullRequest} from 'code-suggester';
import {dump} from 'js-yaml';
import {OwlBotLock, owlBotLockPath} from './config-files';
import {Configs, ConfigsStore} from './database';
import {OctokitType} from './core';
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
  octokit: OctokitType,
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
      createOnePullRequestForUpdatingLock(configsStore, octokit, repo, lock);
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
  lock: OwlBotLock
): Promise<string> {
  const existingPullRequest = await configsStore.findPullRequestForUpdatingLock(
    repoFull,
    lock
  );
  if (existingPullRequest) {
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
  const prNumber = await createPullRequest(
    octokit as Octokit,
    changes,
    {
      upstreamOwner: owner,
      upstreamRepo: repo,
      // TODO(rennie): we should provide a context aware commit
      // message for this:
      title: 'Update OwlBot.lock',
      branch: 'owl-bot-lock-1',
      // TODO(bcoe): come up with a funny blurb to put in PRs.
      description:
        '🦉 flying is not merely some crude, mechanical process. It is a delicate art',
      // TODO(rennie): we need a way to track what the primary branch
      // is for a PR.
      primary: 'main',
      force: true,
      fork: false,
      // TODO(rennie): we should provide a context aware commit
      // message for this:
      message: 'Update OwlBot.lock',
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
