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

import {isDeepStrictEqual, promisify} from 'util';
import {readFile} from 'fs';
import {
  owlBotYamlFromText,
  OwlBotYaml,
  toFrontMatchRegExp,
} from './config-files';
import path from 'path';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import {OctokitFactory} from './octokit-util';
import tmp from 'tmp';
import glob from 'glob';
import {OWL_BOT_COPY} from './core';
import {newCmd} from './cmd';
import {
  createPullRequestFromLastCommit,
  Force,
  resplit,
  WithRegenerateCheckbox,
  insertApiName,
  prependCommitMessage,
  WithNestedCommitDelimiters,
} from './create-pr';
import {GithubRepo, githubRepoFromOwnerSlashName} from './github-repo';
import {CopyStateStore} from './copy-state-store';
import * as crypto from 'crypto';
import {Logger} from './logger';
import {ExecSyncOptions} from 'child_process';

// OwlBot only functions on an allow list of organizations,
// this list must be updated to support a new org:
const ORG_ALLOW_LIST = ['googleapis', 'googlecloudplatform'];
export class InvalidOrgError extends Error {}
function hasValidOrg(url: string) {
  for (const org of ORG_ALLOW_LIST) {
    if (url.toLowerCase().indexOf(`/${org}`) !== -1) return true;
  }
  return false;
}

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
  return `Source-Link: ${sourceLink}`;
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
  return findCopyTags(body).length > 0;
}

/**
 * Returns all the copy tags in the same order they appeared in the body.
 */
export function findCopyTags(body: string): string[] {
  const lines = body.split(/(\r|\n)+/);
  const tags: string[] = [];
  const regexp = /\s*Copy-Tag:\s*([A-Za-z0-9+/=]+).*/;
  for (const line of lines) {
    const match = regexp.exec(line);
    if (match) {
      tags.push(match[1]);
    }
  }
  return tags;
}

/**
 * Copies code from googleapis-gen into a local directory and creates a
 * git commit.
 *
 * @param yamlPaths paths to .OwlBot.yaml files that specify which files to copy.
 * @param reportError gets invoked if a yaml can't be loaded
 */
