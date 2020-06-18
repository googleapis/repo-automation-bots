// Copyright 2020 Google LLC
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

// eslint-disable-next-line node/no-extraneous-import
import {GitHubAPI} from 'probot/lib/github';

interface CheckRun {
  name: string;
  conclusion: string;
}

interface CheckStatus {
  context: string;
  state: string;
}
interface Reviews {
  user: {
    login: string;
  };
  state: string;
}

interface PullRequest {
  title: string;
  body: string;
  state: string;
  mergeable: boolean;
  mergeable_state: string;
  user: {login: string};
}

interface Merge {
  sha: string;
  merged: boolean;
  message: string;
}

interface Update {
  message: string;
  url: string;
}

/**
 * Function gets latest commit in a PR
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr number of pr (from Watch PR)
 * @param github unique installation id for each function
 * @returns most recent sha as a string
 */
mergeOnGreen.getLatestCommit = async function getLatestCommit(
  owner: string,
  repo: string,
  pr: number,
  github: GitHubAPI
): Promise<string> {
  try {
    // TODO: consider switching this to an async iterator, which would work
    // for more than 100.
    const data = await github.pulls.listCommits({
      owner,
      repo,
      pull_number: pr,
      per_page: 100,
      page: 1,
    });
    return data.data[data.data.length - 1].sha;
  } catch (err) {
    return '';
  }
};

/**
 * Function gets PR info
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr number of pr (from Watch PR)
 * @param github unique installation id for each function
 * @returns PR information, most importantly the title, body, state (open/closed), whether it is mergeable, and what state that is in (dirty, clean, behind, etc.)
 */
mergeOnGreen.getPR = async function getPR(
  owner: string,
  repo: string,
  pr: number,
  github: GitHubAPI
): Promise<PullRequest> {
  try {
    const data = await github.pulls.get({
      owner,
      repo,
      pull_number: pr,
    });
    return data.data;
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
    };
  }
};

/**
 * Function checks whether the PR has the appropriate MOG label
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr number of pr (from Watch PR)
 * @param labelName label name that we're checking for, is a string
 * @param github unique installation id for each function
 * @returns a boolean of whether the label is included
 */
mergeOnGreen.hasMOGLabel = async function hasMOGLabel(
  owner: string,
  repo: string,
  pr: number,
  labelName: string,
  github: GitHubAPI
): Promise<boolean> {
  const start = Date.now();
  let isMOG = false;
  try {
    const labels = await github.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number: pr,
    });
    const labelArray = labels.data;
    console.info(
      `checked hasMOGLabel in ${Date.now() - start}ms ${owner}/${repo}/${pr}`
    );
    if (labelArray) {
      const mog = labelArray.find(element => element.name === labelName);
      if (mog) {
        isMOG = true;
      }
    }
    return isMOG;
  } catch (err) {
    console.log(`Error in getting MOG label: ${err}`);
    return isMOG;
  }
};

/**
 * Function grabs the required checks of the master branch
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param github unique installation id for each function
 * @returns a string array of the names of the required checks
 */
mergeOnGreen.getBranchProtection = async function getBranchProtection(
  owner: string,
  repo: string,
  github: GitHubAPI
): Promise<string[]> {
  try {
    const branchProtection = (
      await github.repos.getBranchProtection({
        owner,
        repo,
        branch: 'master',
      })
    ).data.required_status_checks.contexts;
    console.log(
      `checking branch protection for ${owner}/${repo}: ${branchProtection}`
    );
    return branchProtection;
  } catch (err) {
    console.log(`Error in getting branch protection: ${err}`);
    return [];
  }
};

/**
 * Function grabs the statuses that have run for a given Sha
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param github unique installation id for each function
 * @param headSha the head sha commit
 * @returns an array of Check Statuses that has their names and statuses
 */
mergeOnGreen.getStatusi = async function getStatusi(
  owner: string,
  repo: string,
  github: GitHubAPI,
  headSha: string,
  num: number
): Promise<CheckStatus[]> {
  const start = Date.now();
  try {
    const {data} = await github.repos.listStatusesForRef({
      owner,
      repo,
      ref: headSha,
      per_page: 100,
      page: num,
    });
    console.info(
      `called getStatuses in ${Date.now() - start}ms ${owner}/${repo}, ${
        data[0].context
      }`
    );
    return data;
  } catch (err) {
    console.log(`Error in getting statuses: ${err}`);
    return [];
  }
};

/**
 * Function iterates through the multiple pages of check statuses and concatenates them into a large array
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param github unique installation id for each function
 * @param headSha the head sha commit
 * @returns an array of Check Statuses that has their names and statuses
 */
