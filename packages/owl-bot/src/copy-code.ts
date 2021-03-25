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
  toFrontMatchRegExp,
} from './config-files';
import path from 'path';
import {v4 as uuidv4} from 'uuid';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import {OctokitType, OctokitFactory} from './octokit-util';
import tmp from 'tmp';
import glob from 'glob';
import {GithubRepo} from './github-repo';

// This code generally uses Sync functions because:
// 1. None of our current designs including calling this code from a web
//    server or other multi-processing enviornment.
// 2. Calling sync functions yields simpler code.

const readFileAsync = promisify(readFile);

// Creates a function that first prints, then executes a shell command.
export type Cmd = (
  command: string,
  options?: proc.ExecSyncOptions | undefined
) => Buffer;
export function newCmd(logger = console): Cmd {
  const cmd = (
    command: string,
    options?: proc.ExecSyncOptions | undefined
  ): Buffer => {
    logger.info(command);
    return proc.execSync(command, options);
  };
  return cmd;
}

/**
 * Composes a link to the source commit that triggered the copy.
 */
function sourceLinkFrom(sourceCommitHash: string): string {
  return `https://github.com/googleapis/googleapis-gen/commit/${sourceCommitHash}`;
}

/**
 * Copies the code from googleapis-gen to the dest repo, and creates a
 * pull request.
 */
export async function copyCodeAndCreatePullRequest(
  sourceRepo: string,
  sourceRepoCommitHash: string,
  destRepo: GithubRepo,
  octokitFactory: OctokitFactory,
  logger = console
): Promise<void> {
  const workDir = tmp.dirSync().name;
  logger.info(`Working in ${workDir}`);

  const destDir = path.join(workDir, 'dest');
  const destBranch = 'owl-bot-' + uuidv4();

  const cmd = newCmd(logger);

  // Clone the dest repo.
  const cloneUrl = destRepo.getCloneUrl();
  cmd(`git clone --single-branch "${cloneUrl}" ${destDir}`);

  // Check out a dest branch.
  cmd(`git checkout -b ${destBranch}`, {cwd: destDir});

  const owner = destRepo.owner;
  const repo = destRepo.repo;
  let yaml: OwlBotYaml;
  try {
    yaml = await loadOwlBotYaml(destDir);
  } catch (err) {
    logger.error(err);
    // Create a github issue.
    const sourceLink = sourceLinkFrom(sourceRepoCommitHash);
    const octokit = await octokitFactory.getShortLivedOctokit();
    const issue = await octokit.issues.create({
      owner,
      repo,
      title: `${owlBotYamlPath} is missing or defective`,
      body: `While attempting to copy files from
${sourceLink}

After fixing ${owlBotYamlPath}, re-attempt this copy by running the following
command in a local clone of this repo:
\`\`\`
  docker run -v /repo:$(pwd) -w /repo gcr.io/repo-automation-bots/owl-bot -- copy-code \
    --source-repo-commit-hash ${sourceRepoCommitHash}
\`\`\`

${err}`,
    });
    logger.error(`Created issue ${issue.data.html_url}`);
    return; // Success because we don't want to retry.
  }
  await copyCode(
    sourceRepo,
    sourceRepoCommitHash,
    destDir,
    workDir,
    yaml,
    logger
  );

  // Check for existing pull request one more time before we push.
  const token = await octokitFactory.getGitHubShortLivedAccessToken();
  // Octokit token may have expired; refresh it.
  const octokit = await octokitFactory.getShortLivedOctokit(token);
  if (await copyExists(octokit, destRepo, sourceRepoCommitHash)) {
    return; // Mid-air collision!
  }

  const githubRepo = await octokit.repos.get({owner, repo});

  // Push to origin.
  const pushUrl = destRepo.getCloneUrl(token);
  cmd(`git remote set-url origin ${pushUrl}`, {cwd: destDir});
  cmd(`git push origin ${destBranch}`, {cwd: destDir});

  // Use the commit's subject and body as the pull request's title and body.
  const title: string = cmd('git log -1 --format=%s', {
    cwd: destDir,
  })
    .toString('utf8')
    .trim();
  const body: string = cmd('git log -1 --format=%b', {
    cwd: destDir,
  })
    .toString('utf8')
    .trim();

  // Create a pull request.
  const pull = await octokit.pulls.create({
    owner,
    repo,
    title,
    body,
    head: destBranch,
    base: githubRepo.data.default_branch,
  });
  logger.info(`Created pull request ${pull.data.html_url}`);
  await octokit.issues.update({
    owner,
    repo,
    issue_number: pull.data.number,
    labels: ['owl-bot-copy'],
  });
}

