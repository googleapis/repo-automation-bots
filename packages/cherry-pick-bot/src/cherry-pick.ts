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

type OctokitType = InstanceType<typeof Octokit>;

interface PullRequest {
  number: number;
  html_url: string;
  title: string;
  body: string | null;
}

const COMMENT_REGEX = /^\/cherry-pick\s+(?<branch>\w[-\w]*)/;

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
 * @param {string} commitSha The commit to cherry-pick
 * @param {string} targetBranch The target branch of the pull request
 * @returns {PullRequest}
 */
export async function cherryPickAsPullRequest(
  octokit: OctokitType,
  owner: string,
  repo: string,
  commitSha: string,
  targetBranch: string
): Promise<PullRequest> {
  logger.info(`cherry-pick ${commitSha} to ${targetBranch} via pull request`);
  const newBranchName = `cherry-pick-${commitSha}-${targetBranch}`;
  const targetBranchHead = (
    await octokit.repos.getBranch({
      owner,
      repo,
      branch: targetBranch,
    })
  ).data.commit.sha;

  logger.debug(`creating new branch: ${newBranchName} from ${targetBranch}`);
  await createRef(octokit, owner, repo, newBranchName, targetBranchHead);

  const newHeadSha = await cherryPickCommit(
    octokit,
    owner,
    repo,
    commitSha,
    newBranchName
  );
  logger.debug(`cherry-picked as ${newHeadSha}`);

  logger.debug(`opening pull request from ${newBranchName} to ${targetBranch}`);
  const {data: pullRequest} = await octokit.pulls.create({
    owner,
    repo,
    head: newBranchName,
    base: targetBranch,
    title: `chore: cherry-pick commit ${commitSha} to ${targetBranch}`,
  });
  return pullRequest;
}

/**
 * Cherry-pick a commit to a specific branch
 * @param {OctokitType} octokit An authenticated Octokit instance
 * @param {string} owner The repository owner
 * @param {string} repo The repository name
 * @param {string} commitSha The commit to cherry-pick
 * @param {string} targetBranch The target branch of the pull request
 */
export async function cherryPickCommit(
  octokit: OctokitType,
  owner: string,
  repo: string,
  commitSha: string,
  targetBranch: string
): Promise<string> {
  logger.info(`cherry-pick ${commitSha} to branch ${targetBranch}`);

  logger.debug(`fetching commit data for: ${commitSha}`);
  const {data: commit} = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: commitSha,
  });

  logger.debug('fetching new branch sha');
  const {
    data: {
      object: {sha: newBranchHeadSha},
    },
  } = await octokit.git.getRef({
    owner,
    repo,
    ref: `heads/${targetBranch}`,
  });

  const temporaryRefName = `temp-${targetBranch}`;
  logger.debug(`creating temporary ref: ${temporaryRefName}`);
  await createRef(octokit, owner, repo, temporaryRefName, newBranchHeadSha);

  logger.debug(`fetching ${targetBranch} tree SHA`);
  const {
    data: {
      tree: {sha: newBranchHeadTree},
    },
  } = await octokit.git.getCommit({
    owner,
    repo,
    commit_sha: newBranchHeadSha,
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

  // create sibiling commit
  await octokit.git.createCommit({
    owner,
    repo,
    author,
    committer,
    message: commit.message,
    parents: [commit.parents[0].sha],
    tree: newBranchHeadTree,
  });
  // merge
  logger.debug(`Merge ${commitSha} into ${temporaryRefName}`);
  const {
    data: {
      commit: {
        tree: {sha: mergedTree},
      },
    },
  } = await octokit.repos.merge({
    base: temporaryRefName,
    commit_message: `Merge ${commitSha} into ${temporaryRefName}`,
    head: commitSha,
    owner,
    repo,
  });
  logger.debug('creating commit with different tree');
  const {
    data: {sha: newHeadSha},
  } = await octokit.git.createCommit({
    owner,
    repo,
    author,
    committer,
    message: commit.message,
    parents: [commit.parents[0].sha],
    tree: mergedTree,
  });

  logger.debug(`updating ref: ${newHeadSha}`);
  await octokit.git.updateRef({
    force: true,
    owner,
    repo,
    ref: `heads/${temporaryRefName}`,
    sha: newHeadSha,
  });

  // update target branch ref to new cherry-picked commit
  await octokit.git.updateRef({
    force: true,
    owner,
    repo,
    ref: `heads/${targetBranch}`,
    sha: newHeadSha,
  });

  // cleanup temporary ref
  await octokit.git.deleteRef({
    owner,
    ref: `heads/${temporaryRefName}`,
    repo,
  });

  return newHeadSha;
}

async function createRef(
  octokit: OctokitType,
  owner: string,
  repo: string,
  ref: string,
  sha: string
) {
  await octokit.git.createRef({
    owner,
    ref: `refs/heads/${ref}`,
    repo,
    sha,
  });
}