mergeOnGreen.iterateGetStatusi = async function iterateGetStatusi(
  owner: string,
  repo: string,
  github: GitHubAPI,
  headSha: string
): Promise<CheckStatus[]> {
  let results: CheckStatus[] = [];
  for (let i = 0; i < 10; i++) {
    const temp = await mergeOnGreen.getStatusi(owner, repo, github, headSha, i);
    if (temp.length !== 0) {
      results = results.concat(temp);
    }
  }
  return results;
};

/**
 * Function grabs the check runs that have run for a given Sha (a sha can run statuses and check runs)
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param github unique installation id for each function
 * @param headSha the head sha commit
 * @returns an array of Check Statuses that has their names and statuses
 */
mergeOnGreen.getCheckRuns = async function getCheckRuns(
  owner: string,
  repo: string,
  github: GitHubAPI,
  headSha: string,
  num: number
): Promise<CheckRun[]> {
  const start = Date.now();
  try {
    const checkRuns = await github.checks.listForRef({
      owner,
      repo,
      ref: headSha,
      per_page: 100,
      page: num,
    });
    console.info(
      `called getCheckRuns in ${Date.now() - start}ms ${owner}/${repo}`
    );
    return checkRuns.data.check_runs;
  } catch (err) {
    return [];
  }
};

/**
 * Function iterates through the multiple pages of check statuses and concatenates them into a large array
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param github unique installation id for each function
 * @param headSha the head sha commit
 * @returns an array of Check Runs that has their names and statuses
 */
mergeOnGreen.iterateGetCheckRuns = async function iterateGetCheckRuns(
  owner: string,
  repo: string,
  github: GitHubAPI,
  headSha: string
): Promise<CheckRun[]> {
  let results: CheckRun[] = [];
  for (let i = 0; i < 10; i++) {
    const temp = await mergeOnGreen.getCheckRuns(
      owner,
      repo,
      github,
      headSha,
      i
    );
    if (temp !== undefined) {
      results = results.concat(temp);
    }
  }
  return results;
};

/**
 * Function checks whether a required check is in a check run array
 * @param checkRuns array of check runs (from function getCheckRuns)
 * @param check a required check from the branch protection
 * @returns a boolean of whether there's a match
 */
mergeOnGreen.checkForRequiredSC = function checkForRequiredSC(
  checkRuns: CheckRun[],
  check: string
): boolean {
  if (checkRuns.length !== 0) {
    const checkRunCompleted = checkRuns.find(element => element.name === check);
    if (
      checkRunCompleted !== undefined &&
      checkRunCompleted.conclusion === 'success'
    ) {
      return true;
    }
  }
  return false;
};

/**
 * Function calls the branch protection for master branch, as well as the check runs and check statuses, to see
 * if all required checks have passed
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr pr number
 * @param labelName the name of the label we want to check for (i.e., 'automerge')
 * @param github unique installation id for each function
 * @param requiredChecks a string array of required checks grabbed from master branch protection
 * @returns a boolean of whether all required checks have passed
 */
mergeOnGreen.statusesForRef = async function statusesForRef(
  owner: string,
  repo: string,
  pr: number,
  labelName: string,
  github: GitHubAPI,
  requiredChecks: string[]
): Promise<boolean> {
  const start = Date.now();
  const headSha = await mergeOnGreen.getLatestCommit(owner, repo, pr, github);
  const [mogLabel, checkStatus] = await Promise.all([
    await mergeOnGreen.hasMOGLabel(owner, repo, pr, labelName, github),
    await mergeOnGreen.iterateGetStatusi(owner, repo, github, headSha),
  ]);
  console.info(
    `fetched statusesForRef in ${Date.now() - start}ms ${owner}/${repo}/${pr}`
  );

  let mergeable = true;
  let checkRuns;
  if (headSha.length !== 0 && mogLabel === true) {
    console.info(`=== checking required checks for ${owner}/${repo}/${pr} ===`);
    for (const check of requiredChecks) {
      console.log(
        `Looking for required checks in status checks for ${owner}/${repo}/${pr}.`
      );
      //since find function finds the value of the first element in the array, that will take care of the chronological order of the tests
      const checkCompleted = checkStatus.find(
        (element: CheckStatus) => element.context === check
      );
      if (checkCompleted === undefined) {
        console.log(
          'The status checks do not include your required checks. We will check in check runs.'
        );
        //if we can't find it in the statuses, let's check under check runs
        if (!checkRuns) {
          checkRuns = await mergeOnGreen.iterateGetCheckRuns(
            owner,
            repo,
            github,
            headSha
          );
        }
        mergeable = mergeOnGreen.checkForRequiredSC(checkRuns, check);
        if (!mergeable) {
          console.log(
            'We could not find your required checks in check runs. You have no statuses or checks that match your required checks.'
          );
          return false;
        }
      } else if (checkCompleted.state !== 'success') {
        console.info(
          `Setting mergeable false due to ${checkCompleted.context} = ${checkCompleted.state}`
        );
        return false;
      }
    }
  } else {
    console.log(
      `Either you have no head sha, no required checks, or no MOG Label for ${owner}/${repo} PR ${pr}`
    );
    return false;
  }
  return mergeable;
};