/**
 * Loads the OwlBot yaml from the dest directory.  Throws an exception if not found
 * or invalid.
 */
export async function loadOwlBotYaml(destDir: string): Promise<OwlBotYaml> {
  // Load the OwlBot.yaml file in dest.
  const yamlPath = path.join(destDir, owlBotYamlPath);
  const text = await readFileAsync(yamlPath, 'utf8');
  return owlBotYamlFromText(text);
}

/**
 * Clones remote repos.  Returns local repos unchanged.
 * @param repo a full repo name like googleapis/nodejs-vision, or a path to a local directory
 * @param workDir a local directory where the cloned repo will be created
 * @param logger a logger
 * @param depth the depth param to pass to git clone.
 * @returns the path to the local repo.
 */
export function toLocalRepo(
  repo: string,
  workDir: string,
  logger = console,
  depth = 100
): string {
  if (stat(repo)?.isDirectory()) {
    logger.info(`Using local source repo directory ${repo}`);
    return repo;
  } else {
    const [, repoName] = repo.split('/');
    const localDir = path.join(workDir, repoName);
    const cmd = newCmd(logger);
    cmd(
      `git clone --depth=${depth} "https://github.com/${repo}.git" ${localDir}`
    );
    return localDir;
  }
}

/**
 * Copies the code from a source repo to a locally checked out repo.
 *
 * @param sourceRepo usually 'googleapis/googleapis-gen';  May also be a local path
 *   to a git repo directory.
 * @param sourceCommitHash the commit hash to copy from googleapis-gen.
 * @param destDir the locally checkout out repo with an .OwlBot.yaml file.
 * @param workDir a working directory where googleapis-gen will be cloned.
 * @param yaml the yaml file loaded from the destDir
 */
export async function copyCode(
  sourceRepo: string,
  sourceCommitHash: string,
  destDir: string,
  workDir: string,
  yaml: OwlBotYaml,
  logger = console
) {
  const cmd = newCmd(logger);
  const sourceDir = toLocalRepo(sourceRepo, workDir, logger);
  // Check out the specific hash we want to copy from.
  cmd(`git checkout ${sourceCommitHash}`, {cwd: sourceDir});

  copyDirs(sourceDir, destDir, yaml, logger);

  // Commit changes to branch.
  const commitMsgPath = path.resolve(path.join(workDir, 'commit-msg.txt'));
  let commitMsg = cmd('git log -1 --format=%s%n%n%b', {
    cwd: sourceDir,
  }).toString('utf8');
  const sourceLink = sourceLinkFrom(sourceCommitHash);
  commitMsg += `Source-Link: ${sourceLink}\n`;
  fs.writeFileSync(commitMsgPath, commitMsg);
  cmd('git add -A', {cwd: destDir});
  cmd(`git commit -F "${commitMsgPath}" --allow-empty`, {cwd: destDir});
}

