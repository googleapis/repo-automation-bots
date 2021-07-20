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

import {logger} from 'gcf-utils';

// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';

export interface Label {
  name: string;
}

interface CheckRun {
  name: string | null;
  conclusion: string | null;
}

export interface CheckStatus {
  context: string;
  state: string;
}

export interface Reviews {
  user: {
    login: string;
  };
  state: string;
  commit_id: string;
  id: number;
}

export interface Comment {
  body: string;
}

interface PullRequest {
  title: string;
  body: string;
  state: string;
  mergeable: boolean;
  mergeable_state: string;
  user: {login: string};
  labels: Array<{
    name: string;
  }>;
}

interface Merge {
  sha: string;
  merged: boolean;
  message: string;
}

/**
 * Function gets latest commit in a PR
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr number of pr (from Watch PR)
 * @param github unique installation id for each function
 * @returns most recent sha as a string
 */
export async function getLatestCommit(
  owner: string,
  repo: string,
  pr: number,
  github: Octokit
): Promise<string> {
  try {
    const commits = await github.paginate(github.pulls.listCommits, {
      owner,
      repo,
      pull_number: pr,
    });
    return commits[commits.length - 1].sha;
  } catch (err) {
    return '';
  }
}

/**
 * Function gets PR info
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr number of pr (from Watch PR)
 * @param github unique installation id for each function
 * @returns PR information, most importantly the title, body, state (open/closed), whether it is mergeable, and what state that is in (dirty, clean, behind, etc.)
 */
async function getPR(
  owner: string,
  repo: string,
  pr: number,
  github: Octokit
): Promise<PullRequest> {
  try {
    const data = await github.pulls.get({
      owner,
      repo,
      pull_number: pr,
    });
    return data.data as PullRequest;
  } catch (err) {
    return {
      title: '',
      body: '',
      state: '',
      mergeable: false,
      mergeable_state: '',
      user: {
        login: '',
      },
      labels: [],
    };
  }
}

/**
 * Function gets comments on PR to make sure the bot doesn't repost comments
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param issue_number same as PR number (from Watch PR)
 * @param github unique installation id for each function
 * @returns array of comments on PR
 */
async function getCommentsOnPR(
  owner: string,
  repo: string,
  issue_number: number,
  github: Octokit
): Promise<Comment[] | null> {
  try {
    const data = await github.issues.listComments({
      owner,
      repo,
      issue_number,
    });
    return data.data as Comment[];
  } catch (err) {
    return null;
  }
}

/**
 * Function grabs the statuses that have run for a given Sha
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param github unique installation id for each function
 * @param headSha the head sha commit
 * @param num the number of the page to check
 * @returns an array of Check Statuses that has their names and statuses
 */
async function getStatuses(
  owner: string,
  repo: string,
  github: Octokit,
  headSha: string
): Promise<CheckStatus[]> {
  const start = Date.now();
  try {
    const responses = await github.paginate(
      await github.repos.listCommitStatusesForRef,
      {
        owner,
        repo,
        ref: headSha,
      }
    );
    logger.info(
      `called getStatuses in ${Date.now() - start}ms ${owner}/${repo}`
    );
    return responses;
  } catch (err) {
    err.message = `Error in getting statuses\n\n${err.message}`;
    logger.error(err);
    return [];
  }
}

/**
 * Function grabs the check runs that have run for a given Sha (a sha can run statuses and check runs)
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param github unique installation id for each function
 * @param headSha the head sha commit
 * @param num the number of the page to check
 * @returns an array of Check Statuses that has their names and statuses
 */
async function getCheckRuns(
  owner: string,
  repo: string,
  github: Octokit,
  headSha: string
): Promise<CheckRun[]> {
  const start = Date.now();
  try {
    const responses = await github.paginate(github.checks.listForRef, {
      owner,
      repo,
      ref: headSha,
    });
    logger.info(
      `called getCheckRuns in ${Date.now() - start}ms ${owner}/${repo}`
    );
    return responses;
  } catch (err) {
    return [];
  }
}

/**
 * Function checks whether a required check is in a check run array
 * @param checkRuns array of check runs (from function getCheckRuns)
 * @param check a required check from the branch protection
 * @returns a boolean of whether there's a match
 */
