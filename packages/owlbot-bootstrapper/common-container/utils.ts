import {execSync} from 'child_process';
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
 */
export async function setConfig(directoryPath: string) {
  try {
    execSync('git config --global user.name "Googleapis Bootstrapper"');
    execSync(
      'git config --global user.email "googleapis-bootstrapper[bot]@users.noreply.github.com"'
    );
    execSync(
      `git config --global credential.helper 'store --file ${directoryPath}/.git-credentials'`
    );
  } catch (err) {
    logger.error(err as any);
    throw err;
  }
}

/**
 * Opens a new branch on a repo with a UUID, and saves that branch name to a well-known path
 * Need to save this branch to a file for the new environment to access it
 *
 * @param repoName name of the repo to open the branch in
 */
export async function openABranchUtils(
  repoName: string,
  directoryPath: string
) {
  const UUID = uuid().split('-')[4];
  const branchName = `${BRANCH_NAME_PREFIX}-${UUID}`;
  try {
    execSync(`echo '${branchName}' >> branchName.md`, {cwd: directoryPath});
    // Need to push an empty commit to  push branch up
    execSync(
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
export async function openAPRUtils(
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
 * Gets the branch name with a UUID
 *
 * @returns the branch name with a UUID from a well-known file path
 */
export async function getBranchNameUtils(directoryPath: string) {
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