// returns undefined instead of throwing an exception.
export function stat(path: string): fs.Stats | undefined {
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
  // Prepare to exclude paths.
  const excludes: RegExp[] = (yaml['deep-preserve-regex'] ?? []).map(x =>
    toFrontMatchRegExp(x)
  );
  const excluded = (path: string) => {
    if (excludes.some(x => x.test(path))) {
      logger.info(`Excluding ${path}.`);
      return true;
    } else {
      return false;
    }
  };

  // Wipe out the existing contents of the dest directory.
  const deadPaths: string[] = [];
  for (const rmDest of yaml['deep-remove-regex'] ?? []) {
    if (rmDest && stat(destDir)) {
      const rmRegExp = toFrontMatchRegExp(rmDest);
      const allDestPaths = glob.sync('**', {cwd: destDir});
      const matchingDestPaths = allDestPaths.filter(path =>
        rmRegExp.test('/' + path)
      );
      deadPaths.push(
        ...matchingDestPaths.filter(path => !excluded('/' + path))
      );
    }
  }
  const deadDirs: string[] = [];
  // Remove files first.
  for (let deadPath of deadPaths) {
    deadPath = path.join(destDir, deadPath);
    if (stat(deadPath)?.isDirectory()) {
      deadDirs.push(deadPath);
    } else {
      logger.info(`rm  ${deadPath}`);
      fs.rmSync(deadPath);
    }
  }
  // Then remove directories.  Some removes may fail because inner files were excluded.
  for (const deadDir of deadDirs) {
    logger.info(`rmdir  ${deadDir}`);
    try {
      fs.rmdirSync(deadDir);
    } catch (e) {
      logger.info(e);
    }
  }

  // Copy the files from source to dest.
  for (const deepCopy of yaml['deep-copy-regex'] ?? []) {
    const regExp = toFrontMatchRegExp(deepCopy.source);
    const allSourcePaths = glob.sync('**', {cwd: sourceDir});
    const sourcePathsToCopy = allSourcePaths.filter(path =>
      regExp.test('/' + path)
    );
    for (const sourcePath of sourcePathsToCopy) {
      const fullSourcePath = path.join(sourceDir, sourcePath);
      const relPath = ('/' + sourcePath).replace(regExp, deepCopy.dest);
      if (excluded(relPath)) {
        continue;
      }
      const fullDestPath = path.join(destDir, relPath);
      if (stat(fullSourcePath)?.isDirectory()) {
        if (!stat(fullDestPath)?.isDirectory()) {
          logger.info('mkdir ' + fullDestPath);
          fs.mkdirSync(fullDestPath, {recursive: true});
        }
        continue;
      }
      logger.info(`cp ${fullSourcePath} ${fullDestPath}`);
      fse.copySync(fullSourcePath, fullDestPath, {
        overwrite: true,
      });
    }
  }
}

/**
 * Searches for instances of the sourceCommitHash in recent pull requests and
 * commits.
 *
 * @param octokit an octokit instance
 * @param destRepo the repo to search
 * @param sourceCommitHash the string to search for
 * @returns true if there's a PR or issue with the commit hash exists
 */
export async function copyExists(
  octokit: OctokitType,
  destRepo: GithubRepo,
  sourceCommitHash: string,
  logger = console
): Promise<boolean> {
  // I observed octokit.search.issuesAndPullRequests() not finding recent, open
  // pull requests.  So enumerate them.
  const owner = destRepo.owner;
  const repo = destRepo.repo;
  const pulls = await octokit.pulls.list({
    owner,
    repo,
    per_page: 100,
    state: 'all',
  });
  for (const pull of pulls.data) {
    const pos: number = pull.body?.indexOf(sourceCommitHash) ?? -1;
    if (pos >= 0) {
      logger.info(
        `Pull request ${pull.number} with ${sourceCommitHash} exists in ${owner}/${repo}.`
      );
      return true;
    }
  }
  // And enumerate recent issues too.
  const issues = await octokit.issues.listForRepo({
    owner,
    repo,
    per_page: 100,
    state: 'all',
  });
  for (const issue of issues.data) {
    const pos: number = issue.body?.indexOf(sourceCommitHash) ?? -1;
    if (pos >= 0) {
      logger.info(
        `Issue ${issue.number} with ${sourceCommitHash} exists in ${owner}/${repo}.`
      );
      return true;
    }
  }

  logger.info(`${sourceCommitHash} not found in ${owner}/${repo}.`);
  return false;
}
