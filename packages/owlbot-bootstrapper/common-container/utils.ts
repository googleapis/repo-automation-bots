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
import {InterContainerVars} from './interfaces';

export const ORG = 'googleapis';
export const OWLBOT_LABEL = 'owlbot:copy-code';
const BRANCH_NAME_PREFIX = 'owlbot-bootstrapper-initial-PR';

/**
 * Saves the user name and email for owlbot-bootstrapper in git-credentials so as to not need to enter them when pushing using https protocol
 * @param directoryPath name of the directory in which the process is running (i.e., 'workspace' for a container); defaults to root
 */
export async function setConfig(directoryPath?: string) {
  try {
    cmd('git config --global user.name "Owlbot Bootstrapper"');
    cmd(
      'git config --global user.email "owlbot-bootstrapper[bot]@users.noreply.github.com"'
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
export async function getLatestShaGoogleapisGen(
  octokit: Octokit
): Promise<string> {
  const commits = await octokit.paginate('GET /repos/{owner}/{repo}/commits', {
    owner: ORG,
    repo: 'googleapis-gen',
  });
  return commits[0].sha;
}

/**
 * Function that gets the necessary copy tag text for owlbot
 * @param latestSha of googleapis/googleapis
 * @param owlbotYamlPath the path to the new OwlBot.yaml file
 * @returns the copy -tag text
 */
export function getCopyTagText(
  latestSha: string,
  owlbotYamlPath: string
): string {
  if (!owlbotYamlPath)
    logger.warn('No owlbot yaml path passed from language-container');
  // Language-specific containers need to provide their path to their new .OwlBot.yaml
  // file, since this container won't know the structure of other repos
  const copyTagInfo = `{"p":"${owlbotYamlPath}","h":"${latestSha}"}`;
  const copyTagInfoEncoded = Buffer.from(copyTagInfo).toString('base64');

  return `Copy-Tag: ${copyTagInfoEncoded}`;
}
/**
 * Function that compiles all the information for the body of the PR being generated
 * @param latestSha of googleapis/googleapis
 * @param copyTagText the copy-tag text owlbot needs to update the PR
 * @returns full PR text for the PR being created
 */
export function getPRText(
  latestSha: string,
  copyTagText: string,
  sourceCl: number
): string {
  return `Source-Link: https://github.com/googleapis/googleapis-gen/commit/${latestSha}
${copyTagText}
PiperOrigin-RevId: ${sourceCl}`;
}

/**
 * Opens a new branch on a repo with a UUID
 *
 * @param repoName name of the repo to open the branch in
 * @param monoRepoPath full path to mono repo
 * @returns name of the branch that was opened
 */
export async function openABranch(repoName: string, monoRepoPath: string) {
  const UUID = uuid().split('-')[4];
  const branchName = `${BRANCH_NAME_PREFIX}-${UUID}`;
  logger.info(`Opening branch ${branchName} on ${repoName}`);
  try {
    // Need to push an empty commit to  push branch up
    cmd(
      `git checkout -b ${branchName}; git commit --allow-empty -m "feat: initial commit"; git push -u origin ${branchName}`,
      {cwd: monoRepoPath}
    );
    return branchName;
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
 * @param apiId unique identifier of API
 * @param latestSha latest sha of googleapis/googleapis (for copy-tag text)
 * @param copyTagText copy tag text for owlbot to update PR
 */
export async function openAPR(
  octokit: Octokit,
  branchName: string,
  repoName: string,
  apiId: string,
  latestSha: string,
  copyTagText: string,
  sourceCl: number
): Promise<number> {
  try {
    const defaultBranch = (await getRepoMetadata(ORG, repoName, octokit))
      .default_branch;
    const title = `feat: add initial files for ${apiId}`;
    const body = getPRText(latestSha, copyTagText, sourceCl);
    const pr = await octokit.rest.pulls.create({
      owner: ORG,
      repo: repoName,
      head: branchName,
      base: defaultBranch,
      title,
      body,
    });

    return pr.data.number;
  } catch (err: any) {
    logger.error(err);
    throw err;
  }
}

/**
 * Adds an owlbot copy-code label to PR.
 *
 * @param octokit an authenticated octokit instance
 * @param repo the name of the repo
 * @param prNumber the number of the PR to open.
 */
export async function addOwlBotLabel(
  octokit: Octokit,
  repo: string,
  prNumber: number
) {
  await octokit.issues.addLabels({
    owner: ORG,
    repo,
    issue_number: prNumber,
    labels: [OWLBOT_LABEL],
  });
}

/**
 * Opens an issue on a given repo
 *
 * @param octokit an authenticated octokit instance
 * @param repoOrg the name of the org of the repo
 * @param repoName the name of the repo to open the PR on
 * @param apiName the name of the API it failed creating a library/PR for
 * @param buildId the ID of the cloud build build in GCP
 * @param projectId the project ID where the trigger was run
 * @param language the language which failed
 * @param errorBody the error, with token information redacted
 */
export async function openAnIssue(
  octokit: Octokit,
  repoOrg: string,
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
      owner: repoOrg,
      repo: repoName,
      title: `Owlbot Bootstrapper failed creating ${apiName} for ${language}`,
      body: `Check build number ${buildId} in ${projectId} for more details:\n\n${errorBody
        ?.toString()
        .replace(tokenRedaction, '')}`,
    });
  } catch (err: any) {
    logger.error(err.toString().replace(tokenRedaction, ''));
    throw err;
  }
}

export async function getRepoMetadata(
  owner: string,
  repo: string,
  octokit: Octokit
) {
  return (await octokit.rest.repos.get({owner, repo})).data;
}

/**
 * Gets JSON saved to a well-known file passed between containers
 *
 * @param interContainerVarsFilePath the absolute path where the well-known file lives
 * @returns JSON-parsed info from a well-known file path
 * Since a separate container needs the UUID for the branch of the first container,
 * we need to save it in a well-known location that language-specific containers can access later on.
 */
export function getWellKnownFileContents(
  interContainerVarsFilePath: string
): InterContainerVars {
  try {
    return JSON.parse(fs.readFileSync(interContainerVarsFilePath).toString());
  } catch (err) {
    if ((err as any).toString().includes('Unexpected token')) {
      throw new Error('interContainerVars file must be valid JSON');
    }
    logger.error(err as any);
    throw err;
  }
}

/**
 * Writes any object to the interContainerVars.json file without overwriting
 * current information
 *
 * @param objectToWrite Any JSON object that will be written to the interContainerVars.json file
 * @param directoryPath local directory in which it is running
 */
export async function writeToWellKnownFile(
  objectToWrite: {},
  interContainerVarsFilePath: string
) {
  let contents = {};
  if (fs.existsSync(interContainerVarsFilePath)) {
    contents = getWellKnownFileContents(interContainerVarsFilePath);
  }

  Object.assign(contents, objectToWrite);
  fs.writeFileSync(
    interContainerVarsFilePath,
    JSON.stringify(contents, null, 4)
  );
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
