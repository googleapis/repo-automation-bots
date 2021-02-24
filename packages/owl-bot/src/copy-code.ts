// Copyright 2021 Google LLC
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

import {promisify} from 'util';
import {readFile} from 'fs';
import * as proc from 'child_process';
import {
  owlBotYamlPath,
  owlBotYamlFromText,
  OwlBotYaml,
  regExpFromYamlString,
} from './config-files';
import path from 'path';
import {v4 as uuidv4} from 'uuid';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import {OctokitParams, octokitFrom, OctokitType} from './octokit-util';
import {core} from './core';
import tmp from 'tmp';
import glob from 'glob';

const readFileAsync = promisify(readFile);

export interface Args extends OctokitParams {
  'source-repo': string;
  'source-repo-commit-hash': string;
  'dest-repo': string;
}

// Creates a function that first prints, then executes a shell command.
type Cmd = (
  command: string,
  options?: proc.ExecSyncOptions | undefined
) => Buffer;
function newCmd(logger = console): Cmd {
  const cmd = (
    command: string,
    options?: proc.ExecSyncOptions | undefined
  ): Buffer => {
    logger.info(command);
    return proc.execSync(command, options);
  };
  return cmd;
}

// Composes a link to the source commit that triggered the copy.
function sourceLinkFrom(sourceRepo: string, sourceCommitHash: string): string {
  return `https://github.com/${sourceRepo}/commit/${sourceCommitHash}`;
}

/**
 * Copies the code from googleapis-gen to the dest repo, and creates a
 * pull request.
 */
export async function copyCodeAndCreatePullRequest(
  args: Args,
  logger = console
): Promise<void> {
  let octokit = await octokitFrom(args);
  if (
    await copyExists(
      octokit,
      args['dest-repo'],
      args['source-repo-commit-hash']
    )
  ) {
    return; // Copy already exists.  Don't copy again.
  }
  const workDir = tmp.dirSync().name;
  logger.info(`Working in ${workDir}`);

  const destDir = path.join(workDir, 'dest');
  const destBranch = 'owl-bot-' + uuidv4();

  const cmd = newCmd(logger);

  // Clone the dest repo.
  cmd(
    `git clone --single-branch "https://github.com/${args['dest-repo']}.git" ${destDir}`
  );

  // Check out a dest branch.
  cmd(`git checkout -b ${destBranch}`, {cwd: destDir});

  const [owner, repo] = args['dest-repo'].split('/');

  try {
    copyCode(
      args['source-repo'],
      args['source-repo-commit-hash'],
      destBranch,
      workDir,
      logger
    );
  } catch (err) {
    if (err.kind === 'BadOwlbotYamlError') {
      logger.error(err);
      // Create a github issue.
      const e = err as BadOwlbotYamlError;
      const sourceLink = sourceLinkFrom(
        args['source-repo'],
        args['source-repo-commit-hash']
      );
      const issue = await octokit.issues.create({
        owner,
        repo,
        title: `${owlBotYamlPath} is missing or defective`,
        body: `While attempting to copy files from\n${sourceLink}\n\n${e.inner}`,
      });
      logger.error(`Created issue ${issue.data.html_url}`);
      return; // Success because we don't want to retry.
    } else {
      throw err;
    }
  }

  // Check for existing pull request one more time before we push.
  const privateKey = await readFileAsync(args['pem-path'], 'utf8');
  const token = await core.getGitHubShortLivedAccessToken(
    privateKey,
    args['app-id'],
    args.installation
  );
  // Octokit token may have expired; refresh it.
  octokit = await core.getAuthenticatedOctokit(token.token);
  if (
    await copyExists(
      octokit,
      args['dest-repo'],
      args['source-repo-commit-hash']
    )
  ) {
    return; // Mid-air collision!
  }

  const githubRepo = await octokit.repos.get({owner, repo});

  // Push to origin.
  cmd(
    `git remote set-url origin https://x-access-token:${token.token}@github.com/googleapis/googleapis-gen.git`
  );
  cmd(`git push origin ${destBranch}`);

  // Create a pull request.
  const pull = await octokit.pulls.create({
    owner,
    repo,
    head: destBranch,
    base: githubRepo.data.default_branch,
  });
  logger.info(`Created pull request ${pull.data.html_url}`);
}

// Thrown when the .OwlBot.yaml error is invalid.
interface BadOwlbotYamlError {
  kind: 'BadOwlbotYamlError';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inner: any; // The inner error that was thrown.
}

/**
 * Copies the code from a source repo to a locally checked out repo.
 *
 * @param sourceRepo usually 'googleapis/googleapis-gen'
 * @param sourceCommitHash the commit hash to copy from googleapis-gen.
 * @param destDir the locally checkout out repo with an .OwlBot.yaml file.
 * @param workDir a working directory where googleapis-gen will be cloned.
 */
