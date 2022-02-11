// Copyright 2022 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {logger} from 'gcf-utils';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import {RequestError} from '@octokit/request-error';
import * as crypto from 'crypto';

type OctokitType = InstanceType<typeof Octokit>;

interface PullRequest {
  number: number;
  html_url: string;
  title: string;
  body: string | null;
}

interface Commit {
  message: string;
  sha: string;
}

const COMMENT_REGEX = /^\/cherry-pick\s+(?<branch>\w[.-\w]*)/;

/**
 * Parse a comment string to see if it matches the expected cherry-pick
 * command of `/cherry-pick <branch-name>`
 *
 * @param {string} comment The comment to parse
 * @returns {string|null} Returns the parsed branch name to cherry-pick to
 *   or null if it does not match
 */
export function parseCherryPickComment(comment: string): string | null {
  const match = comment.trim().match(COMMENT_REGEX);
  if (match?.groups) {
    return match.groups.branch;
  }
  return null;
}

/**
 * Cherry-pick a commit to a new branch and open a pull request to
 * the specified target branch.
 * @param {OctokitType} octokit An authenticated Octokit instance
 * @param {string} owner The repository owner
 * @param {string} repo The repository name
 * @param {string[]} commits The commit SHAs to cherry-pick
 * @param {string} targetBranch The target branch of the pull request
 * @returns {PullRequest}
 */
export async function cherryPickAsPullRequest(
  octokit: OctokitType,
  owner: string,
  repo: string,
  commits: string[],
  targetBranch: string
): Promise<PullRequest> {
  logger.info(`cherry-pick ${commits} to ${targetBranch} via pull request`);
  const hash = crypto.createHash('md5').update(commits.join(',')).digest('hex');
  const newBranchName = `cherry-pick-${hash.substring(0, 6)}-${targetBranch}`;
  const targetBranchHead = (
    await octokit.repos.getBranch({
      owner,
      repo,
      branch: targetBranch,
    })
  ).data.commit.sha;

  logger.debug(`creating new branch: ${newBranchName} from ${targetBranch}`);
  await createOrUpdateRef(
    octokit,
    owner,
    repo,
    newBranchName,
    targetBranchHead
  );

  const newCommits = (await exports.cherryPickCommits(
    octokit,
    owner,
    repo,
    commits,
    newBranchName
  )) as Commit[];
  logger.debug(
    `cherry-picked ${newCommits.length} commits as ${
      newCommits[newCommits.length - 1].sha
    }`
  );

  logger.debug(`opening pull request from ${newBranchName} to ${targetBranch}`);
  const title = newCommits[0].message;
  const body =
    newCommits.length > 1
      ? newCommits
          .slice(1)
          .map(commit => commit.message)
          .join('\n')
      : '';
  const {data: pullRequest} = await octokit.pulls.create({
    owner,
    repo,
    head: newBranchName,
    base: targetBranch,
    title,
    body: `${body}\n\nCherry-picked ${newCommits
      .map(commit => commit.message)
      .join(', ')}`,
  });
  return pullRequest;
}

/**
 * Cherry-pick a commit to a specific branch
 * @param {OctokitType} octokit An authenticated Octokit instance
 * @param {string} owner The repository owner
 * @param {string} repo The repository name
 * @param {string[]} commits The commit SHAs to cherry-pick
 * @param {string} targetBranch The target branch of the pull request
 */