/**
 * Function grabs completed reviews on a given pr
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr pr number
 * @param github unique installation id for each function
 * @returns an array of Review types
 */
mergeOnGreen.getReviewsCompleted = async function getReviewsCompleted(
  owner: string,
  repo: string,
  pr: number,
  github: GitHubAPI
): Promise<Reviews[]> {
  try {
    const reviewsCompleted = await github.pulls.listReviews({
      owner,
      repo,
      pull_number: pr,
    });
    return reviewsCompleted.data;
  } catch (err) {
    console.log(`Error getting reviews completed ${err}`);
    return [];
  }
};

/**
 * This function cleans the reviews, since the listReviews method github provides returns a complete
 * history of all comments added and we just want the most recent for each reviewer
 * @param Reviews is an array of completed reviews from getReviewsCompleted()
 * @returns an array of only the most recent reviews for each reviewer
 */
mergeOnGreen.cleanReviews = function cleanReviews(
  reviewsCompleted: Reviews[]
): Reviews[] {
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
};

// TODO: test the logic for a team that's been assigned to review.
// we might also want to make whether or not a requested viewer needs
// to have been reviewed.

/**
 * Function evaluates whether a check review has passed
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr pr number
 * @param github unique installation id for each function
 * @returns a boolean of whether there has been at least one review, and all reviews are approved
 */
mergeOnGreen.checkReviews = async function checkReviews(
  owner: string,
  repo: string,
  pr: number,
  author: string,
  github: GitHubAPI
): Promise<boolean> {
  const start = Date.now();
  console.info(`=== checking required reviews ${owner}/${repo}/${pr} ===`);
  const reviewsCompletedDirty = await mergeOnGreen.getReviewsCompleted(
    owner,
    repo,
    pr,
    github
  );
  let reviewsPassed = true;
  const reviewsCompleted = mergeOnGreen.cleanReviews(reviewsCompletedDirty);
  console.info(
    `fetched completed reviews in ${
      Date.now() - start
    }ms ${owner}/${repo}/${pr}`
  );
  if (reviewsCompleted.length !== 0) {
    reviewsCompleted.forEach(review => {
      if (review.state !== 'APPROVED' && review.user.login !== author) {
        console.log(
          `One of your reviewers did not approve the PR ${owner}/${repo}/${pr} state = ${review.state}`
        );
        reviewsPassed = false;
      }
    });
  } else {
    //if no one has reviewed it, fail the merge
    console.log(`No one has reviewed your PR ${owner}/${repo}/${pr}`);
    return false;
  }
  return reviewsPassed;
};

/**
 * Function merges a pr
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr pr number
 * @param github unique installation id for each function
 * @param prInfo information about the PR, most notably title and body, to use it for the commit when squashing
 * @returns the merge data type (not reused)
 */
mergeOnGreen.merge = async function merge(
  owner: string,
  repo: string,
  pr: number,
  prInfo: PullRequest,
  github: GitHubAPI
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
};

/**
 * Updates a branch if it is behind master
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr pr number
 * @param github unique installation id for each function
 * @returns the update data type
 */
mergeOnGreen.updateBranch = async function updateBranch(
  owner: string,
  repo: string,
  pr: number,
  github: GitHubAPI
): Promise<Update | null> {
  try {
    const update = (
      await github.pulls.updateBranch({
        owner,
        repo,
        pull_number: pr,
      })
    ).data as Update;
    return update;
  } catch (err) {
    console.log(`Error in updating branch: ${err}`);
    return null;
  }
};

/**
 * Comments on the PR
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr pr number
 * @param body the body of the comment
 * @param github unique installation id for each function
 * @returns the update data type
 */
mergeOnGreen.commentOnPR = async function commentOnPR(
  owner: string,
  repo: string,
  pr: number,
  body: string,
  github: GitHubAPI
): Promise<{} | null> {
  try {
    const data = github.issues.createComment({
      owner,
      repo,
      issue_number: pr,
      body,
    });
    return data;
  } catch (err) {
    console.log(`There was an issue commenting on ${owner}/${repo} PR ${pr}`);
    return null;
  }
};

mergeOnGreen.removeLabel = async function removeLabel(
  owner: string,
  repo: string,
  issue_number: number,
  name: string,
  github: GitHubAPI
) {
  try {
    github.issues.removeLabel({
      owner,
      repo,
      issue_number,
      name,
    });
  } catch (err) {
    console.log(
      `There was an issue removing the automerge label on ${owner}/${repo} PR ${issue_number}`
    );
  }
};

