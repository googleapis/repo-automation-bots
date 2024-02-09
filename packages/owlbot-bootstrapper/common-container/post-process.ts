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
// cloudbuild-owlbot-bootstrapper.yaml build. This particular file executes
// the post-processing after the language contaner has run. This will be invoked by the Cloud Build file,
// which will in turn be invoked manually until it is invoked by a github webhook event.

import {openAnIssue, setConfig} from './utils';
import {logger} from 'gcf-utils';
import {MonoRepo} from './mono-repo';
import {GithubAuthenticator} from './github-authenticator';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import {CliArgs, Language} from './interfaces';

export async function postProcess(argv: CliArgs) {
  logger.info(`Entering post-process for ${argv.apiId}/${argv.language}`);

  // Instantiates a github authenticator class, to get a short-lived token and octokit
  const githubAuthenticator = new GithubAuthenticator(
    argv.projectId,
    argv.installationId,
    new SecretManagerServiceClient({fallback: 'rest'})
  );
  const githubToken =
    await githubAuthenticator.getGitHubShortLivedAccessToken();

  const octokit = await githubAuthenticator.authenticateOctokit(githubToken);

  if (argv.repoToClone === '') {
    throw new Error('No repo to clone specified');
  }

  // Sets git config options for owlbot-bootstrapper
  await setConfig();
  try {
    // Post-process (after language specific-container)
    const monoRepo = new MonoRepo(
      argv.language as Language,
      argv.repoToClone,
      githubToken,
      argv.apiId,
      argv.monoRepoName,
      argv.monoRepoOrg,
      octokit
    );

    await monoRepo.pushToBranchAndOpenPR(
      argv.monoRepoPath,
      argv.interContainerVarsPath,
      argv.sourceCl
    );
    logger.info(`Opened a new PR in ${monoRepo.repoName}`);
  } catch (err) {
    if (argv.skipIssueOnFailure === 'false') {
      logger.info(
        `Post process failed; opening an issue on ${argv.monoRepoOrg}/${argv.monoRepoName}`
      );

      await openAnIssue(
        octokit,
        argv.monoRepoOrg,
        argv.monoRepoName,
        argv.apiId,
        argv.buildId,
        argv.projectId,
        argv.language,
        (err as any).toString()
      );
    }
    throw err;
  }
}