export async function copyCodeIntoCommit(
  params: WorkingCopyParams,
  yamlPaths: string[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reportError: (error: any, yamlPath: string) => Promise<void>,
  logger: Logger = console
): Promise<{yamlPath: string; yaml: OwlBotYaml; copyTag: string}[]> {
  const cmd = newCmd(logger);

  // Copy code according to each yaml.
  const result = [];
  const allSourcePaths = globGitRepo(params.sourceRepo);
  const allDestPaths = globGitRepo(params.destDir);
  for (const yamlPath of yamlPaths) {
    const copyTag = copyTagFrom(yamlPath, params.sourceRepoCommitHash);
    const localYamlPath = path.join(params.destDir, yamlPath);
    let yaml: OwlBotYaml | undefined;
    try {
      if (!fs.existsSync(localYamlPath)) {
        logger.warn(`${localYamlPath} doesn't exist.`);
        continue;
      }
      yaml = await loadOwlBotYaml(localYamlPath);
    } catch (e) {
      await reportError(e, yamlPath);
      continue;
    }
    copyFiles(
      params.sourceRepo,
      allSourcePaths,
      params.destDir,
      allDestPaths,
      yaml,
      logger
    );
    result.push({yamlPath, yaml, copyTag});
  }

  // Compose a commit message with a copy of googleapis-gen's commit
  // message and all the copy tags.
  let cwd = params.sourceRepo;
  const sourceCommitMsg = cmd('git log -1 --format=%B', {cwd})
    .toString('utf8')
    .trim();
  const commitMsg = [
    sourceCommitMsg,
    '',
    sourceLinkLineFrom(sourceLinkFrom(params.sourceRepoCommitHash)),
    ...result.map(yaml => `${copyTagFooter}${yaml.copyTag}`),
  ].join('\n');
  const commitMsgFile = tmp.fileSync({
    dir: params.workDir,
    prefix: 'commit-msg-',
    postfix: '.txt',
  });
  fs.writeFileSync(commitMsgFile.fd, commitMsg);
  fs.closeSync(commitMsgFile.fd);

  // Commit the changes.
  cwd = params.destDir;
  // Don't capture stdout because it may be too big to fit into a buffer.
  const cmdOpts: ExecSyncOptions = {cwd, stdio: 'inherit'};
  cmd('git add -A', cmdOpts);
  cmd(`git commit -F ${commitMsgFile.name} --allow-empty`, cmdOpts);
  return result;
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

/**
 * Creates a unique branch name for the given set of yamlPaths
 */
export function branchNameForCopies(yamlPaths: string[]): string {
  if (1 === yamlPaths.length) {
    return branchNameForCopy(yamlPaths[0]);
  } else {
    const sorted = [...yamlPaths].sort();
    return (
      'owl-bot-copy-' +
      crypto
        .createHash('sha256')
        .update(sorted.join())
        .digest('hex')
        .slice(0, 20)
    );
  }
}

/**
 * Finds an open pull request for the given yamlPaths and appends it.
 * Returns false if none found.
 */
async function findAndAppendPullRequest(
  params: WorkingCopyParams,
  yamlPaths: string[],
  logger: Logger = console,
  withNestedCommitDelimiters: WithNestedCommitDelimiters = WithNestedCommitDelimiters.No
): Promise<boolean> {
  const cmd = newCmd(logger);
  const octokit = await params.octokitFactory.getShortLivedOctokit();

  // Is there a pull request open with the branch name for this
  // yaml path set?
  const destBranch = branchNameForCopies(yamlPaths);
  const head = `${params.destRepo.owner}:${destBranch}`;
  logger.info(
    `Looking for existing, open pull request on ${params.destRepo.owner}/${params.destRepo.repo} with head: ${head}`
  );
  const pulls = await octokit.pulls.list({
    owner: params.destRepo.owner,
    repo: params.destRepo.repo,
    state: 'open',
    head,
  });
  const pull = pulls.data.length > 0 ? pulls.data[0] : undefined;

  if (!pull) {
    logger.info(
      'No existing pull request found, should attempt to create a new one.'
    );
    return false;
  }

  // Yes, there's a pull request.  Append a new commit to it.
  logger.info(
    `Appending ${pull.html_url} with a new commit. Nested commit delimiters: ${withNestedCommitDelimiters}`
  );
  cmd(`git checkout -t origin/${destBranch}`, {cwd: params.destDir});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reportError = async (e: any, yamlPath: string) => {
    console.error(`Error parsing ${yamlPath}: ${e}`);
    await octokit.pulls.createReviewComment({
      repo: params.destRepo.repo,
      owner: params.destRepo.owner,
      pull_number: pull.number,
      body: `Error parsing ${yamlPath}.  Triggered by ${sourceLinkFrom(
        params.sourceRepoCommitHash
      )}:\n${e}`,
      commit_id: pull.head.sha,
      path: yamlPath,
      line: 1, // We don't know where the problem is, so choosing the first line.
    });
    const copyTag = copyTagFrom(yamlPath, params.sourceRepoCommitHash);
    await params.copyStateStore.recordBuildForCopy(
      params.destRepo,
      copyTag,
      pull.html_url
    );
  };

  // Copy the code from googlapis-gen.
  const copiedYamls = await copyCodeIntoCommit(
    params,
    yamlPaths,
    reportError,
    logger
  );

  if (copiedYamls.length === 0) {
    return true; // No changes to push.
  }

  // Did another instance of owl bot win the race to update this PR?
  for (const yaml of copiedYamls) {
    const found = await params.copyStateStore.findBuildForCopy(
      params.destRepo,
      yaml.copyTag
    );
    if (found) {
      logger.info(
        `Another instance of Owl Bot already pushed a new commit to ${pull.html_url}.`
      );
      return true; // No changes to push.
    }
  }

  // Push the changes to the pull request.
  const token = await params.octokitFactory.getGitHubShortLivedAccessToken();
  const pushUrl = params.destRepo.getCloneUrl(token);
  cmd(`git push ${pushUrl} ${destBranch}`, {cwd: params.destDir});

  // Record that we've copied the code.
  for (const yaml of copiedYamls) {
    await params.copyStateStore.recordBuildForCopy(
      params.destRepo,
      yaml.copyTag,
      pull.html_url
    );
  }

  // Prepend the new commit message to the body.
  const commitBody: string = cmd('git log -1 --format=%B', {
    cwd: params.destDir,
  })
    .toString('utf8')
    .trim();
  const {title, body} = prependCommitMessage(
    commitBody,
    {title: pull.title, body: pull.body ?? ''},
    WithRegenerateCheckbox.Yes,
    withNestedCommitDelimiters
  );
  const apiNames = copiedYamls.map(tag => tag.yaml['api-name']).filter(Boolean);
  const apiList = abbreviateApiListForTitle(apiNames as string[]);
  await octokit.pulls.update({
    owner: params.destRepo.owner,
    repo: params.destRepo.repo,
    pull_number: pull.number,
    title: insertApiName(title, apiList),
    body,
  });
  return true;
}

export interface CopyParams {
  /** a local path to a clone of googleapis/googleapis-gen */
  sourceRepo: string;
  /** the commit from which to copy code */
  sourceRepoCommitHash: string;
  /** the destination github repo */
  destRepo: GithubRepo;
  /** where to record pull requests appended by this function */
  copyStateStore: CopyStateStore;
  octokitFactory: OctokitFactory;
  /** maximum number of yamls (APIs) to combine in a single pull request */
  maxYamlCountPerPullRequest: number;
}

interface WorkingCopyParams extends CopyParams {
  /** local directory where destRepo has been cloned */
  destDir: string;
  /** local temporary directory for general purpose */
  workDir: string;
}

/**
 * Appends open pull requests with new commits containing code copied from
 * googleapis-gen.  Creates pull request if there's none matching and open.
 *
 * @param yamlPaths .OwlBot.yaml paths that triggered this copy
 * @param draftPullRequests when creating pull requests, make them drafts
 * @returns a subset of yamlPaths that didn't correspond to any open pull requests
 */
export async function copyCodeAndAppendOrCreatePullRequest(
  params: CopyParams,
  yamlPaths: string[],
  logger: Logger = console,
  withNestedCommitDelimiters: WithNestedCommitDelimiters = WithNestedCommitDelimiters.No,
  draftPulledRequests = false
): Promise<void> {
  const workDir = tmp.dirSync().name;
  logger.info(`Working in ${workDir}`);
  const cmd = newCmd(logger);

  // Checkout the sha from googleapis-gen from which we'll copy code.
  cmd(`git checkout ${params.sourceRepoCommitHash}`, {cwd: params.sourceRepo});

  // Create a local clone of the destination directory.
  let destDir: string;
  {
    const token = await params.octokitFactory.getGitHubShortLivedAccessToken();
    const url = params.destRepo.getCloneUrl(token);
    if (!hasValidOrg(url)) {
      logger.warn(`${url} was not valid, add to ORG_ALLOW_LIST?`);
      throw new InvalidOrgError();
    }
    destDir = path.join(workDir, 'dest');
    cmd(`git clone ${url} ${destDir}`);
  }

  const defaultBranch = cmd('git branch --show-current', {cwd: destDir})
    .toString('utf-8')
    .trim();

  // Examine each yaml path, looking for an open pull request to append.
  const leftOvers: string[] = [];
  const wparams: WorkingCopyParams = {...params, destDir, workDir};
  for (const yamlPath of yamlPaths) {
    if (
      !(await findAndAppendPullRequest(
        wparams,
        [yamlPath],
        logger,
        withNestedCommitDelimiters
      ))
    ) {
      leftOvers.push(yamlPath);
    }
  }
  if (leftOvers.length === 0) {
    return; // Nothing more to do.
  }
  // Look for a single, open pull request with the same set of yaml paths.
  // Append it.
  if (isDeepStrictEqual(yamlPaths, leftOvers)) {
    // Don't repeat exactly the same search
  } else {
    if (
      await findAndAppendPullRequest(
        wparams,
        leftOvers,
        logger,
        withNestedCommitDelimiters
      )
    ) {
      return; // Appended a pull request for all the left-over APIs.  Done.
    }
  }

  //////////////////////////////////////////////////////////////////
  // Appended all the pull requests we could.  Create pull requests
  // for the remaining yamls.

  leftOvers.sort(); // To make the batches more predictable for humans.
  for (
    let i = 0;
    i < leftOvers.length;
    i += params.maxYamlCountPerPullRequest
  ) {
    // Split the left overs into batches no larger than maxYamlCount APIs.
    const leftOverBatch = leftOvers.slice(
      i,
      i + params.maxYamlCountPerPullRequest
    );

    const wparams: WorkingCopyParams = {...params, destDir, workDir};
    const updated = await findAndAppendPullRequest(
      wparams,
      leftOverBatch,
      logger,
      withNestedCommitDelimiters
    );

    if (updated) {
      logger.info('Updated existing batch PR.');
      continue;
    }

    const destBranch = branchNameForCopies(leftOverBatch);
    cmd(`git checkout ${defaultBranch}`, {cwd: destDir});
    cmd(`git checkout -b ${destBranch}`, {cwd: destDir});

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reportError = async (e: any, yamlPath: string) => {
      console.error(`Error parsing ${yamlPath}: ${e}`);
      const sourceLink = sourceLinkFrom(params.sourceRepoCommitHash);
      const octokit = await params.octokitFactory.getShortLivedOctokit();
      const issue = await octokit.issues.create({
        owner: params.destRepo.owner,
        repo: params.destRepo.repo,
        title: `${yamlPath} is defective`,
        body: `While attempting to copy files from
${sourceLink}

After fixing ${yamlPath}, re-attempt this copy by running the following
command in a local clone of this repo:
\`\`\`
  docker run -v /repo:$(pwd) -w /repo gcr.io/repo-automation-bots/owl-bot -- copy-code \
    --source-repo-commit-hash ${params.sourceRepoCommitHash}
\`\`\``,
      });
      const copyTag = copyTagFrom(yamlPath, params.sourceRepoCommitHash);
      console.log(`Created issue ${issue.data.html_url}`);
      await params.copyStateStore.recordBuildForCopy(
        params.destRepo,
        copyTag,
        issue.data.html_url
      );
    };

    // Copy the code from googleapis-gen.
    const copiedYamls = await copyCodeIntoCommit(
      wparams,
      leftOverBatch,
      reportError,
      logger
    );

    if (copiedYamls.length === 0) {
      continue; // Nothing was copied; don't create a pull request.
    }

    // Create a pull request.
    const apiNames = copiedYamls
      .map(tag => tag.yaml['api-name'])
      .filter(Boolean);
    const apiList = abbreviateApiListForTitle(apiNames as string[]);
    const token = await params.octokitFactory.getGitHubShortLivedAccessToken();
    const pushUrl = params.destRepo.getCloneUrl(token);
    const pull = await createPullRequestFromLastCommit(
      params.destRepo.owner,
      params.destRepo.repo,
      destDir,
      destBranch,
      pushUrl,
      [OWL_BOT_COPY],
      await params.octokitFactory.getShortLivedOctokit(token),
      WithRegenerateCheckbox.Yes,
      apiList,
      Force.Yes,
      logger,
      undefined,
      draftPulledRequests
    );

    // Record that we've copied the code.
    for (const yaml of copiedYamls) {
      await params.copyStateStore.recordBuildForCopy(
        params.destRepo,
        yaml.copyTag,
        pull
      );
    }
  }
}

export type CopyCodeIntoPullRequestAction =
  | 'regenerate' // Discard all current commits and regenerate.
  | 'append'; // Copy code and into a new commit and append it to the PR.

/**
 * Appends or regenerates a pull request.
 *
 * Regenerating is quite complicated because the PR may have multiple open
 * commits.  Regenerating the pull request will result in a single commit,
 * but we need to preserve the full history of all the commits.
 *
 * @param sourceRepo: the source repository, either a local path or googleapis/googleapis-gen
 * @param destRepo: the destination repository, either a local path or a github path like googleapis/nodejs-vision.
 */
export async function copyCodeIntoPullRequest(
  sourceRepo: string,
  destRepo: GithubRepo,
  destBranch: string,
  octokitFactory: OctokitFactory,
  action: CopyCodeIntoPullRequestAction = 'regenerate',
  logger = console
): Promise<void> {
  const workDir = tmp.dirSync().name;
  logger.info(`Working in ${workDir}`);
  const destDir = path.join(workDir, 'dest');
  const cmd = newCmd(logger);
  let token = await octokitFactory.getGitHubShortLivedAccessToken();

  // Clone the source repo.
  const sourceDir = toLocalRepo(
    sourceRepo,
    workDir,
    logger,
    undefined,
    await octokitFactory.getGitHubShortLivedAccessToken()
  );

  // Clone the dest repo.
  const cloneUrl = destRepo.getCloneUrl(token);
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
  const history = cmd(`git log ${ancestor}..origin/${destBranch} --format=%H`, {
    cwd: destDir,
  })
    .toString('utf-8')
    .split(/\s+/)
    .filter(Boolean);
  const commitMessages: string[] = [];
  for (const hash of history) {
    const commitMessage = cmd(`git log -1 --format=%B ${hash}`, {cwd: destDir})
      .toString('utf-8')
      .trim();
    // Drop commit messages that don't have a Copy-Tag, because those commits
    // get dropped during regeneration.
    if (bodyIncludesCopyTagFooter(commitMessage)) {
      commitMessages.push(commitMessage);
    }
  }
  const commitMsgFilePath = path.join(workDir, 'commit.txt');
  const commitMsg = commitMessages.join('\n\n');

  // Find the corresponding pull request because we'll either have to update
  // its body or add a comment describing failure.
  let octokit = await octokitFactory.getShortLivedOctokit(token);
  const pulls = await octokit.pulls.list({
    owner: destRepo.owner,
    repo: destRepo.repo,
    state: 'open',
    head: `${destRepo.owner}:${destBranch}`,
  });
  if (pulls.data.length < 1) {
    logger.error(
      `Failed to find pull request for ${destRepo.repo}:${destBranch}`
    );
    return;
  }
  const pull = pulls.data[0];

  // If something goes wrong while examining the state of the open pull request,
  // report the error on the log and in a comment on the pull request.
  const reportError = async (error: string) => {
    logger.error(`Error in ${pull.html_url}:\n${error}`);

    // First get the file list and choose the first file.
    const filesInPR = await octokit.pulls.listFiles({
      repo: destRepo.repo,
      owner: destRepo.owner,
      pull_number: pull.number,
    });
    if (filesInPR.data.length < 1) {
      logger.error("There's no file to add a review comment, skipping");
      return;
    }
    await octokit.pulls.createReviewComment({
      repo: destRepo.repo,
      owner: destRepo.owner,
      pull_number: pull.number,
      body: error,
      commit_id: pull.head.sha,
      path: filesInPR.data[0].filename, // Choosing the first file in the PR.
      line: 1, // We don't know where the problem is, choosing the first line.
    });
  };

  // Find the copy tag so we know which commit hash to copy from.
  const copyTagTexts = findCopyTags(commitMsg);
  if (copyTagTexts.length === 0) {
    await reportError('No Copy-Tags found in commit message.');
    return;
  }
  logger.info(['Found Copy-Tags: ', ...copyTagTexts].join('\n'));

  const copyTags: CopyTag[] = [];
  for (const text of copyTagTexts) {
    try {
      copyTags.push(unpackCopyTag(text));
    } catch (e) {
      await reportError(`Corrupt Copy-Tag in the commit message:\n${text}.`);
      return;
    }
  }

  const sourceRepoCommitHash = copyTags[0].h;

  if (action === 'regenerate') {
    // Use the combined commit message.
    fs.writeFileSync(commitMsgFilePath, commitMsg);
    // Create a new branch that replaces the old branch.
    cmd(`git checkout -b ${destBranch}`, {cwd: destDir});
  } else {
    // Use a simple commit message.
    fs.writeFileSync(
      commitMsgFilePath,
      `Owl Bot copied code from https://github.com/${sourceRepo}/commit/${sourceRepoCommitHash}`
    );
    // Check out the existing branch.
    cmd(`git checkout -t origin/${destBranch}`, {cwd: destDir});
  }

  const apiNames: string[] = [];
  const allSourcePaths = globGitRepo(sourceDir);
  const allDestPaths = globGitRepo(destDir);
  for (const tag of copyTags) {
    if (sourceRepoCommitHash !== tag.h) {
      logger.info(
        [
          'Skipping Copy-Tag because its commit hash is older.',
          JSON.stringify(tag),
          JSON.stringify(copyTags[0]),
        ].join('\n')
      );
      continue; // Only copy from the most recent commit hash.
    }
    // Load the yaml so we know which code to copy.
    let yaml: OwlBotYaml | undefined;
    try {
      const yamlPath = path.join(destDir, tag.p);
      console.info(`Loading ${yamlPath}`);
      yaml = await loadOwlBotYaml(yamlPath);
    } catch (e) {
      await reportError(`Error loading ${tag.p}:\n${e}`);
      return;
    }

    // Copy the files specified in the yaml.
    const yamlText = JSON.stringify(yaml, undefined, 2);
    console.info(`copyDirs(${sourceDir}, ${destDir}, ${yamlText}}`);
    copyFiles(sourceDir, allSourcePaths, destDir, allDestPaths, yaml, logger);

    if (yaml['api-name']) {
      apiNames.push(yaml['api-name']);
    }
  }

  // Commit the newly copied code.
  // Don't capture stdout because it may be too big to fit into a buffer.
  const cmdOpts: ExecSyncOptions = {cwd: destDir, stdio: 'inherit'};
  cmd('git add -A', cmdOpts);
  cmd(`git commit -F "${commitMsgFilePath}" --allow-empty`, cmdOpts);

  // Refresh the token because copyCode() may have taken a while.
  token = await octokitFactory.getGitHubShortLivedAccessToken();
  octokit = await octokitFactory.getShortLivedOctokit(token);

  // Prepare to push code to the pull request branch.
  const pushUrl = destRepo.getCloneUrl(token);
  cmd(`git remote set-url origin ${pushUrl}`, {cwd: destDir});

  if (action === 'regenerate') {
    // Minimize a race between our commits and others' commits to the PR's
    // branch while we were copying code.
    const originalDestHead = cmd(
      `git log -1 --format=%H  origin/${destBranch}`,
      {
        cwd: destDir,
      }
    )
      .toString('utf-8')
      .trim();
    cmd(`git fetch origin ${destBranch}`, {cwd: destDir});
    const originDestHead = cmd(`git log -1 --format=%H  origin/${destBranch}`, {
      cwd: destDir,
    })
      .toString('utf-8')
      .trim();
    if (originDestHead !== originalDestHead) {
      reportError(
        `New commit ${originDestHead} added to ` +
          `origin/${destBranch} while I was coping code.`
      );
      return;
    }
    // Force push the code to the pull request branch.
    cmd(`git push -f origin ${destBranch}`, {cwd: destDir});
    // Update the PR body with the full commit history.
    const {title, body} = resplit(commitMsg, WithRegenerateCheckbox.Yes);

    const apiList = abbreviateApiListForTitle(apiNames);
    await octokit.pulls.update({
      owner: destRepo.owner,
      repo: destRepo.repo,
      pull_number: pull.number,
      title: insertApiName(title, apiList),
      body,
    });
  } else {
    // Appending the branch, so push without forcing.
    cmd(`git push origin ${destBranch}`, {cwd: destDir});
  }
}

/**
 * Affected API names appears in the title of pull requests generated for
 * mono repos.  Example:
 *    chore: [Speech] remove unused imports
 *            ^^^^^^
 * This function returns a comma-separated string when there are a small
 * number of APIs, and 'Many APIs' when there's many.  It returns an empty
 * string if the list is empty.
 */
function abbreviateApiListForTitle(apiNames: string[]): string {
  return apiNames.length > 3 ? 'Many APIs' : apiNames.join(',');
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
  logger: Logger = console,
  depth = 100,
  accessToken = ''
): string {
  const cmd = newCmd(logger);
  if (stat(repo)?.isDirectory()) {
    logger.info(`Using local source repo directory ${repo}`);
    cmd(`git config --global --add safe.directory ${repo}`);
    return repo;
  } else {
    const githubRepo = githubRepoFromOwnerSlashName(repo);
    const localDir = path.join(workDir, githubRepo.repo);
    const url = githubRepo.getCloneUrl(accessToken);
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
 * @param yamls the yaml file loaded from the destDir
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
  yamls: OwlBotYaml[],
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

  for (const yaml of yamls) {
    copyDirs(sourceDir, destDir, yaml, logger);
  }

  // Commit changes to branch.
  const commitMsgFile = tmp.fileSync({
    dir: workDir,
    prefix: 'commit-msg-',
    postfix: '.txt',
  });
  const commitMsgPath = commitMsgFile.name;
  let commitMsg = cmd('git log -1 --format=%B', {
    cwd: sourceDir,
  }).toString('utf8');
  const sourceLink = sourceLinkFrom(sourceCommitHash);
  commitMsg += sourceLinkLineFrom(sourceLink) + '\n';
  fs.writeFileSync(commitMsgFile.fd, commitMsg);
  fs.closeSync(commitMsgFile.fd);
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

// glob all the files and dirs in a git repo directory,
function globGitRepo(repoDir: string): string[] {
  return glob.sync('**', {
    cwd: repoDir,
    dot: true,
    ignore: ['.git', '.git/**'],
  });
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
  logger: Logger = console
): void {
  return copyFiles(
    sourceDir,
    globGitRepo(sourceDir),
    destDir,
    globGitRepo(destDir),
    yaml,
    logger
  );
}

/**
 * Copies directories and files specified by yaml.
 * @param sourceDir the path to the source repository directory
 * @param allSourcePaths the list of all the files and directories in the source directory.
 * @param destDir the path to the dest repository directory.
 * @param allDestPaths the list of all the files and directories in the dest directory.
 * @param yaml the OwlBot.yaml file from the dest repository.
 */
function copyFiles(
  sourceDir: string,
  allSourcePaths: string[],
  destDir: string,
  allDestPaths: string[],
  yaml: OwlBotYaml,
  logger: Logger = console
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
