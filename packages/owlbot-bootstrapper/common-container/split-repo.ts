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

import {logger} from 'gcf-utils';
import {Language} from './interfaces';
import {Octokit} from '@octokit/rest';
import {
  getWellKnownFileContents,
  openABranch,
  openAPR,
  cmd,
  checkIfGitIsInstalled,
  ORG,
  INTER_CONTAINER_VARS_FILE,
  getLatestShaGoogleapisGen,
  getCopyTagText,
} from './utils';

export const BRANCH_NAME_PREFIX = 'owlbot-bootstrapper-initial-PR';

/**
 * SplitRepo class
 *
 * @param language the Language of the particular monorepo
 * @param repoName the name for the repo to clone, i.e., nodejs-kms
 * @param apiId the api ID that was generated, i.e., google.cloud.kms.v1
 * @param octokit an instance of Octokit
 * @param githubToken a short-lived access Github access token
 */
export class SplitRepo {
  language: Language;
  repoName: string;
  apiId: string;
  octokit: Octokit;
  githubToken?: string;

  constructor(
    language: Language,
    apiId: string,
    octokit: Octokit,
    githubToken?: string
  ) {
    this.language = language;
    this.apiId = apiId;
    this.repoName = this._createRepoName(this.language, this.apiId);
    this.githubToken = githubToken;
    this.octokit = octokit;
  }
  /**
   * Creates a new repo in github
   *
   * @param octokit the url for the repo to clone without the preceeding https://, e.g., just github.com/googleapis/nodejs-kms.git
   * @param repoName the name of the repo to create, i.e., python-kms
   */
  public async _createRepo(octokit: Octokit, repoName: string) {
    try {
      await octokit.rest.repos.createInOrg({
        org: ORG,
        name: repoName,
      });
    } catch (err) {
      if ((err as any).message.match(/name already exists on this account/)) {
        logger.info(
          `${ORG}/${repoName} already exists, skipping repo creation`
        );
      } else {
        logger.error(err as any);
        throw err;
      }
    }
  }

  /**
   * Creates a repo name from the api Id
   *
   * @param language the Language that is triggering the process
   * @param apiId the api ID that is triggering the process, i.e., google.cloud.kms.v1
   */
  public _createRepoName(language: string, apiId: string): string {
    const apiIdSplit = apiId.split('.');
    if (apiIdSplit[1] === 'cloud') {
      return `${language}-${apiIdSplit[2]}`;
    } else {
      return `${language}-${apiIdSplit[1]}-${apiIdSplit[2]}`;
    }
  }

  /**
   * Initializes an empty git repo locally
   *
   * @param repoName the name of the git repo to initialize
   * @param directoryPath the path where the empty repo should be initialized
   */
  public async _initializeEmptyGitRepo(
    repoName: string,
    directoryPath: string
  ) {
    cmd(`mkdir ${repoName}`, {cwd: directoryPath});
    cmd('git init', {cwd: `${directoryPath}/${repoName}`});
  }

  /**
   * Commits any changes made to main and pushes them
   *
   * @param repoName the name of the repo on github to push the changes to
   * @param directoryPath name of the directory in which the process is running (i.e., 'workspace' for a container)
   * @param githubToken a short-lived access Github access token
   * @param repoUrl the url of the repo to push to; mostly for testing purposes.
   */
  public async _commitAndPushToMain(
    repoName: string,
    directoryPath: string,
    githubToken?: string,
    repoUrl?: string
  ) {
    if (githubToken) {
      cmd(
        `git add .; git commit -m "feat: adding initial files"; git branch -M main; git remote add origin https://x-access-token:${githubToken}@github.com/${ORG}/${repoName}; git push -u origin main`,
        {
          cwd: `${directoryPath}/${repoName}`,
        }
      );
    } else {
      cmd(
        `git add .; git commit -m "feat: adding initial files"; git branch -M main; git remote add origin ${repoUrl}; git push -u origin main`,
        {
          cwd: `${directoryPath}/${repoName}`,
        }
      );
    }
  }

  /**
   * Creates an empty branch and pushes to main
   *
   * @param repoName the repo on which to create a brancn
   * @param octokit an authenticated Octokit instance
   * @param directoryPath name of the directory in which the process is running (i.e., 'workspace' for a container)
   */
  public async _createEmptyBranchAndOpenPR(
    repoName: string,
    octokit: Octokit,
    directoryPath: string,
    apiId: string,
    branchName: string,
    latestSha: string,
    copyTagText: string
  ) {
    await openABranch(repoName, directoryPath);
    await openAPR(octokit, branchName, repoName, apiId, latestSha, copyTagText);
  }

  /**
   * Initializes an empty git repo locally, and creates an empty repo on github
   */
  public async createAndInitializeEmptyGitRepo(directoryPath: string) {
    checkIfGitIsInstalled(cmd);
    await this._createRepo(this.octokit, this.repoName);
    await this._initializeEmptyGitRepo(this.repoName, directoryPath);
  }

  /**
   * Pushes any changes made locally to main and creates an empty PR
   * @param directoryPath name of the directory in which the process is running (i.e., 'workspace' for a container)
   * @param repoUrl the url of the repo to push to; mostly for testing purposes.
   */
  public async pushToMainAndCreateEmptyPR(
    directoryPath: string,
    repoUrl?: string
  ) {
    checkIfGitIsInstalled(cmd);
    const interContainerVars = getWellKnownFileContents(
      directoryPath,
      INTER_CONTAINER_VARS_FILE
    );
    const latestSha = await getLatestShaGoogleapisGen(this.octokit);
    const copyTagText = getCopyTagText(
      latestSha,
      interContainerVars.owlbotYamlPath
    );
    await this._commitAndPushToMain(
      this.repoName,
      directoryPath,
      this.githubToken,
      repoUrl
    );
    await this._createEmptyBranchAndOpenPR(
      this.repoName,
      this.octokit,
      directoryPath,
      this.apiId,
      interContainerVars.branchName,
      latestSha,
      copyTagText
    );
  }
}
