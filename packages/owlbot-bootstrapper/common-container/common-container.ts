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

import {execSync} from 'child_process';
import {
  authenticateOctokit,
  getGitHubShortLivedAccessToken,
  parseSecretInfo,
  saveCredentialsToGitWorkspace,
  SECRET_NAME_APP,
  SECRET_NAME_INDIVIDUAL,
  setConfig,
} from './authenticate-github';
import {isMonoRepo, cloneRepo, openBranch, openAPR} from './monorepo-utils';
import {commitAndPushChanges} from './utils';
import {logger} from 'gcf-utils';
import {
  createRepo,
  createRepoName,
  initializeEmptyGitRepo,
  ORG,
} from './split-repo-utils';
import * as fs from 'fs';

const repoToClone = process.env.REPO_TO_CLONE;
const isPreProcess = process.env.IS_PRE_PROCESS;
const apiId = process.env.API_ID;
const language = process.env.LANGUAGE;
const projectId = process.env.PROJECT_ID;
const appInstallationId = process.env.APP_INSTALLATION_ID;

const BRANCH_NAME_PATH = '/workspace/branchName.md';

function validateEnvVariables(isMonoRepository: boolean) {
  if (!repoToClone && isMonoRepository) {
    throw new Error('No repo to clone specified for monorepo');
  }

  if (!isPreProcess) {
    throw new Error('Pre or post process not specified');
  }

  if (!language) {
    throw new Error('Language not specified');
  }

  if (!apiId) {
    throw new Error('API ID not specified');
  }

  if (!projectId) {
    throw new Error('Project for cloud build trigger not specified');
  }

  if (!appInstallationId) {
    throw new Error('Missing app installation Id');
  }
}

async function main() {
  // Will fail if any arguments are missing
  const isMonoRepository = isMonoRepo(language);

  validateEnvVariables(isMonoRepository);

  const repoName = isMonoRepository
    ? repoToClone!.split('/')[2].split('.')[0]
    : createRepoName(language!, apiId!);

  // const secrets = isMonoRepository
  // ? await parseSecretInfo(projectId!, SECRET_NAME_APP)
  // : (await parseSecretInfo(projectId!, SECRET_NAME_INDIVIDUAL)).privateToken;

  const secrets = await parseSecretInfo(projectId!, SECRET_NAME_APP);

  const githubToken = await getGitHubShortLivedAccessToken(
    secrets.privateKey,
    parseInt(appInstallationId!),
    secrets.appId
  );
  await setConfig();
  // logger.info(execSync('cat .git-credentials').toString());

  if (isPreProcess === 'true') {
    logger.info(`Entering pre-process for ${apiId}/${language}`);
    if (isMonoRepository) {
      const monoRepo = new MonoRepo
      logger.info(`${language} is a monorepo`);
      // clone repo and open branch
      await cloneRepo(githubToken, repoToClone!);
      await openBranch(repoName);
      const branchName = fs.readFileSync(BRANCH_NAME_PATH).toString();
      console.log(branchName);
      logger.info(
        `Repo ${repoToClone} cloned, in branch ${execSync(
          'git rev-parse --abbrev-ref HEAD'
        )} in directory ${execSync('pwd; ls -a')}`
      );
    } else {
      logger.info(`${language} is a split repo`);
      const octokit = await authenticateOctokit(githubToken);
      await createRepo(octokit, repoName);
      await initializeEmptyGitRepo(repoName);
    }
  } else {
    logger.info(`Entering post-process for ${apiId}/${language}`);
    if (isMonoRepo(language)) {
      const branchName = fs.readFileSync(BRANCH_NAME_PATH).toString();
      console.log(branchName);
      // const token = (await parseSecretInfo(projectId!, SECRET_NAME_INDIVIDUAL))
      //   .privateToken;
      //process.env.GITHUB_TOKEN = githubToken;
      // execSync(
      //   `echo https://${githubToken}@github.com >> /workspace/.git-credentials`
      // );
      await commitAndPushChanges(repoName, branchName);
      await openAPR(branchName, ORG, repoName, githubToken);
      // still have to open a PR
    } else {
      await commitAndPushChanges(repoName, 'main', githubToken);
    }
  }
}

main();
