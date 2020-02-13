/**
 * Copyright 2020 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { GitHubAPI } from 'probot/lib/github';
// TODO: don't do this, we need to pass the github instance.
let github: GitHubAPI;

interface Label {
  name: string;
}

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

// contains the installation id necessary to authenticate as an installation
mergeOnGreen.getLatestCommit = async function getLatestCommit(
  owner: string,
  repo: string,
  pr: number
): Promise<string|null> {
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
    return null;
  }
};

mergeOnGreen.getPR = async function getPR(
  owner: string,
  repo: string,
  pr: number
) {
  const data = await github.pulls.get({
    owner,
    repo,
    pull_number: pr,
  });

  return data.data;
};

mergeOnGreen.getMOGLabel = async function getMOGLabel(
  owner: string,
  repo: string,
  pr: number,
  labelName: string
): Promise<boolean> {
  let isMOG = false;
  try {
    const labels = await github.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number: pr,
    });
    const labelArray = labels.data;
    if (labelArray) {
      // TODO: consider using a [].find for this.
      for (let x = 0; x < labelArray.length; x++) {
        if (labelArray[x].name === labelName) {
          isMOG = true;
        } else {
          isMOG = false;
        }
      }
    }
    return isMOG;
  } catch (err) {
    return isMOG;
  }
};

interface RequiredChecksByLanguage {
  [key: string]: {
    requiredStatusChecks: string[]
  }
}

async function requiredChecksByLanguage(): Promise<RequiredChecksByLanguage|null> {
  try{
    const configFile = (await github.repos.getContents({
      owner: 'googleapis',
      repo: 'sloth',
      path: 'required-checks.json'
    })).data as { content?: string };
    return JSON.parse(
      Buffer.from(configFile.content as string, 'base64').toString('utf8')
    ) as RequiredChecksByLanguage;
  } catch (err) {
    console.error(err);
    return null;
  }
}

mergeOnGreen.getRequiredChecks = async function getRequiredChecks(): Promise<string[]> {
  // const requiredStatusChecks = ['Kokoro - Test: Binary Compatibility'];
  // TODO: pass configuration language setting through to here, so that we
  // can return the appropriate check.
  const checksByLanguage = await requiredChecksByLanguage()
  if (checksByLanguage) {
    return checksByLanguage['java'].requiredStatusChecks;
  } else {
    console.info('could not find any checks');
    return []
  }
};

mergeOnGreen.getStatusi = async function getStatusi(
  owner: string,
  repo: string,
  pr: number
): Promise<CheckStatus[]> {
  const headSha = await mergeOnGreen.getLatestCommit(owner, repo, pr);
  // TODO(@sofisl): think about refactoring this.
  if (!headSha) {
    console.info(`${owner}/${repo} no statuses found`);
    return [];
  }
  try {
    const data = await github.repos.listStatusesForRef({
      owner,
      repo,
      ref: headSha,
      per_page: 100,
    });
    console.info(`${owner}/${repo} found statuses`, data.data);
    return data.data;
  } catch (err) {
    console.info(`${owner}/${repo} no statuses found`);
    return [];
  }
};

mergeOnGreen.getRuns = async function getRuns(
  owner: string,
  repo: string,
  pr: number
) {
  const headSha = await mergeOnGreen.getLatestCommit(owner, repo, pr);
  if (!headSha) {
    return null;
  }
  try {
    const checkRuns = await github.checks.listForRef({
      owner,
      repo,
      ref: headSha,
      per_page: 100,
    });
    return checkRuns.data.check_runs;
  } catch (err) {
    return null;
  }
};

mergeOnGreen.checkForRequiredSC = function checkForRequiredSC(
  checkSuitesOrRuns: CheckRun[],
  check: string
) {
  let mergeable = false;
  if (checkSuitesOrRuns != null) {
    const checkSuiteorRunCompleted = checkSuitesOrRuns.find(
      element => element.name === check
    );
    if (
      checkSuiteorRunCompleted !== undefined &&
      checkSuiteorRunCompleted.conclusion === 'success'
    ) {
      console.log('e');
      mergeable = true;
      return mergeable;
    }
  }
  return mergeable;
};

mergeOnGreen.statusesForRef = async function statusesForRef(
  owner: string,
  repo: string,
  pr: number,
  labelName: string
) {
  const headSha = await mergeOnGreen.getLatestCommit(owner, repo, pr);
  const mogLabel = await mergeOnGreen.getMOGLabel(owner, repo, pr, labelName);
  const checkStatus = await mergeOnGreen.getStatusi(owner, repo, pr);
  const requiredChecks = await mergeOnGreen.getRequiredChecks();
  let mergeable = true;
  if (
    checkStatus.length !== 0 &&
    headSha !== null &&
    requiredChecks.length !== 0 &&
    mogLabel !== false
  ) {
    for (const check of requiredChecks) {
      //since find function finds the value of the first element in the array, that will take care of the chronological order of the tests
      const checkCompleted = checkStatus.find(
        (element: CheckStatus) => element.context === check
      );
      if (checkCompleted === undefined) {
        //if we can't find it in the statuses, let's check under check runs
        const checkRuns = await mergeOnGreen.getRuns(owner, repo, pr);
        mergeable = mergeOnGreen.checkForRequiredSC(checkRuns || [], check);
        if (!mergeable) {
          return mergeable;
        }
      } else if (checkCompleted.state !== 'success') {
        mergeable = false;
        return mergeable;
      }
    }
  } else {
    mergeable = false;
    console.log(checkStatus);
    console.log(headSha);
    console.log(requiredChecks);
    console.log(mogLabel);
    console.log(
      'Either you have no statuses, no head sha, no required checks, or no MOG Label'
    );
    return mergeable;
  }
  return mergeable;
};

mergeOnGreen.getReviewsCompleted = async function getReviewsCompleted(
  owner: string,
  repo: string,
  pr: number
) {
  try {
    const reviewsCompleted = await github.pulls.listReviews({
      owner,
      repo,
      pull_number: pr,
    });
    return reviewsCompleted.data;
  } catch (err) {
    return null;
  }
};

mergeOnGreen.getReviewsRequested = async function getReviewsRequested(
  owner: string,
  repo: string,
  pr: number
) {
  try {
    const reviewsRequested = await github.pulls.listReviewRequests({
      owner,
      repo,
      pull_number: pr,
    });
    return reviewsRequested.data;
  } catch (err) {
    return null;
  }
};

//this function cleans the reviews, since the listReviews method github provides returns a complete history of all comments added
//and we just want the most recent for each reviewer
mergeOnGreen.cleanReviews = function cleanReviews(reviewsCompleted: Reviews[]) {
  const cleanReviews = [];
  const distinctReviewers: string[] = [];
  for (let x = reviewsCompleted.length - 1; x >= 0; x--) {
    const reviewsCompletedUser = reviewsCompleted[x].user.login;
    if (!distinctReviewers.includes(reviewsCompletedUser)) {
      cleanReviews.push(reviewsCompleted[x]);
      distinctReviewers.push(reviewsCompletedUser);
    }
  }
  return cleanReviews;
};

// TODO: test the logic for a team that's been assigned to review.
// we might also want to make whether or not a requested viewer needs
// to have been reviewed.
mergeOnGreen.checkReviews = async function checkReviews(
  owner: string,
  repo: string,
  pr: number
): Promise<boolean> {
  let reviewsPassed = true;
  const reviewsCompletedDirty = await mergeOnGreen.getReviewsCompleted(
    owner,
    repo,
    pr
  );
  const reviewsRequested = await mergeOnGreen.getReviewsRequested(
    owner,
    repo,
    pr
  );
  if (reviewsRequested != null) {
    const reviewsCompleted = mergeOnGreen.cleanReviews(reviewsCompletedDirty || []);
    if (reviewsCompleted != null && reviewsCompleted.length !== 0) {
      reviewsCompleted.forEach(review => {
        if (review.state !== 'APPROVED') {
          reviewsPassed = false;
        }
      });
    }
  }
  if (
    reviewsRequested != null &&
    (reviewsRequested.users.length !== 0 || reviewsRequested.teams.length !== 0)
  ) {
    reviewsPassed = false;
    return reviewsPassed;
  }
  return reviewsPassed;
};

mergeOnGreen.merge = async function merge(
  owner: string,
  repo: string,
  pr: number
) {
  const commitInfo = await mergeOnGreen.getPR(owner, repo, pr);
  try {
    const merge = await github.pulls.merge({
      owner,
      repo,
      pull_number: pr,
      commit_title: commitInfo.title,
      commit_message: commitInfo.body,
      merge_method: 'squash',
    });
    return merge;
  } catch (err) {
    return null;
  }
};

mergeOnGreen.createFailedParam = async function createFailedParam(
  owner: string,
  repo: string,
  pr: number
) {
  const headSha = await mergeOnGreen.getLatestCommit(owner, repo, pr);
  if (!headSha) {
    return null;
  }
  try {
    const checkParams = github.checks.create({
      owner,
      repo,
      name: 'AutoMerge Failed',
      head_sha: headSha,
      status: 'completed',
      conclusion: 'failure',
      output: {
        title: 'Your PR was not mergeable.',
        summary:
          'Check your required status checks or requested reviews for failures.',
        text:
          'Your PR was not mergeable because either one of your required status checks failed, or one of your required reviews was not approved.' +
          'Please fix your mistakes, and merge-on-green will run again to attempt to merge it automatically.',
      },
    });
    return checkParams;
  } catch (err) {
    return null;
  }
};

export async function mergeOnGreen(
  owner: string,
  repo: string,
  pr: number,
  labelName: string,
  state: string,
  _github: GitHubAPI
) {
  github = _github;
  console.info(`${owner}/${repo} checking merge on green PR status`);
  // Checks for reviewers and ensures that the latest review has been
  // approved.
  const checkReview = await mergeOnGreen.checkReviews(owner, repo, pr);
  console.info(`${owner}/${repo} checkReview = ${checkReview}`);
  // Checks statuses and check runs, ensuring that the latest version of
  // a status was a success.
  const checkStatus = await mergeOnGreen.statusesForRef(
    owner,
    repo,
    pr,
    labelName
  );
  if (checkReview === true && checkStatus === true && state === 'continue') {
    await mergeOnGreen.merge(owner, repo, pr);
    return true;
  } else if (state === 'stop') {
    mergeOnGreen.createFailedParam(owner, repo, pr);
    return true;
  } else {
    return false;
  }

  //TODO: Fill in details on how to get config file
}
