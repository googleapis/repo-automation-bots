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
import {
  owlBotYamlFromText,
  OwlBotYaml,
  toFrontMatchRegExp,
} from './config-files';
import path from 'path';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import {OctokitType, OctokitFactory} from './octokit-util';
import tmp from 'tmp';
import glob from 'glob';
import {OWL_BOT_COPY} from './core';
import {newCmd} from './cmd';
import {
  createPullRequestFromLastCommit,
  EMPTY_REGENERATE_CHECKBOX_TEXT,
  Force,
  REGENERATE_CHECKBOX_TEXT,
  resplit,
  WithRegenerateCheckbox,
  insertApiName,
} from './create-pr';
import {AffectedRepo} from './configs-store';
import {GithubRepo, githubRepoFromOwnerSlashName} from './github-repo';

// This code generally uses Sync functions because:
// 1. None of our current designs including calling this code from a web
//    server or other multi-processing environment.
// 2. Calling sync functions yields simpler code.

const readFileAsync = promisify(readFile);

/**
 * Composes a link to the source commit that triggered the copy.
 */
export function sourceLinkFrom(sourceCommitHash: string): string {
  return `https://github.com/googleapis/googleapis-gen/commit/${sourceCommitHash}`;
}

/**
 * Composes the line we append to a pull request body.
 */
export function sourceLinkLineFrom(sourceLink: string): string {
  return `Source-Link: ${sourceLink}\n`;
}

/**
 * Finds the source link in a pull request body.  Returns the empty string if
 * not found.
 */
export function findSourceHash(prBody: string): string {
  const match =
    /https:\/\/github.com\/googleapis\/googleapis-gen\/commit\/([0-9A-Fa-f]+)/.exec(
      prBody
    );
  return match ? match[1] : '';
}

/**
 * A return value indicating that code was copied into a local branch.
 */
interface LocalCopy {
  kind: 'LocalCopy';
  dir: string; // The local directory of the github repo.
  sourceCommitHash: string; // The commit hash from which the code was copied.
  yaml: OwlBotYaml;
}

/**
 * A return value indicating that the code could not be copied because of a
 * bad .OwlBot.yaml file.  So, a github issue was created.
 */
interface CreatedGithubIssue {
  kind: 'CreatedGithubIssue';
  issue: number;
  link: string;
}

/**
 * Owl bot must avoid creating duplicate pull requests that copy code from
 * googleapis-gen.  Duplicate pull requests would annoy and confuse library
 * maintainers.
 *
 * To avoid creating duplicate pull requests, owl bot creates a unique id,
 * called a copy tag, for each copy operation.
 *
 * Before multiple .OwlBot.yaml files were permitted in a single repo, the
 * commit hash from googleapis-gen effectively functioned as a unique id
 * for the copy operation.  However, with multiple .OwlBot.yamls in a single
 * library repo, the commit hash from googleapis-gen no longer uniquely
 * identifies the copy operation.  There is potentially one copy operation for
 * each .OwlBot.yaml.  Therefore, Owl bot composes a unique copy tag comprising
 * the commit hash from googleapis-gen and the path to owlBotYaml in the library
 * repo.
 *
 * Before creating a copy-code pull request, Owl Bot first checks if a pull
 * request or issue already exists with the same copy tag.  If one exists, then
 * Owl Bot does not create a second, duplicate pull request.
 */

export interface CopyTag {
  // Field names are intentionally terse because this gets serialized and
  // base64-encoded to create the string tag.
  p: string; // The path to .OwlBot.yaml
  h: string; // The source commit hash.
}

export function copyTagFrom(
  owlBotYamlPath: string,
  sourceCommitHash: string
): string {
  const tag: CopyTag = {
    p: owlBotYamlPath,
    h: sourceCommitHash,
  };
  const text = JSON.stringify(tag);
  return Buffer.from(text).toString('base64');
}

export function unpackCopyTag(copyTag: string): CopyTag {
  const json = Buffer.from(copyTag, 'base64').toString();
  const obj = JSON.parse(json);
  if (typeof obj.p === 'string' && typeof obj.h === 'string') {
    return obj as CopyTag;
  } else {
    throw new Error(`malformed Copy Tag: ${obj}`);
  }
}

/**
 * Precedes the copy tag in a body of a git commit message.
 */
const copyTagFooter = 'Copy-Tag: ';

/**
 * Finds a copy tag footer in the body of a git commit message.
 */
export function bodyIncludesCopyTagFooter(body: string): boolean {
  return !!findCopyTag(body);
}

