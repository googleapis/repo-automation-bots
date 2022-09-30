// Copyright 2022 Google LLC
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

// This file represents the _CONTAINER that is run in the
// cloudbuild-owlbot-bootstrapper.yaml build. Depending on its env variables,
// it will execute a 'pre-' or 'post-' flow (around a language-specific container)
// for a mono repo-type object. This will be invoked by the Cloud Build file,
// which will in turn be invoked manually until it is invoked by a github webhook event.

import {
  openAnIssue,
  setConfig,
  DIRECTORY_PATH,
  INTER_CONTAINER_VARS_FILE,
} from './utils';
import {logger} from 'gcf-utils';
import {MonoRepo} from './mono-repo';
import {GithubAuthenticator} from './github-authenticator';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import {CliArgs, Language} from './interfaces';
import {Storage} from '@google-cloud/storage';
import {ApiFieldFetcher} from './api-field-fetcher';

export async function preProcess(argv: CliArgs) {
  logger.info(`Entering pre-process for ${argv.apiId}/${argv.language}`);

  // Create github authenticator instance to get short lived token
  const githubAuthenticator = new GithubAuthenticator(
    argv.projectId,
    argv.installationId,
    new SecretManagerServiceClient()
  );
  const githubToken =
    await githubAuthenticator.getGitHubShortLivedAccessToken();

  const octokit = await githubAuthenticator.authenticateOctokit(githubToken);

  if (argv.repoToClone === '') {
    throw new Error('No repo to clone specified');
  }

  await setConfig(DIRECTORY_PATH);

  try {
    // Pre-process (before language specific-container)
    const monoRepo = new MonoRepo(
      argv.language as Language,
      argv.repoToClone!,
      githubToken,
      argv.apiId,
      octokit
    );

    await monoRepo.cloneRepoAndOpenBranch(DIRECTORY_PATH);
    logger.info(`Repo ${monoRepo.repoName} cloned`);

    new ApiFieldFetcher(
      argv.apiId,
      octokit,
      new Storage()
    ).getAndSaveApiInformation(DIRECTORY_PATH);

    logger.info(
      `API Information saved to ${DIRECTORY_PATH}/${INTER_CONTAINER_VARS_FILE}`
    );
  } catch (err) {
    logger.info(
      `Pre process failed; opening an issue on googleapis/${
        argv.repoToClone?.match(/\/([\w-]*)(.git|$)/)![1] ?? 'googleapis'
      }`
    );

    await openAnIssue(
      octokit,
      argv.repoToClone?.match(/\/([\w-]*)(.git|$)/)![1] ?? 'googleapis',
      argv.apiId,
      argv.buildId,
      argv.projectId,
      argv.language,
      (err as any).toString()
    );
    throw err;
  }
}
