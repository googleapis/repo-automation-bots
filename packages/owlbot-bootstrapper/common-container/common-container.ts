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
  getAccessTokenFromInstallation,
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

function validateEnvVariables() {
  if (!repoToClone && isMonoRepo(language)) {
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
  validateEnvVariables();
  console.log(isPreProcess);

  const isMonoRepository = isMonoRepo(language);

  const repoName = isMonoRepository
    ? repoToClone!.split('/')[2].split('.')[0]
    : createRepoName(language!, apiId!);

  const secrets = isMonoRepository
    ? await parseSecretInfo(projectId!, SECRET_NAME_APP)
    : (await parseSecretInfo(projectId!, SECRET_NAME_INDIVIDUAL)).privateToken;

  const githubToken = isMonoRepository
    ? await getAccessTokenFromInstallation(
        secrets,
        appInstallationId!,
        repoName
      )
    : secrets.privateKey;
  await setConfig();
  await saveCredentialsToGitWorkspace(githubToken);
  await execSync('cat .git-credentials');

  if (isPreProcess === 'true') {
    logger.info(`Entering pre-process for ${apiId}/${language}`);
    if (isMonoRepo(language)) {
      logger.info(`${language} is a monorepo`);
      // clone repo and open branch
      await cloneRepo(githubToken, repoToClone!);
      await openBranch(repoName);
      const branchName = fs.readFileSync(BRANCH_NAME_PATH).toString();
      console.log(branchName);
      logger.info(
        `Repo ${repoToClone} cloned, in branch ${execSync(
          'git branch; git rev-parse --abbrev-ref HEAD'
        )} in directory ${execSync('pwd; ls -a')}`
      );
    } else {
      logger.info(`${language} is a split repo`);
      await initializeEmptyGitRepo(repoName);
      logger.info(
        `Initialized empty git repo in directory ${execSync(
          `cd ${repoName}; pwd`
        )}`
      );
      const octokit = await authenticateOctokit(githubToken);
      await createRepo(octokit, repoName);
    }
  } else {
    logger.info(`Entering post-process for ${apiId}/${language}`);
    if (isMonoRepo(language)) {
      const branchName = fs.readFileSync(BRANCH_NAME_PATH).toString();
      console.log(branchName);
      await commitAndPushChanges(repoName, branchName);
      await openAPR(branchName, ORG, repoName, githubToken);
      // still have to open a PR
    } else {
      await commitAndPushChanges(repoName, 'main');
    }
  }
}

main();