function checkForRequiredSC(checkRuns: CheckRun[], check: string) {
  if (checkRuns.length !== 0) {
    const checkRunCompleted = checkRuns.find(element =>
      element.name?.startsWith(check)
    );
    if (
      checkRunCompleted !== undefined &&
      checkRunCompleted.conclusion === 'success'
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Function calls the branch protection for base branch, as well as the check runs and check statuses, to see
 * if all required checks have passed
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr pr number
 * @param requiredChecks a string array of required checks grabbed from base branch protection
 * @param headSha the latest commit in the PR
 * @param github unique installation id for each function
 * @returns a boolean of whether all required checks have passed
 */
async function statusesForRef(
  owner: string,
  repo: string,
  pr: number,
  requiredChecks: string[],
  headSha: string,
  github: Octokit
): Promise<boolean> {
  const start = Date.now();
  const checkStatus = await getStatuses(owner, repo, github, headSha);
  logger.info(
    `fetched statusesForRef in ${Date.now() - start}ms ${owner}/${repo}/${pr}`
  );

  let mergeable = true;
  let checkRuns;
  if (headSha.length !== 0) {
    logger.info(`=== checking required checks for ${owner}/${repo}/${pr} ===`);
    for (const check of requiredChecks) {
      logger.info(
        `Looking for required checks in status checks for ${owner}/${repo}/${pr}.`
      );
      //since find function finds the value of the first element in the array, that will take care of the chronological order of the tests
      const checkCompleted = checkStatus.find((element: CheckStatus) =>
        element.context.startsWith(check)
      );
      if (!checkCompleted) {
        logger.info(
          'The status checks do not include your required checks. We will check in check runs.'
        );
        //if we can't find it in the statuses, let's check under check runs
        if (!checkRuns) {
          checkRuns = await getCheckRuns(owner, repo, github, headSha);
        }
        mergeable = checkForRequiredSC(checkRuns, check);
        if (!mergeable) {
          logger.info(
            'We could not find your required checks in check runs. You have no statuses or checks that match your required checks.'
          );
          return false;
        }
      } else if (checkCompleted.state !== 'success') {
        logger.info(
          `Setting mergeable false due to ${checkCompleted.context} = ${checkCompleted.state}`
        );
        return false;
      }
    }
  } else {
    logger.info(
      `Either you have no head sha, or no required checks for ${owner}/${repo} PR ${pr}`
    );
    return false;
  }
  return mergeable;
}

/**
 * Function grabs completed reviews on a given pr
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr pr number
 * @param github unique installation id for each function
 * @returns an array of Review types
 */
async function getReviewsCompleted(
  owner: string,
  repo: string,
  pr: number,
  github: Octokit
): Promise<Reviews[]> {
  try {
    const reviewsCompleted = await github.pulls.listReviews({
      owner,
      repo,
      pull_number: pr,
    });
    return reviewsCompleted.data as Reviews[];
  } catch (err) {
    err.message = `Error getting reviews completed\n\n${err.message}`;
    logger.error(err);
    return [];
  }
}

/**
 * This function cleans the reviews, since the listReviews method github provides returns a complete
 * history of all comments added and we just want the most recent for each reviewer
 * @param Reviews is an array of completed reviews from getReviewsCompleted()
 * @returns an array of only the most recent reviews for each reviewer
 */
function cleanReviews(reviewsCompleted: Reviews[]): Reviews[] {
  const cleanReviews = [];
  const distinctReviewers: string[] = [];
  if (reviewsCompleted.length !== 0) {
    for (let x = reviewsCompleted.length - 1; x >= 0; x--) {
      const reviewsCompletedUser = reviewsCompleted[x].user.login;
      if (!distinctReviewers.includes(reviewsCompletedUser)) {
        cleanReviews.push(reviewsCompleted[x]);
        distinctReviewers.push(reviewsCompletedUser);
      }
    }
  }
  return cleanReviews;
}

/**
 * Function evaluates whether a check review has passed
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr pr number
 * @param github unique installation id for each function
 * @returns a boolean of whether there has been at least one review, and all reviews are approved
 */
async function checkReviews(
  owner: string,
  repo: string,
  pr: number,
  author: string,
  label: string,
  secureLabel: string,
  headSha: string,
  github: Octokit
): Promise<boolean> {
  const start = Date.now();
  logger.info(`=== checking required reviews ${owner}/${repo}/${pr} ===`);
  const reviewsCompletedDirty = await getReviewsCompleted(
    owner,
    repo,
    pr,
    github
  );
  let reviewsPassed = true;
  const reviewsCompleted = cleanReviews(reviewsCompletedDirty);
  logger.info(
    `fetched completed reviews in ${
      Date.now() - start
    }ms ${owner}/${repo}/${pr}`
  );
  if (reviewsCompleted.length !== 0) {
    reviewsCompleted.forEach(review => {
      if (review.state !== 'APPROVED' && review.user.login !== author) {
        logger.info(
          `One of your reviewers did not approve the PR ${owner}/${repo}/${pr} state = ${review.state}`
        );
        reviewsPassed = false;
        return;
      }
    });
    if (label === secureLabel) {
      //if we get to here, it means that all the reviews are in the approved state
      for (const review of reviewsCompleted) {
        if (review.commit_id !== headSha) {
          reviewsPassed = false;
          logger.info(
            `${review.user.login} didn't review the latest commit for ${owner}/${repo}/${pr} commit = ${headSha}; will dismiss review.`
          );
          await github.pulls
            .dismissReview({
              owner,
              repo,
              pull_number: pr,
              review_id: review.id,
              message:
                'This review does not reference the most recent commit, and you are using the secure version of merge-on-green. Please re-review the most recent commit.',
            })
            .catch(logger.error);
        }
      }
      return reviewsPassed;
    }
  } else {
    //if no one has reviewed it, fail the merge
    logger.info(`No one has reviewed your PR ${owner}/${repo}/${pr}`);
    return false;
  }
  return reviewsPassed;
}

/**
 * Function merges a pr
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr pr number
 * @param github unique installation id for each function
 * @param prInfo information about the PR, most notably title and body, to use it for the commit when squashing
 * @returns the merge data type (not reused)
 */
async function merge(
  owner: string,
  repo: string,
  pr: number,
  prInfo: PullRequest,
  github: Octokit
): Promise<Merge> {
  const merge = (
    await github.pulls.merge({
      owner,
      repo,
      pull_number: pr,
      commit_title: `${prInfo.title} (#${pr})`,
      commit_message: prInfo.body || '',
      merge_method: 'squash',
    })
  ).data as Merge;
  return merge;
}

/**
 * Updates a branch if it is behind master
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr pr number
 * @param github unique installation id for each function
 * @returns the update data type
 */
async function updateBranch(
  owner: string,
  repo: string,
  pr: number,
  github: Octokit
) {
  try {
    await github.pulls.updateBranch({
      owner,
      repo,
      pull_number: pr,
    });
  } catch (err) {
    err.message = `Error in updating branch: \n\n${err.message}`;
    logger.error(err);
  }
}

/**
 * Comments on the PR
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr pr number
 * @param body the body of the comment
 * @param github unique installation id for each function
 * @returns the update data type
 */
async function commentOnPR(
  owner: string,
  repo: string,
  pr: number,
  body: string,
  github: Octokit
): Promise<{} | null> {
  try {
    const data = await github.issues.createComment({
      owner,
      repo,
      issue_number: pr,
      body,
    });
    return data;
  } catch (err) {
    err.message = `There was an issue commenting on ${owner}/${repo} PR ${pr} \n\n${err.message}`;
    logger.error(err);
    return null;
  }
}

// TODO(sofisl): Remove once metrics have been collected (06/15/21)
// This function logs Github's mergeability assessment of a given PR, but only
// ~20% of the time, given that this is an expensive API call, and we only care
// about answering the question.
async function maybeLogMergeability(
  owner: string,
  repo: string,
  pr: number,
  github: Octokit,
  checkReviews: boolean,
  checkStatus: boolean
) {
  if (Math.random() > 0.8) {
    const prInfo = await getPR(owner, repo, pr, github);
    logger.metric('merge_on_green.mergeability_sample', {
      repo: `${owner}/${repo}/`,
      number: pr,
      mergeable: prInfo.mergeable,
      mergeable_state: prInfo.mergeable_state,
      checkReviews,
      checkStatus,
    });
  }
}

/**
 * Main function. Checks whether PR is open and whether there are is any base branch protection. If there
 * is, MOG continues checking to make sure reviews are approved and statuses have passed.
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr pr number
 * @param labelNames names of label we are looking for ('automerge' and 'automerge: secure')
 * @param state whether or not the PR has been in Datastore for over 6 hours to be deleted
 * @param github unique installation id for each function
 * @returns a boolean of whether it can be removed from Datastore (either because it is stale or has merged)
 */
export async function mergeOnGreen(
  owner: string,
  repo: string,
  pr: number,
  labelNames: string[],
  state: string,
  requiredChecks: string[],
  mogLabel: string,
  author: string,
  github: Octokit
): Promise<boolean | undefined> {
  const rateLimit = (await github.rateLimit.get()).data.resources.core
    .remaining;
  logger.info(`rate limit remaining: ${rateLimit}`);
  // we are picking 10 because that is *roughly* the amount of API calls required
  // to complete this function. But, it can vary based on paths, pages, etc.
  if (rateLimit <= 10) {
    logger.error(
      `The rate limit is at ${rateLimit}. We are skipping execution until we reset.`
    );
    return false;
  }

  logger.info(`${owner}/${repo} checking merge on green PR status`);

  const headSha = await getLatestCommit(owner, repo, pr, github);

  const [checkReview, checkStatus, commentsOnPR] = await Promise.all([
    checkReviews(
      owner,
      repo,
      pr,
      author,
      mogLabel,
      labelNames[1],
      headSha,
      github
    ),
    statusesForRef(owner, repo, pr, requiredChecks, headSha, github),
    getCommentsOnPR(owner, repo, pr, github),
  ]);
  const failedMesssage =
    'Merge-on-green attempted to merge your PR for 6 hours, but it was not mergeable because either one of your required status checks failed, one of your required reviews was not approved, or there is a do not merge label. Learn more about your required status checks here: https://help.github.com/en/github/administering-a-repository/enabling-required-status-checks. You can remove and reapply the label to re-run the bot.';
  const conflictMessage =
    'Your PR has conflicts that you need to resolve before merge-on-green can automerge';
  const notAuthorizedMessage =
    'Merge-on-green is not authorized to push to this branch. Visit https://help.github.com/en/github/administering-a-repository/enabling-branch-restrictions to give gcf-merge-on-green permission to push to this branch.';

  logger.info(
    `checkReview = ${checkReview} checkStatus = ${checkStatus} state = ${state} ${owner}/${repo}/${pr}`
  );

  // TODO(sofisl): Remove once metrics have been collected (06/15/21)
  maybeLogMergeability(owner, repo, pr, github, checkStatus, checkReview);
  //if the reviews and statuses are green, let's try to merge
  if (checkReview === true && checkStatus === true) {
    const prInfo = await getPR(owner, repo, pr, github);
    const hasDNMLabel = prInfo.labels?.some(l => l.name === 'do not merge');
    if (hasDNMLabel) {
      logger.info(`${owner}/${repo}/${pr} has do not merge label`);
      return false;
    }
    let merged = false;
    try {
      logger.info(`attempt to merge ${owner}/${repo}/${pr}`);
      logger.metric('merge_on_green.attempt_to_merge', {
        repo: `${owner}/${repo}`,
        number: pr,
        mergeable: prInfo.mergeable,
        mergeable_state: prInfo.mergeable_state,
      });
      await merge(owner, repo, pr, prInfo, github);
      merged = true;
      logger.metric('merge_on_green.merged', {
        repo: `${owner}/${repo}/`,
        number: pr,
        mergeable: prInfo.mergeable,
        mergeable_state: prInfo.mergeable_state,
      });
    } catch (err) {
      logger.metric('merge_on_green.failed_to_merge', {
        repo: `${owner}/${repo}`,
        number: pr,
        mergeable: prInfo.mergeable,
        mergeable_state: prInfo.mergeable_state,
      });
      // Not checking here whether err.status=405 as that seems to apply to more than one error type,
      // so checking the body instead.
      if (err.message.includes('not authorized to push to this branch')) {
        const isCommented = commentsOnPR?.find(element =>
          element.body.includes(notAuthorizedMessage)
        );
        if (!isCommented) {
          await commentOnPR(owner, repo, pr, notAuthorizedMessage, github);
        }
      }
      logger.info(
        `Is ${owner}/${repo}/${pr} mergeable?: ${prInfo.mergeable} Mergeable_state?: ${prInfo.mergeable_state}`
      );
      err.message = `Failed to merge "${err.message}: " ${owner}/${repo}/${pr}\n\n${err.message}`;
      logger.error(err);
      if (prInfo.mergeable_state === 'behind') {
        logger.info(`Attempting to update branch ${owner}/${repo}/${pr}`);
        try {
          await updateBranch(owner, repo, pr, github);
        } catch (err) {
          err.message = `failed to update branch ${owner}/${repo}/${pr}\n\n${err.message}`;
          logger.error(err);
        }
      } else if (prInfo.mergeable_state === 'dirty') {
        logger.info(
          `There are conflicts in the base branch of ${owner}/${repo}/${pr}`
        );
        const isCommented = commentsOnPR?.find(element =>
          element.body.includes(conflictMessage)
        );
        if (!isCommented) {
          await commentOnPR(owner, repo, pr, conflictMessage, github);
        }
      }
    }
    return merged;
    //if the state is stopped, i.e., we won't keep checking, let's comment and remove from Datastore
  } else if (state === 'stop') {
    logger.info(
      `${owner}/${repo}/${pr} timed out before its statuses & reviews passed`
    );
    await commentOnPR(owner, repo, pr, failedMesssage, github);
    return true;
    // if the PR is halfway through the time it is checking, comment on the PR.
  } else {
    logger.info(
      `Statuses and/or checks failed for ${owner}/${repo}/${pr}, will check again`
    );
    return false;
  }
}