/**
 * Main function. Checks whether PR is open and whether there are is any master branch protection. If there
 * is, MOG continues checking to make sure reviews are approved and statuses have passed.
 * @param owner of pr (from Watch PR)
 * @param repo of pr (from Watch PR)
 * @param pr pr number
 * @param labelName name of label we are looking for ('automerge')
 * @param state whether or not the PR has been in Datastore for over 6 hours to be deleted
 * @param github unique installation id for each function
 * @returns a boolean of whether it can be removed from Datastore (either because it is stale or has merged)
 */
export async function mergeOnGreen(
  owner: string,
  repo: string,
  pr: number,
  labelName: string,
  state: string,
  github: GitHubAPI
): Promise<boolean | undefined> {
  console.info(`${owner}/${repo} checking merge on green PR status`);
  const [prInfo, requiredChecks] = await Promise.all([
    await mergeOnGreen.getPR(owner, repo, pr, github),
    await mergeOnGreen.getBranchProtection(owner, repo, github),
  ]);

  if (prInfo.state === 'closed') {
    console.log(`${owner}/${repo}/${pr} is closed`);
    return true;
  }
  if (requiredChecks.length === 0) {
    console.log(`${owner}/${repo}/${pr} has no required status checks`);
    await mergeOnGreen.commentOnPR(
      owner,
      repo,
      pr,
      `Your PR doesn't have any required checks. Please add required checks to your master branch and then re-add the ${labelName} label. Learn more about enabling these checks here: https://help.github.com/en/github/administering-a-repository/enabling-required-status-checks.`,
      github
    );
    return true;
  }

  const [checkReview, checkStatus] = await Promise.all([
    mergeOnGreen.checkReviews(owner, repo, pr, prInfo.user.login, github),
    mergeOnGreen.statusesForRef(
      owner,
      repo,
      pr,
      labelName,
      github,
      requiredChecks
    ),
  ]);

  const failedMesssage =
    'Merge-on-green attempted to merge your PR for 6 hours, but it was not mergeable because either one of your required status checks failed, or one of your required reviews was not approved. Learn more about your required status checks here: https://help.github.com/en/github/administering-a-repository/enabling-required-status-checks. You can remove and reapply the label to re-run the bot.';
  const conflictMessage =
    'Your PR has conflicts that you need to resolve before merge-on-green can automerge';
  const continueMesssage =
    'Your PR has attempted to merge for 3 hours. Please check that all required checks have passed, you have an automerge label, and that all your reviewers have approved the PR';

  console.info(
    `checkReview = ${checkReview} checkStatus = ${checkStatus} state = ${state} ${owner}/${repo}/${pr}`
  );

  if (checkReview === true && checkStatus === true) {
    let merged = false;
    try {
      console.info(`attempt to merge ${owner}/${repo}/${pr}`);
      await mergeOnGreen.merge(owner, repo, pr, prInfo, github);
      merged = true;
    } catch (err) {
      console.info(
        `Is ${owner}/${repo}/${pr} mergeable?: ${prInfo.mergeable} Mergeable_state?: ${prInfo.mergeable_state}`
      );
      console.error(
        `failed to merge "${err.message}: " ${owner}/${repo}/${pr}`
      );
      if (prInfo.mergeable_state === 'behind') {
        console.info(`Attempting to update branch ${owner}/${repo}/${pr}`);
        try {
          await mergeOnGreen.updateBranch(owner, repo, pr, github);
        } catch (err) {
          console.error(
            `failed to update branch "${err.message}" ${owner}/${repo}/${pr}`
          );
        }
      } else if (prInfo.mergeable_state === 'dirty') {
        console.info(
          `There are conflicts in the base branch of ${owner}/${repo}/${pr}`
        );
        await mergeOnGreen.commentOnPR(
          owner,
          repo,
          pr,
          conflictMessage,
          github
        );
      }
    }
    return merged;
  } else if (state === 'stop') {
    console.log(
      `${owner}/${repo}/${pr} timed out before its statuses & reviews passed`
    );
    await mergeOnGreen.commentOnPR(owner, repo, pr, failedMesssage, github);
    await mergeOnGreen.removeLabel(owner, repo, pr, labelName, github);
    return true;
  } else if (state === 'comment') {
    console.log(`${owner}/${repo}/${pr} is halfway through its check`);
    await mergeOnGreen.commentOnPR(owner, repo, pr, continueMesssage, github);
    return false;
  } else {
    console.log(
      `Statuses and/or checks failed for ${owner}/${repo}/${pr}, will check again`
    );
    return false;
  }
}
