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
import {uuid} from 'uuidv4';
import {Octokit} from '@octokit/rest';
import * as fs from 'fs';
import {InterContainerVars, Language} from './interfaces';

export const INTER_CONTAINER_VARS_FILE = 'interContainerVars.json';
export const REGENERATE_CHECKBOX_TEXT =
  '- [x] Regenerate this pull request now.';
const BRANCH_NAME_PREFIX = 'owlbot-bootstrapper-initial-PR';
export const ORG = 'googleapis';
export const DIRECTORY_PATH = '/workspace';

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
 * Function gets latest commit in googleapis-gen
 * @param octokit authenticated octokit instance
 * @returns most recent sha as a string
 */
export async function getLatestShaGoogleapisGen(octokit: Octokit) {
  const commits = await octokit.paginate(octokit.repos.listCommits, {
    owner: ORG,
    repo: 'googleapis-gen',
  });
  return commits[commits.length - 1].sha;
}

/**
 * Function that compiles all the information for the body of the PR being generated
 * @param octokit authenticated octokit instance
 * @returns full PR text for the PR being created
 */
export async function getPRText(octokit: Octokit, owlbotYamlPath: string) {
  if (!owlbotYamlPath)
    logger.warn('No owlbot yaml path passed from language-container');
  const latestSha = await getLatestShaGoogleapisGen(octokit);
  // Language-specific containers need to provide their path to their new .OwlBot.yaml
  // file, since this container won't know the structure of other repos
  const copyTagInfo = `{"p":"${owlbotYamlPath}","h":"${latestSha}"}`;
  const copyTagInfoEncoded = Buffer.from(copyTagInfo).toString('base64');

  return `${REGENERATE_CHECKBOX_TEXT}\nSource-Link: googleapis/googleapis-gen@${latestSha}\nCopy-Tag:\n${copyTagInfoEncoded}`;
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
  logger.info(`Opening branch ${branchName} on ${repoName}`);
  try {
    const contents = {branchName};
    fs.writeFileSync(
      `${directoryPath}/${INTER_CONTAINER_VARS_FILE}`,
      JSON.stringify(contents, null, 4)
    );
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
  repoName: string,
  apiId: string,
  owlbotYamlPath: string
) {
  try {
    await octokit.rest.pulls.create({
      owner: ORG,
      repo: repoName,
      head: branchName,
      base: 'main',
      title: `feat: add initial files for ${apiId}`,
      body: await getPRText(octokit, owlbotYamlPath),
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
  //eslint-disable-next-line no-useless-escape
  const tokenRedaction = /ghs_[\w\d]*[^@:\/\.]/g;
  try {
    await octokit.rest.issues.create({
      owner: ORG,
      repo: repoName,
      title: `Googleapis Bootstrapper failed creating ${apiName} for ${language}`,
      body: `Check build number ${buildId} in ${projectId} for more details:\n\n${errorBody
        ?.toString()
        .replace(tokenRedaction, '')}`,
    });
  } catch (err: any) {
    logger.error(err.toString().replace(tokenRedaction, ''));
    throw err;
  }
}

/**
 * Gets variables saved to a well-known file passed between containers
 *
 * @param directoryPath name of the directory in which the process is running (i.e., 'workspace' for a container)
 * @param fileNameJSON name of the file that contains the inter-container variables, must be JSON
 * @returns the branch name with a UUID from a well-known file path (/workspace/branchName.md)
 * Since a separate container needs the UUID for the branch of the first container,
 * we need to save it in a well-known location that language-specific containers can access later on.
 */
export function getWellKnownFileContents(
  directoryPath: string,
  fileNameJSON: string
): InterContainerVars {
  try {
    console.log(
      fs.readFileSync(`${directoryPath}/${fileNameJSON}`).toString('utf8')
    );
    return JSON.parse(
      fs.readFileSync(`${directoryPath}/${fileNameJSON}`).toString()
    );
  } catch (err) {
    logger.error(err as any);
    throw err;
  }
}

/**
 * Runs a child process with logging.
 *
 * @param command the command for the child process
 * @param options the options for executing the command (i.e., dir path to execute the cp in)
 */
export function cmd(command: string, options?: ExecSyncOptions | undefined) {
  //eslint-disable-next-line no-useless-escape
  const tokenRedaction = /ghs_[\w\d]*[^@:\/\.]/g;
  logger.info(command.toString().replace(tokenRedaction, ''));
  try {
    const output = execSync(command, options);
    logger.info(output.toString().replace(tokenRedaction, ''));
  } catch (err) {
    logger.error((err as any).toString().replace(tokenRedaction, ''));
    throw err;
  }
}

/**
 * Checks if git is installed before making git-related commands
 */
export function checkIfGitIsInstalled(cmd: Function) {
  try {
    cmd('git --version');
  } catch (err) {
    logger.error(`Error: git not installed: ${err}`);
    throw new Error(`Error: git not installed: ${err}`);
  }
}

/**
 * Returns true if a given language is a mono repo
 *
 * @param language a Language enum (see interfaces)
 */
export function isMonoRepo(language: Language): boolean {
  const monorepos = ['nodejs', 'php', 'dotnet', 'ruby', 'java'];
  if (monorepos.includes(language)) {
    return true;
  }
  return false;
}
