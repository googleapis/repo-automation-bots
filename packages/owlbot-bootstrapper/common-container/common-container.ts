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

import {openAnIssue, setConfig} from './utils';
import {logger} from 'gcf-utils';
import {MonoRepo} from './mono-repo';
import {GithubAuthenticator} from './github-authenticator';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import {Language} from './interfaces';
import {SplitRepo} from './split-repo';

export const ORG = 'googleapis';
export const DIRECTORY_PATH = '/workspace';

// Validate env variables, execute early if they are not present
export function validateEnvVariables(isMonoRepository: boolean) {
  if (!process.env.REPO_TO_CLONE && isMonoRepository) {
    throw new Error('No repo to clone specified for monorepo');
  }

  if (!process.env.IS_PRE_PROCESS) {
    throw new Error('Pre or post process not specified');
  }

  if (!process.env.API_ID) {
    throw new Error('API ID not specified');
  }

  if (!process.env.LANGUAGE) {
    throw new Error('Language not specified');
  }

  if (!process.env.PROJECT_ID) {
    throw new Error('Project for cloud build trigger not specified');
  }

  if (!process.env.APP_INSTALLATION_ID) {
    throw new Error('Missing app installation Id');
  }
}

// Check if a given language is a monorepo
export function isMonoRepo(language: Language): boolean {
  const monorepos = ['nodejs', 'php', 'dotnet', 'ruby', 'java'];
  if (monorepos.includes(language)) {
    return true;
  }
  return false;
}

export async function main() {
  const githubAuthenticator = new GithubAuthenticator(
    process.env.PROJECT_ID!,
    process.env.APP_INSTALLATION_ID!,
    new SecretManagerServiceClient()
  );
  const githubToken =
    await githubAuthenticator.getGitHubShortLivedAccessToken();

  const octokit = await githubAuthenticator.authenticateOctokit(githubToken);

  try {
    // Will fail if any arguments are missing
    const isMonoRepository = isMonoRepo(process.env.LANGUAGE as Language);

    // Since we'll error if env variables are not present,
    // we can assert they'll exist later on in the code.
    validateEnvVariables(isMonoRepository);

    await setConfig(DIRECTORY_PATH);

    if (process.env.IS_PRE_PROCESS === 'true') {
      logger.info(
        `Entering pre-process for ${process.env.API_ID}/${process.env.LANGUAGE}`
      );
      if (isMonoRepository) {
        // Mono-repo pre-process (before language specific-container)
        logger.info(`${process.env.LANGUAGE} is a mono repo`);
        const monoRepo = new MonoRepo(
          process.env.LANGUAGE as Language,
          process.env.REPO_TO_CLONE!,
          githubToken,
          octokit
        );

        await monoRepo.cloneRepoAndOpenBranch(DIRECTORY_PATH);

        logger.info(`Repo ${monoRepo.repoName} cloned`);
      } else {
        // Split-repo pre-process (before language specific-container)
        logger.info(`${process.env.LANGUAGE} is a split repo`);

        const splitRepo = new SplitRepo(
          process.env.LANGUAGE as Language,
          process.env.API_ID!,
          octokit,
          githubToken
        );

        await splitRepo.createAndInitializeEmptyGitRepo(DIRECTORY_PATH);

        logger.info(`Initialized empty git repo ${splitRepo.repoName}`);
      }
    } else {
      logger.info(
        `Entering post-process for ${process.env.API_ID}/${process.env.LANGUAGE}`
      );
      if (isMonoRepository) {
        // Mono-repo post-process (after language specific-container)
        logger.info(`${process.env.LANGUAGE} is a mono repo`);
        const monoRepo = new MonoRepo(
          process.env.LANGUAGE as Language,
          process.env.REPO_TO_CLONE!,
          githubToken,
          octokit
        );

        await monoRepo.pushToBranchAndOpenPR(DIRECTORY_PATH);
        logger.info(`Opened a new PR in ${monoRepo.repoName}`);
      } else {
        // Split-repo post-process (after language specific-container)
        logger.info(`${process.env.LANGUAGE} is a split repo`);
        const splitRepo = new SplitRepo(
          process.env.LANGUAGE as Language,
          process.env.API_ID!,
          octokit,
          githubToken
        );
        await splitRepo.pushToMainAndCreateEmptyPR(DIRECTORY_PATH);
        logger.info(
          `Pushed files to main in ${splitRepo.repoName}, and opened empty PR`
        );
      }
    }
  } catch (err) {
    await openAnIssue(
      octokit,
      process.env.REPO_TO_CLONE?.split('/')[2]?.split('.')[0] ?? 'googleapis',
      process.env.API_ID,
      process.env.BUILD_ID,
      process.env.PROJECT_ID,
      process.env.LANGUAGE,
      (err as any).toString()
    );
    throw err;
  }
}

main();
