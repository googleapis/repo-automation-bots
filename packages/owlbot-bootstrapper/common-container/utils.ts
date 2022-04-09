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

import {execSync, ExecSyncOptions} from 'child_process';
import {logger} from 'gcf-utils';
import {ORG} from './common-container';
import {uuid} from 'uuidv4';
import {Octokit} from '@octokit/rest';
import * as fs from 'fs';

const BRANCH_NAME_FILE = 'branchName.md';
export const REGENERATE_CHECKBOX_TEXT =
  '- [x] Regenerate this pull request now.';
const BRANCH_NAME_PREFIX = 'owlbot-bootstrapper-initial-PR';

/**
 * Saves the user name and email for owlbot-bootstrapper in git-credentials so as to not need to enter them when pushing using https protocol
 * @param directoryPath name of the directory in which the process is running (i.e., 'workspace' for a container)
 */
export async function setConfig(directoryPath: string) {
  try {
    cmd('git config --global user.name "Googleapis Bootstrapper"');
    cmd(
      'git config --global user.email "googleapis-bootstrapper[bot]@users.noreply.github.com"'
    );
    cmd(
      `git config --global credential.helper 'store --file ${directoryPath}/.git-credentials'`
    );
  } catch (err) {
    logger.error(err as any);
    throw err;
  }
}

/**
 * Opens a new branch on a repo with a UUID, and saves that branch name to a well-known path
 * (/workspace/branchName.md). We need to save this branch to a file for the next container
 * to be able to access and push to it
 *
 * @param repoName name of the repo to open the branch in
 * @param directoryPath name of the directory in which the process is running (i.e., 'workspace' for a container)
 */
export async function openABranch(repoName: string, directoryPath: string) {
  const UUID = uuid().split('-')[4];
  const branchName = `${BRANCH_NAME_PREFIX}-${UUID}`;
  try {
    fs.writeFileSync(`${directoryPath}/branchName.md`, branchName);
    // Need to push an empty commit to  push branch up
    cmd(
      `git checkout -b ${branchName}; git commit --allow-empty -m "initial commit"; git push -u origin ${branchName}`,
      {cwd: `${directoryPath}/${repoName}`}
    );
  } catch (err) {
    logger.error(err as any);
    throw err;
  }
}

/**
 * Opens a new PR on a repo
 *
 * @param octokit an authenticated octokit instance
 * @param branchName the branchname with the UUID
 * @param repoName the name of the repo to open the PR on
 */
export async function openAPR(
  octokit: Octokit,
  branchName: string,
  repoName: string
) {
  try {
    await octokit.rest.pulls.create({
      owner: ORG,
      repo: repoName,
      head: branchName,
      base: 'main',
      title: `feat: add initial files for ${repoName}`,
      body: REGENERATE_CHECKBOX_TEXT,
    });
  } catch (err: any) {
    logger.error(err);
    throw err;
  }
}

/**
 * Opens an issue on a given repo
 *
 * @param octokit an authenticated octokit instance
 * @param repoName the name of the repo to open the PR on
 * @param apiName the name of the API it failed creating a library/PR for
 */
export async function openAnIssue(
  octokit: Octokit,
  repoName: string,
  apiName?: string,
  buildId?: string,
  projectId?: string,
  language?: string,
  errorBody?: string
) {
  try {
    await octokit.rest.issues.create({
      owner: ORG,
      repo: repoName,
      title: `Googleapis Bootstrapper failed creating ${apiName} for ${language}`,
      body: `Check build number ${buildId} in ${projectId} for more details:\n\n${errorBody}`,
    });
  } catch (err: any) {
    logger.error(err);
    throw err;
  }
}

/**
 * Gets the branch name with a UUID
 *
 * @param directoryPath name of the directory in which the process is running (i.e., 'workspace' for a container)
 * @returns the branch name with a UUID from a well-known file path (/workspace/branchName.md)
 * Since a separate container needs the UUID for the branch of the first container,
 * we need to save it in a well-known location that language-specific containers can access later on.
 */
export async function getBranchName(directoryPath: string) {
  try {
    return (
      fs
        .readFileSync(`${directoryPath}/${BRANCH_NAME_FILE}`)
        .toString()
        // Need to remove whitespace from branch name
        .replace(/\s+/g, '')
    );
  } catch (err) {
    logger.error(err as any);
    throw err;
  }
}

export function cmd(command: string, options?: ExecSyncOptions | undefined) {
  logger.info(command);
  try {
    const output = execSync(command, options);
    logger.info(output.toString());
  } catch (err) {
    logger.error((err as any).toString());
    throw err;
  }
}