export async function cherryPickCommits(
  octokit: OctokitType,
  owner: string,
  repo: string,
  commits: string[],
  targetBranch: string
): Promise<Commit[]> {
  const newCommits: Commit[] = [];
  logger.info(`cherry-pick ${commits} to branch ${targetBranch}`);

  logger.debug(`fetching sha for ref ${targetBranch}`);
  const {
    data: {
      object: {sha: initialHeadSha},
    },
  } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${targetBranch}`,
  });

  const temporaryRefName = `temp-${targetBranch}`;
  logger.debug(`creating temporary ref: ${temporaryRefName}`);
  await createOrUpdateRef(
    octokit,
    owner,
    repo,
    temporaryRefName,
    initialHeadSha
  );

  logger.debug(`fetching ${targetBranch} tree SHA`);
  const {
    data: {
      tree: {sha: initialHeadTree},
    },
  } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: initialHeadSha,
  });

  let headSha = initialHeadSha;
  let headTree = initialHeadTree;

  for (const sha of commits) {
    logger.debug(`fetching commit data for: ${sha}`);
    const {data: commit} = await octokit.git.getCommit({
      owner,
      repo,
      commit_sha: sha,
    });

    const author = commit.author
      ? {
          name: commit.author.name!,
          email: commit.author.email!,
        }
      : undefined;
    const committer = commit.committer
      ? {
          name: commit.committer.name || undefined,
          email: commit.committer.email || undefined,
        }
      : undefined;
    const parent = commit.parents[0].sha;

    // create sibiling commit
    const siblingSha = await createCommit(
      octokit,
      owner,
      repo,
      `sibling of ${sha}`,
      parent,
      headTree,
      {
        authorName: author?.name,
        authorEmail: author?.email,
        committerName: committer?.name,
        committerEmail: committer?.email,
      }
    );
    await updateRef(octokit, owner, repo, temporaryRefName, siblingSha);

    // merge
    logger.debug(`merge ${sha} into ${temporaryRefName}`);
    const {
      data: {
        commit: {
          tree: {sha: mergedTree},
        },
      },
    } = await octokit.repos.merge({
      base: temporaryRefName,
      commit_message: `Merge ${sha} into ${temporaryRefName}`,
      head: sha,
      owner,
      repo,
    });
    logger.debug('creating commit with different tree');
    const newHeadSha = await createCommit(
      octokit,
      owner,
      repo,
      commit.message,
      headSha,
      mergedTree,
      {
        authorName: author?.name,
        authorEmail: author?.email,
        committerName: committer?.name,
        committerEmail: committer?.email,
      }
    );

    newCommits.push({
      message: commit.message,
      sha: newHeadSha,
    });

    logger.debug(`updating ref: ${newHeadSha}`);
    await updateRef(octokit, owner, repo, temporaryRefName, newHeadSha);

    headSha = newHeadSha;
    headTree = mergedTree;
  }
  // update target branch ref to new cherry-picked commit
  await updateRef(octokit, owner, repo, targetBranch, headSha);

  // cleanup temporary ref
  await octokit.git.deleteRef({
    owner,
    ref: `heads/${temporaryRefName}`,
    repo,
  });

  return newCommits;
}

/**
 * Create or update a GitHub reference.
 *
 * @param {OctokitType} octokit Authenticated octokit instance
 * @param {string} owner Owner of the repository
 * @param {string} repo Name of the repository
 * @param {string} ref Reference (branch name)
 * @param {string} sha Commit SHA that the reference should point to
 */
async function createOrUpdateRef(
  octokit: OctokitType,
  owner: string,
  repo: string,
  ref: string,
  sha: string
) {
  try {
    await octokit.git.createRef({
      owner,
      ref: `refs/heads/${ref}`,
      repo,
      sha,
    });
  } catch (e) {
    if (e instanceof RequestError && e.status === 422) {
      logger.warn(`${ref} already exists, updating instead`);
      await updateRef(octokit, owner, repo, ref, sha);
      return;
    }
    throw e;
  }
}

/**
 * Update an existing GitHub reference.
 *
 * @param {OctokitType} octokit Authenticated octokit instance
 * @param {string} owner Owner of the repository
 * @param {string} repo Name of the repository
 * @param {string} ref Reference (branch name)
 * @param {string} sha Commit SHA that the reference should point to
 */
async function updateRef(
  octokit: OctokitType,
  owner: string,
  repo: string,
  ref: string,
  sha: string
) {
  await octokit.git.updateRef({
    force: true,
    owner,
    repo,
    ref: `heads/${ref}`,
    sha,
  });
}

interface CreateCommitOptions {
  authorName?: string;
  authorEmail?: string;
  committerName?: string;
  committerEmail?: string;
}

/**
 * Create a new GitHub commit
 *
 * @param {OctokitType} octokit Authenticated octokit instance
 * @param {string} owner Owner of the repository
 * @param {string} repo Name of the repository
 * @param {string} message Commit message
 * @param {string} parentSha SHA of the parent commit
 * @param {string} tree SHA of the git tree
 * @param {CreateCommitOptions} options
 * @param {string} options.authorName Name of author of the commit
 * @param {string} options.authorEmail Email of author of the commit
 * @param {string} options.committerName Name of committer of the commit
 * @param {string} options.committerEmail Email of the committer of the commit
 * @return {string} SHA of the newly created commit
 */
async function createCommit(
  octokit: OctokitType,
  owner: string,
  repo: string,
  message: string,
  parentSha: string,
  tree: string,
  options?: CreateCommitOptions
): Promise<string> {
  const {
    data: {sha: newHeadSha},
  } = await octokit.git.createCommit({
    owner,
    repo,
    author:
      options?.authorName && options?.authorEmail
        ? {name: options.authorName, email: options.authorEmail}
        : undefined,
    committer: {
      name: options?.committerName,
      email: options?.committerEmail,
    },
    message,
    parents: [parentSha],
    tree,
  });
  return newHeadSha;
}