export async function copyCode(
  sourceRepo: string,
  sourceCommitHash: string,
  destDir: string | undefined,
  workDir: string,
  logger = console
) {
  destDir = destDir ?? process.cwd();

  // Load the OwlBot.yaml file in dest.
  const yamlPath = path.join(destDir, owlBotYamlPath);
  let yaml: OwlBotYaml;
  try {
    const text = await readFileAsync(yamlPath, 'utf8');
    yaml = owlBotYamlFromText(text);
  } catch (e) {
    const err: BadOwlbotYamlError = {
      kind: 'BadOwlbotYamlError',
      inner: e,
    };
    throw err;
  }

  const cmd = newCmd(logger);
  const sourceDir = path.join(workDir, 'source');
  cmd(
    `git clone --single-branch "https://github.com/${sourceRepo}.git" ${sourceDir}`
  );
  // Check out the specific hash we want to copy from.
  cmd(`git checkout ${sourceCommitHash}`, {cwd: sourceDir});

  copyDirs(sourceDir, destDir, yaml, logger);

  // Commit changes to branch.
  const commitMsgPath = path.resolve(path.join(workDir, 'commit-msg.txt'));
  let commitMsg = cmd('git log -1 --format=%s%n%n%b', {
    cwd: sourceDir,
  }).toString('utf8');
  const sourceLink = sourceLinkFrom(sourceRepo, sourceCommitHash);
  commitMsg += `Source-Link: ${sourceLink}\n`;
  fs.writeFileSync(commitMsgPath, commitMsg);
  cmd('git add -A', {cwd: destDir});
  cmd(`git commit -F "${commitMsgPath}" --allow-empty`, {cwd: destDir});
}

// returns undefined instead of throwing an exception.
function stat(path: string): fs.Stats | undefined {
  try {
    return fs.statSync(path);
  } catch (e) {
    return undefined;
  }
}

/**
 * Copies directories and files specified by yaml.
 * @param sourceDir the path to the source repository directory
 * @param destDir the path to the dest repository directory.
 * @param yaml the OwlBot.yaml file from the dest repository.
 */
export function copyDirs(
  sourceDir: string,
  destDir: string,
  yaml: OwlBotYaml,
  logger = console
): void {
  // Wipe out the existing contents of the dest directory.
  const deadPaths: string[] = [];
  for (const deepCopy of yaml['deep-copy-regex'] ?? []) {
    const rmDest = deepCopy['rm-dest'];
    if (rmDest && stat(destDir)) {
      const rmRegExp = regExpFromYamlString(rmDest);
      const allDestPaths = glob.sync('**', {cwd: destDir});
      deadPaths.push(...allDestPaths.filter(path => rmRegExp.test('/' + path)));
    }
  }
  for (let deadPath of deadPaths) {
    deadPath = path.join(destDir, deadPath);
    if (stat(deadPath)) {
      logger.info(`rm -r ${deadPath}`);
      fs.rmSync(deadPath, {recursive: true});
    }
  }

  // Copy the files from source to dest.
  for (const deepCopy of yaml['deep-copy-regex'] ?? []) {
    const regExp = regExpFromYamlString(deepCopy.source);
    const allSourcePaths = glob.sync('**', {cwd: sourceDir});
    const sourcePathsToCopy = allSourcePaths.filter(path =>
      regExp.test('/' + path)
    );
    for (const sourcePath of sourcePathsToCopy) {
      const fullSourcePath = path.join(sourceDir, sourcePath);
      const relPath = ('/' + sourcePath).replace(regExp, deepCopy.dest);
      const fullDestPath = path.join(destDir, relPath);
      const dirName = path.dirname(fullDestPath);
      if (!stat(dirName)?.isDirectory()) {
        logger.info('mkdir ' + dirName);
        fs.mkdirSync(dirName, {recursive: true});
      }
      logger.info(`cp -r ${fullSourcePath} ${fullDestPath}`);
      fse.copySync(fullSourcePath, fullDestPath, {
        recursive: true,
        overwrite: true,
      });
    }
  }
}

/**
 * Searches for instances of the sourceCommitHash in recent pull requests and commits.
 *
 * @param octokit an octokit instance
 * @param destRepo the repo to search
 * @param sourceCommitHash the string to search for
 */
export async function copyExists(
  octokit: OctokitType,
  destRepo: string,
  sourceCommitHash: string,
  logger = console
): Promise<boolean> {
  const q = `repo:${destRepo}+${sourceCommitHash}`;
  const foundCommits = await octokit.search.commits({q});
  if (foundCommits.data.total_count > 0) {
    logger.info(`Commit with ${sourceCommitHash} exists in ${destRepo}.`);
    return true;
  }
  const found = await octokit.search.issuesAndPullRequests({q});
  for (const item of found.data.items) {
    logger.info(
      `Issue or pull request ${item.number} with ${sourceCommitHash} exists in ${destRepo}.`
    );
    return true;
  }
  // I observed octokit.search.issuesAndPullRequests() not finding recent, open
  // pull requests.  So enumerate them.
  const [owner, repo] = destRepo.split('/');
  const pulls = await octokit.pulls.list({owner, repo, per_page: 100});
  for (const pull of pulls.data) {
    const pos: number = pull.body?.indexOf(sourceCommitHash) ?? -1;
    if (pos >= 0) {
      logger.info(
        `Pull request ${pull.number} with ${sourceCommitHash} exists in ${destRepo}.`
      );
      return true;
    }
  }
  // And enumerate recent issues too.
  const issues = await octokit.issues.listForRepo({owner, repo, per_page: 100});
  for (const issue of issues.data) {
    const pos: number = issue.body?.indexOf(sourceCommitHash) ?? -1;
    if (pos >= 0) {
      logger.info(
        `Issue ${issue.number} with ${sourceCommitHash} exists in ${destRepo}.`
      );
      return true;
    }
  }

  logger.info(`${sourceCommitHash} not found in ${destRepo}.`);
  return false;
}
