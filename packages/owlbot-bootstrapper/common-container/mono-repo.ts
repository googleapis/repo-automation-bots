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

import {Language} from './interfaces';
import {Octokit} from '@octokit/rest';
import {
  getWellKnownFileContents,
  openABranch,
  openAPR,
  cmd,
  checkIfGitIsInstalled,
  INTER_CONTAINER_VARS_FILE,
} from './utils';
import {logger} from 'gcf-utils';

/**
 * Monorepo class
 *
 * @param language the Language of the particular monorepo
 * @param repoToCloneUrl the url for the repo to clone without the preceeding https://, e.g., just github.com/googleapis/nodejs-kms.git
 * @param repoName the name for the repo to clone, i.e., nodejs-kms
 * @param githubToken a short-lived access Github access token
 * @param octokit an instance of Octokit
 */
export class MonoRepo {
  language: Language;
  repoToCloneUrl: string;
  repoName: string;
  githubToken: string;
  apiId: string;
  octokit: Octokit;

  constructor(
    language: Language,
    repoToCloneUrl: string,
    githubToken: string,
    apiId: string,
    octokit: Octokit
  ) {
    this.language = language;
    this.repoToCloneUrl = repoToCloneUrl;
    // Get the repo name from the repoToCloneUrl, i.e. github.com/googleapis/nodejs-kms.git becomes nodejs-kms
    // Or /googleapis/nodejs-kms becomes nodejs-kms
    this.repoName = repoToCloneUrl.match(/\/([\w-]*)(.git|$)/)![1];
    this.githubToken = githubToken;
    this.apiId = apiId;
    this.octokit = octokit;
  }

  /**
   * Clones a repo from github
   *
   * @param githubToken a short-lived access Github access token
   * @param repoToCloneUrl from where to clone the repo
   * @param directoryPath where to clone the repo to
   */
  public async _cloneRepo(
    githubToken: string,
    repoToCloneUrl: string,
    directoryPath: string
  ) {
    const repoToCloneRegexp = /github\.com\/[a-z-]*\/[a-z-]*\.git/;
    const repoToClone = repoToCloneUrl.match(repoToCloneRegexp)?.[0];
    if (!repoToClone) {
      logger.error(
        'repoToClone arg is in the wrong format; must include github.com:orgName/repoName.git'
      );
    }
    if (repoToCloneUrl.includes('github')) {
      cmd(`git clone https://x-access-token:${githubToken}@${repoToClone}`, {
        cwd: directoryPath,
      });
    } else {
      cmd(`git clone ${repoToCloneUrl}`, {cwd: directoryPath});
    }
    logger.info(`Repo ${repoToCloneUrl} cloned`);
  }

  /**
   * Commits changes and pushes them to a new branch in github
   *
   * @param branchName the name of the branch with a UUID
   * @param repoName the name of the repo containing the branch
   * @param directoryPath name of the directory in which the process is running (i.e., 'workspace' for a container)
   */
  public async _commitAndPushToBranch(
    branchName: string,
    repoName: string,
    directoryPath: string
  ) {
    cmd(
      `git add .; git commit -m "feat: initial generation of library"; git push -u origin ${branchName}`,
      {
        cwd: `${directoryPath}/${repoName}`,
      }
    );
  }

  /**
   * Commits changes to a branch, then opens a PR with those changes
   * @param directoryPath name of the directory in which the process is running (i.e., 'workspace' for a container)
   */
  public async pushToBranchAndOpenPR(directoryPath: string) {
    const interContainerVars = getWellKnownFileContents(
      directoryPath,
      INTER_CONTAINER_VARS_FILE
    );
    checkIfGitIsInstalled(cmd);
    await this._commitAndPushToBranch(
      interContainerVars.branchName,
      this.repoName,
      directoryPath
    );
    await openAPR(
      this.octokit,
      interContainerVars.branchName,
      this.repoName,
      this.apiId,
      interContainerVars.owlbotYamlPath
    );
  }

  /**
   * Clones a repository and opens an empty branch in it
   */
  public async cloneRepoAndOpenBranch(directoryPath: string) {
    checkIfGitIsInstalled(cmd);
    await this._cloneRepo(this.githubToken, this.repoToCloneUrl, directoryPath);
    await openABranch(this.repoName, directoryPath);
  }
}