/**
 * When there are multiple, returns the first one.
 */
export function findCopyTag(body: string): string {
  const match = /.*Copy-Tag:\s*([A-Za-z0-9+/=]+).*/.exec(body);
  if (match) {
    return match[1];
  } else {
    return '';
  }
}

/**
 * Copies the code from googleapis-gen to the dest repo, and creates a
 * pull request.
 * @param sourceRepo: the source repository, either a local path or googleapis/googleapis-gen
 * @param sourceRepoCommit: the commit from which to copy code. Empty means the most recent commit.
 * @param destRepo: the destination repository, either a local path or a github path like googleapis/nodejs-vision.
 * @param destBranch: the name of the branch to create in the dest repo.
 * @param cloneBranch: the name of the branch to clone in the dest repo.  Default is the repo's default branch.
 */
export async function copyCodeIntoLocalBranch(
  sourceRepo: string,
  sourceRepoCommitHash: string,
  destRepo: AffectedRepo,
  destBranch: string,
  octokitFactory: OctokitFactory,
  cloneBranch?: string,
  logger = console
): Promise<LocalCopy | CreatedGithubIssue> {
  const workDir = tmp.dirSync().name;
  logger.info(`Working in ${workDir}`);

  const destDir = path.join(workDir, 'dest');

  const cmd = newCmd(logger);

  // Clone the dest repo.
  const cloneUrl = destRepo.repo.getCloneUrl(
    await octokitFactory.getGitHubShortLivedAccessToken()
  );
  if (cloneBranch) {
    cmd(`git clone --single-branch -b ${cloneBranch} "${cloneUrl}" ${destDir}`);
    cmd(`git branch -m ${destBranch}`, {cwd: destDir});
  } else {
    cmd(`git clone --single-branch "${cloneUrl}" ${destDir}`);
    cmd(`git checkout -b ${destBranch}`, {cwd: destDir});
  }

  const copyTagLine =
    copyTagFooter + copyTagFrom(destRepo.yamlPath, sourceRepoCommitHash) + '\n';
  const loaded = await loadOwlBotYamlOrOpenGithubIssue(
    destRepo,
    destDir,
    octokitFactory,
    copyTagLine,
    sourceRepoCommitHash,
    logger
  );
  if (loaded.kind === 'CreatedGithubIssue') {
    return loaded;
  } else {
    const yaml = loaded.yaml;
    const {sourceCommitHash, commitMsgPath} = await copyCode(
      sourceRepo,
      sourceRepoCommitHash,
      destDir,
      workDir,
      yaml,
      logger
    );
    cmd('git add -A', {cwd: destDir});
    fs.appendFileSync(commitMsgPath, copyTagLine);
    cmd(`git commit -F "${commitMsgPath}" --allow-empty`, {cwd: destDir});
    return {
      kind: 'LocalCopy',
      dir: destDir,
      sourceCommitHash,
      yaml,
    };
  }
}

/** Possible return value for loadOwlBotYamlOrOpenGithubIssue() */
interface LoadedYaml {
  kind: 'LoadedYaml';
  yaml: OwlBotYaml;
}

/**
 * Loads a yaml from from a local directory.  Creates a github issue if
 * it failed to load.
 * @param destRepo the destination repository.
 * @param destDir the local directory where destRepo has been cloned.
 * @param copyTagLine the copy tag to include in the github error message.
 * @param sourceRepoCommitHash included in the github error message.
 */
export async function loadOwlBotYamlOrOpenGithubIssue(
  destRepo: AffectedRepo,
  destDir: string,
  octokitFactory: OctokitFactory,
  copyTagLine: string,
  sourceRepoCommitHash: string,
  logger = console
): Promise<LoadedYaml | CreatedGithubIssue> {
  try {
    const loaded: LoadedYaml = {
      kind: 'LoadedYaml',
      yaml: await loadOwlBotYaml(path.join(destDir, destRepo.yamlPath)),
    };
    return loaded;
  } catch (err) {
    logger.error(err);
    // Create a github issue.
    const sourceLink = sourceLinkFrom(sourceRepoCommitHash);
    const octokit = await octokitFactory.getShortLivedOctokit();
    const issue = await octokit.issues.create({
      owner: destRepo.repo.owner,
      repo: destRepo.repo.repo,
      title: `${destRepo.yamlPath} is missing or defective`,
      body: `While attempting to copy files from
${sourceLink}

After fixing ${destRepo.yamlPath}, re-attempt this copy by running the following
command in a local clone of this repo:
\`\`\`
  docker run -v /repo:$(pwd) -w /repo gcr.io/repo-automation-bots/owl-bot -- copy-code \
    --source-repo-commit-hash ${sourceRepoCommitHash}
\`\`\`

${err}

${copyTagLine}`,
    });
    logger.error(`Created issue ${issue.data.html_url}`);
    const result: CreatedGithubIssue = {
      kind: 'CreatedGithubIssue',
      issue: issue.data.number,
      link: issue.data.html_url,
    };
    return result;
  }
}

