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
// for a split or mono repo-type object. This will be invoked by the Cloud Build file,
// which will in turn be invoked manually until it is invoked by a github webhook event.

import {openAnIssue, setConfig, isMonoRepo, DIRECTORY_PATH} from './utils';
import {logger} from 'gcf-utils';
import {MonoRepo} from './mono-repo';
import {GithubAuthenticator} from './github-authenticator';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import {CliArgs, Language} from './interfaces';
import {SplitRepo} from './split-repo';

export async function preProcess(argv: CliArgs) {
  logger.info(`Entering pre-process for ${argv.apiId}/${argv.language}`);

  const githubAuthenticator = new GithubAuthenticator(
    argv.projectId,
    argv.installationId,
    new SecretManagerServiceClient()
  );
  const githubToken =
    await githubAuthenticator.getGitHubShortLivedAccessToken();

  const octokit = await githubAuthenticator.authenticateOctokit(githubToken);

  const isMonoRepository = isMonoRepo(argv.language as Language);

  await setConfig(DIRECTORY_PATH);

  try {
    if (isMonoRepository) {
      // Mono-repo pre-process (before language specific-container)
      logger.info(`${argv.language} is a mono repo`);
      const monoRepo = new MonoRepo(
        argv.language as Language,
        argv.repoToClone!,
        githubToken,
        octokit
      );

      await monoRepo.cloneRepoAndOpenBranch(DIRECTORY_PATH);

      logger.info(`Repo ${monoRepo.repoName} cloned`);
    } else {
      // Split-repo pre-process (before language specific-container)
      logger.info(`${argv.language} is a split repo`);

      const splitRepo = new SplitRepo(
        argv.language as Language,
        argv.apiId,
        octokit,
        githubToken
      );

      await splitRepo.createAndInitializeEmptyGitRepo(DIRECTORY_PATH);

      logger.info(`Initialized empty git repo ${splitRepo.repoName}`);
    }
  } catch (err) {
    await openAnIssue(
      octokit,
      argv.repoToClone?.split('/')[2]?.split('.')[0] ?? 'googleapis',
      argv.apiId,
      argv.buildId,
      argv.projectId,
      argv.language,
      (err as any).toString()
    );
    throw err;
  }
}