/**
 * Replace characters that cannot be in a branch name with an underscore.
 *
 * More conservative than perfect implementation described here:
 * https://stackoverflow.com/questions/3651860/which-characters-are-illegal-within-a-branch-name
 * but I don't expect name collisions anyway so conservative is fine.
 */
export function toSafeBranchName(s: string): string {
  return s.replace(/[^A-Za-z0-9-]/g, '_');
}

/**
 * Converts a yaml path like '/Speech/.OwlBot.yaml' to a branch name
 * like 'owl-bot-copy-Speech', into which we'll copy the code.
 */
export function branchNameForCopy(yamlPath: string): string {
  // Assume it's a well formed unix path.  I think that's a safe assumpting
  // for the repos we own.
  const chunks = yamlPath.split(/\//).filter(Boolean);
  if (chunks.length === 2 && chunks[0] === '.github') {
    // A mono repo where there's only one .OwlBot.yaml
    return 'owl-bot-copy';
  } else {
    return [
      'owl-bot-copy',
      ...chunks.slice(0, chunks.length - 1).map(toSafeBranchName),
    ].join('-');
  }
}

export interface AppendedPullRequest {
  kind: 'AppendedPullRequest';
  /** Link to the pull request. */
  link: string;
}

/**
 * Copies the code from googleapis-gen into a local clone of dest repo.
 * If there's an existing pull request, pushes the new commit.
 *
 * @param sourceRepo: the source repository, either a local path or googleapis/googleapis-gen
 * @param sourceRepoCommit: the commit from which to copy code. Empty means the most recent commit.
 * @param destRepo: the destination repository, either a local path or a github path like googleapis/nodejs-vision.
 * @returns AppendedPullRequest when it appended an existing pull request.
 *          LocalCopy when there wasn't an existing pull request to append.
 *          CreatedGithubIssue when there was an error.
 */
async function copyCodeAndAppendPullRequest(
  sourceRepo: string,
  sourceRepoCommitHash: string,
  destRepo: AffectedRepo,
  octokitFactory: OctokitFactory,
  logger = console
): Promise<AppendedPullRequest | LocalCopy | CreatedGithubIssue> {
  const destBranch = branchNameForCopy(destRepo.yamlPath);
  const octokit = await octokitFactory.getShortLivedOctokit();

  // Is there a pull request open with the branch name?
  const pulls = await octokit.pulls.list({
    owner: destRepo.repo.owner,
    repo: destRepo.repo.repo,
    state: 'open',
    head: `${destRepo.repo.owner}:${destBranch}`,
  });
  let cloneBranch: string | undefined;
  if (pulls.data.length > 0) {
    logger.info(`Appending ${pulls.data[0].html_url} with a new commit.`);
    cloneBranch = destBranch;
  }
  const whatHappened = await copyCodeIntoLocalBranch(
    sourceRepo,
    sourceRepoCommitHash,
    destRepo,
    destBranch,
    octokitFactory,
    cloneBranch,
    logger
  );
  if (whatHappened.kind === 'CreatedGithubIssue') {
    return whatHappened;
  }
  if (cloneBranch) {
    const pull = pulls.data[0];
    // Push the new commit to the existing pull request.
    const token = await octokitFactory.getGitHubShortLivedAccessToken();
    const pushUrl = destRepo.repo.getCloneUrl(token);
    const cmd = newCmd(logger);
    cmd(`git remote set-url origin ${pushUrl}`, {cwd: whatHappened.dir});
    cmd(`git push origin ${destBranch}`, {cwd: whatHappened.dir});
    // Prepend the new commit message to the body.
    try {
      const commitBody: string = cmd('git log -1 --format=%B', {
        cwd: whatHappened.dir,
      })
        .toString('utf8')
        .trim();
      const {title, body} = resplit(
        `${commitBody}\n\n` +
          `${pull.title}\n` +
          pull.body
            ?.replace(REGENERATE_CHECKBOX_TEXT, '')
            .replace(EMPTY_REGENERATE_CHECKBOX_TEXT, '')
            .trim() ?? '',
        WithRegenerateCheckbox.Yes
      );
      await octokit.pulls.update({
        owner: destRepo.repo.owner,
        repo: destRepo.repo.repo,
        pull_number: pull.number,
        title,
        body,
      });
    } catch (e) {
      // Catch the error because we still want to return the url of the
      // pull request that we did indeed push new commits to.
      console.error(e);
    }
    return {kind: 'AppendedPullRequest', link: pulls.data[0].html_url};
  } else {
    return whatHappened;
  }
}

/**
 * Copies the code from googleapis-gen to the dest repo, and adds commits
 * to an existing pull request if there's one open.  Otherwise, creates a new
 * pull request.
 *
 * In time, this will completely replace copyCodeAndCreatePullRequest().
 *
 * @param sourceRepo: the source repository, either a local path or googleapis/googleapis-gen
 * @param sourceRepoCommit: the commit from which to copy code. Empty means the most recent commit.
 * @param destRepo: the destination repository, either a local path or a github path like googleapis/nodejs-vision.
 * @returns a link to the pull request or github issue.
 */
export async function copyCodeAndAppendOrCreatePullRequest(
  sourceRepo: string,
  sourceRepoCommitHash: string,
  destRepo: AffectedRepo,
  octokitFactory: OctokitFactory,
  logger = console
): Promise<string> {
  const whatHappened = await copyCodeAndAppendPullRequest(
    sourceRepo,
    sourceRepoCommitHash,
    destRepo,
    octokitFactory,
    logger
  );
  if (
    whatHappened.kind === 'AppendedPullRequest' ||
    whatHappened.kind === 'CreatedGithubIssue'
  ) {
    return whatHappened.link;
  }
  // Push the new commit to the existing pull request.
  const destBranch = branchNameForCopy(destRepo.yamlPath);
  logger.info(`Creating new branch ${destBranch}`);
  const token = await octokitFactory.getGitHubShortLivedAccessToken();
  const pushUrl = destRepo.repo.getCloneUrl(token);

  // Create a pull request.
  return await createPullRequestFromLastCommit(
    destRepo.repo.owner,
    destRepo.repo.repo,
    whatHappened.dir,
    destBranch,
    pushUrl,
    [OWL_BOT_COPY],
    await octokitFactory.getShortLivedOctokit(token),
    WithRegenerateCheckbox.Yes,
    whatHappened.yaml['api-name'] ?? '',
    Force.Yes,
    logger
  );
}

/**
 * Loads the copy tag.  If for some reason it fails, reports the reason on
 * the pull request and returns undefined.
 */
async function loadCopyTagOrCommentOnPullRequest(
  commitText: string,
  octokit: OctokitType,
  destRepo: GithubRepo,
  pull: {number: number; html_url: string},
  logger = console
): Promise<CopyTag | undefined> {
  const reportError = async (error: string) => {
    logger.error(`Error in ${pull.html_url}:\n${error}`);
    await octokit.pulls.createReviewComment({
      owner: destRepo.owner,
      repo: destRepo.repo,
      pull_number: pull.number,
      body: error,
    });
  };
  const copyTagText = findCopyTag(commitText);
  if (!copyTagText) {
    reportError(
      "I couldn't find a copy-tag in the commit message.  Ask Yoshi team for help."
    );
    return undefined;
  }
  try {
    return unpackCopyTag(copyTagText);
  } catch (e) {
    reportError(
      `Corrupt copy-tag found in the commit message.  Ask Yoshi team for help.\n${copyTagText}.`
    );
    return undefined;
  }
}

/**
 * Regenerates a pull request.
 * Uses `git push -f` to completely replace the existing contents of the branch.
 *
 * This is quite complicated because the PR may have multiple open commits.
 * Regenerating the pull request will result in a single commit.  We need
 * to preserve the full history of all the commits.
 *
 * In time, this will completely replace copyCodeIntoPullRequest().
 *
 * @param sourceRepo: the source repository, either a local path or googleapis/googleapis-gen
 * @param destRepo: the destination repository, either a local path or a github path like googleapis/nodejs-vision.
 */
export async function regeneratePullRequest(
  sourceRepo: string,
  destRepo: AffectedRepo,
  destBranch: string,
  octokitFactory: OctokitFactory,
  logger = console
): Promise<void> {
  const workDir = tmp.dirSync().name;
  logger.info(`Working in ${workDir}`);
  const destDir = path.join(workDir, 'dest');
  const cmd = newCmd(logger);
  let token = await octokitFactory.getGitHubShortLivedAccessToken();

  // Clone the dest repo.
  const cloneUrl = destRepo.repo.getCloneUrl(token);
  cmd(`git clone  "${cloneUrl}" ${destDir}`);
  const mainBranch = cmd('git branch --show-current', {cwd: destDir})
    .toString('utf-8')
    .trim();

  // Find the most recent common ancestor between the main branch and the
  // pull request branch.
  const ancestor = cmd(`git merge-base origin/${destBranch} ${mainBranch}`, {
    cwd: destDir,
  })
    .toString('utf-8')
    .trim();

  // Create a single commit message by combining the multiple commit messages
  // in the pull request.
  const commitMsgBuf = cmd(
    `git log ${ancestor}..origin/${destBranch} --format=%B`,
    {cwd: destDir}
  );
  const commitMsgFilePath = path.join(workDir, 'commit.txt');
  fs.writeFileSync(commitMsgFilePath, commitMsgBuf);
  const commitMsg = commitMsgBuf.toString('utf-8');

  // Find the corresponding pull request because we'll either have to update
  // its body or add a comment describing failure.
  let octokit = await octokitFactory.getShortLivedOctokit(token);
  const pulls = await octokit.pulls.list({
    owner: destRepo.repo.owner,
    repo: destRepo.repo.repo,
    state: 'open',
    head: `${destRepo.repo.owner}:${destBranch}`,
  });
  if (pulls.data.length < 1) {
    logger.error(
      `Failed to find pull request for ${destRepo.repo}:${destBranch}`
    );
    return;
  }
  const pull = pulls.data[0];

  // Find the copy tag so we know which commit hash to copy from.
  const copyTag = await loadCopyTagOrCommentOnPullRequest(
    commitMsg,
    octokit,
    destRepo.repo,
    pull,
    logger
  );
  if (!copyTag) {
    return;
  }
  const sourceRepoCommitHash = copyTag.h;

  cmd(`git checkout -b ${destBranch}`, {cwd: destDir});

  // Load the yaml so we know which code to copy.
  const copyTagLine =
    copyTagFooter + copyTagFrom(destRepo.yamlPath, sourceRepoCommitHash) + '\n';
  const loaded = await loadOwlBotYamlOrOpenGithubIssue(
    destRepo,
    destDir,
    octokitFactory,
    copyTagLine,
    sourceRepoCommitHash,
    logger
  );
  if (loaded.kind !== 'LoadedYaml') {
    return;
  }

  // Copy the files specified in the yaml.
  await copyCode(
    sourceRepo,
    sourceRepoCommitHash,
    destDir,
    workDir,
    loaded.yaml,
    logger
  );

  // Commit the newly copied code.
  cmd('git add -A', {cwd: destDir});
  cmd(`git commit -F "${commitMsgFilePath}" --allow-empty`, {cwd: destDir});

  // Refresh the token because copyCode() may have taken a while.
  token = await octokitFactory.getGitHubShortLivedAccessToken();
  octokit = await octokitFactory.getShortLivedOctokit(token);

  // Force push the code to the pull request branch.
  const pushUrl = destRepo.repo.getCloneUrl(token);
  cmd(`git remote set-url origin ${pushUrl}`, {cwd: destDir});
  cmd(`git push -f origin ${destBranch}`, {cwd: destDir});

  // Update the PR body with the full commit history.
  const {title, body} = resplit(commitMsg, WithRegenerateCheckbox.Yes);
  await octokit.pulls.update({
    owner: destRepo.repo.owner,
    repo: destRepo.repo.repo,
    pull_number: pull.number,
    title: insertApiName(title, loaded.yaml['api-name'] ?? ''),
    body,
  });
}

/**
 * Loads the OwlBot yaml from the dest directory.  Throws an exception if not found
 * or invalid.
 */
export async function loadOwlBotYaml(yamlPath: string): Promise<OwlBotYaml> {
  // Load the OwlBot.yaml file in dest.
  const text = await readFileAsync(yamlPath, 'utf8');
  return owlBotYamlFromText(text);
}

/**
 * Clones remote repos.  Returns local repos unchanged.
 * @param repo a full repo name like googleapis/nodejs-vision, or a path to a local directory
 * @param workDir a local directory where the cloned repo will be created
 * @param logger a logger
 * @param depth the depth param to pass to git clone.
 * @param accessToken use this access token when cloning the repo.
 * @returns the path to the local repo.
 */
export function toLocalRepo(
  repo: string,
  workDir: string,
  logger = console,
  depth = 100,
  accessToken = ''
): string {
  if (stat(repo)?.isDirectory()) {
    logger.info(`Using local source repo directory ${repo}`);
    return repo;
  } else {
    const githubRepo = githubRepoFromOwnerSlashName(repo);
    const localDir = path.join(workDir, githubRepo.repo);
    const url = githubRepo.getCloneUrl(accessToken);
    const cmd = newCmd(logger);
    cmd(`git clone --depth=${depth} "${url}" ${localDir}`);
    return localDir;
  }
}

/**
 * Copies the code from a source repo to a locally checked out repo.
 *
 * @param sourceRepo usually 'googleapis/googleapis-gen';  May also be a local path
 *   to a git repo directory.
 * @param sourceCommitHash the commit hash to copy from googleapis-gen; pass
 *   the empty string to use the most recent commit hash in sourceRepo.
 * @param destDir the locally checkout out repo with an .OwlBot.yaml file.
 * @param workDir a working directory where googleapis-gen will be cloned.
 * @param yaml the yaml file loaded from the destDir
 * @returns the commit hash from which code was copied. That will match sourceCommitHash
 *    parameter if it was provided.  If not, it will be the most recent commit from
 *    the source repo.  Also returns the path to the text file to use as a
 *    commit message for a pull request.
 */
export async function copyCode(
  sourceRepo: string,
  sourceCommitHash: string,
  destDir: string,
  workDir: string,
  yaml: OwlBotYaml,
  logger = console
): Promise<{sourceCommitHash: string; commitMsgPath: string}> {
  const cmd = newCmd(logger);
  const sourceDir = toLocalRepo(sourceRepo, workDir, logger);
  // Check out the specific hash we want to copy from.
  if ('none' === sourceCommitHash) {
    // User is running copy-code from command line.  The path specified by
    // sourceRepo is not a repo.  It's a bazel-bin directory, so there's
    // no corresponding commit hash, and that's ok.
  } else if (sourceCommitHash) {
    // User provided us a commithash.  Checkout that version.
    cmd(`git checkout ${sourceCommitHash}`, {cwd: sourceDir});
  } else {
    // User wants to use the latest commit in the repo.  Get its commit hash.
    sourceCommitHash = cmd('git log -1 --format=%H', {cwd: sourceDir})
      .toString('utf8')
      .trim();
  }

  copyDirs(sourceDir, destDir, yaml, logger);

  // Commit changes to branch.
  const commitMsgPath = path.resolve(path.join(workDir, 'commit-msg.txt'));
  let commitMsg = cmd('git log -1 --format=%B', {
    cwd: sourceDir,
  }).toString('utf8');
  const sourceLink = sourceLinkFrom(sourceCommitHash);
  commitMsg += sourceLinkLineFrom(sourceLink);
  fs.writeFileSync(commitMsgPath, commitMsg);
  logger.log(`Wrote commit message to ${commitMsgPath}`);
  return {sourceCommitHash, commitMsgPath};
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
  const allDestPaths = glob.sync('**', {
    cwd: destDir,
    dot: true,
    ignore: ['.git', '.git/**'],
  });
  for (const rmDest of yaml['deep-remove-regex'] ?? []) {
    if (rmDest && stat(destDir)) {
      const rmRegExp = toFrontMatchRegExp(rmDest);
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
    const deadStat = stat(deadPath);
    if (deadStat?.isDirectory()) {
      deadDirs.push(deadPath);
    } else if (deadStat) {
      logger.info(`rm  ${deadPath}`);
      fs.rmSync(deadPath);
    }
  }
  // Then remove directories.  Some removes may fail because inner files were excluded.
  // Sort the directories longest name first, so that child directories are
  // removed before parent directories.
  deadDirs.sort((a, b) => b.length - a.length);
  for (const deadDir of deadDirs) {
    logger.info(`rmdir  ${deadDir}`);
    try {
      fs.rmdirSync(deadDir);
    } catch (e) {
      logger.info(e);
    }
  }

  // Copy the files from source to dest.
  const allSourcePaths = glob.sync('**', {
    cwd: sourceDir,
    dot: true,
    ignore: ['.git', '.git/**'],
  });
  for (const deepCopy of yaml['deep-copy-regex'] ?? []) {
    const regExp = toFrontMatchRegExp(deepCopy.source);
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
