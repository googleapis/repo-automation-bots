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

interface CheckParam {}

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

interface ReviewsRequested {
  users: [];
  teams: [];
}

interface PR {
  title: string;
  body: string;
}

interface RequiredChecksByLanguage {
  [key: string]: {
    requiredStatusChecks: string[];
  };
}

interface Language {
  language: string;
  repo: string;
}

// contains the installation id necessary to authenticate as an installation
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

mergeOnGreen.getPR = async function getPR(
  owner: string,
  repo: string,
  pr: number,
  github: GitHubAPI
): Promise<PR> {
  try {
    const data = await github.pulls.get({
      owner,
      repo,
      pull_number: pr,
    });
    return data.data;
  } catch (err) {
    return { title: '', body: '' };
  }
};

mergeOnGreen.getMOGLabel = async function getMOGLabel(
  owner: string,
  repo: string,
  pr: number,
  labelName: string,
  github: GitHubAPI
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
      const mog = labelArray.find(element => element.name === labelName);
      if (mog) {
        isMOG = true;
      }
    }
    return isMOG;
  } catch (err) {
    return isMOG;
  }
};

mergeOnGreen.requiredChecksByLanguage = async function requiredChecksByLanguage(
  github: GitHubAPI
): Promise<RequiredChecksByLanguage | null> {
  try {
    const configFile = (
      await github.repos.getContents({
        owner: 'googleapis',
        repo: 'sloth',
        path: 'required-checks.json',
      })
    ).data as { content?: string };
    return JSON.parse(
      Buffer.from(configFile.content as string, 'base64').toString('utf8')
    ) as RequiredChecksByLanguage;
  } catch (err) {
    return null;
  }
};

mergeOnGreen.getRepoMap = async function getRepoMap(
  github: GitHubAPI
): Promise<Language[]> {
  try {
    const configFile = (
      await github.repos.getContents({
        owner: 'googleapis',
        repo: 'sloth',
        path: 'repos.json',
      })
    ).data as { content?: string };
    return JSON.parse(
      Buffer.from(configFile.content as string, 'base64').toString('utf8')
    ).repos;
  } catch (err) {
    console.error(err);
    return [];
  }
};

mergeOnGreen.getRequiredChecks = async function getRequiredChecks(
  github: GitHubAPI,
  owner: string,
  repo: string
): Promise<string[]> {
  const checksByLanguage = await mergeOnGreen.requiredChecksByLanguage(github);
  const languageMap = await mergeOnGreen.getRepoMap(github);
  if (checksByLanguage && languageMap) {
    const language = languageMap.find(
      (element: Language) => element.repo === `${owner}/${repo}`
    );
    if (language !== undefined) {
      return checksByLanguage[language.language].requiredStatusChecks;
    } else {
      console.info(
        'This repo does not have a corresponding language in sloth/repos.json'
      );
      return [];
    }
  } else {
    console.info('Could not find any checks or a language map');
    return [];
  }
};

mergeOnGreen.getStatusi = async function getStatusi(
  owner: string,
  repo: string,
  github: GitHubAPI,
  headSha: string
): Promise<CheckStatus[]> {
  console.log('head sha ' + headSha);
  try {
    const data = await github.repos.listStatusesForRef({
      owner,
      repo,
      ref: headSha,
      per_page: 100,
    });
    return data.data;
  } catch (err) {
    return [];
  }
};

mergeOnGreen.getRuns = async function getRuns(
  owner: string,
  repo: string,
  github: GitHubAPI,
  headSha: string
): Promise<CheckRun[]> {
  try {
    const checkRuns = await github.checks.listForRef({
      owner,
      repo,
      ref: headSha,
      per_page: 100,
    });
    return checkRuns.data.check_runs;
  } catch (err) {
    return [];
  }
};

mergeOnGreen.checkForRequiredSC = function checkForRequiredSC(
  checkRuns: CheckRun[],
  check: string
): boolean {
  let mergeable = false;
  if (checkRuns.length !== 0) {
    const checkRunCompleted = checkRuns.find(element => element.name === check);
    if (
      checkRunCompleted !== undefined &&
      checkRunCompleted.conclusion === 'success'
    ) {
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
  labelName: string,
  github: GitHubAPI
): Promise<boolean> {
  const headSha = await mergeOnGreen.getLatestCommit(owner, repo, pr, github);
  const mogLabel = await mergeOnGreen.getMOGLabel(
    owner,
    repo,
    pr,
    labelName,
    github
  );
  const checkStatus = await mergeOnGreen.getStatusi(
    owner,
    repo,
    github,
    headSha
  );
  const requiredChecks = await mergeOnGreen.getRequiredChecks(
    github,
    owner,
    repo
  );
  let mergeable = true;
  if (
    headSha.length !== 0 &&
    requiredChecks.length !== 0 &&
    mogLabel === true
  ) {
    console.info('=== checking required checks ===');
    for (const check of requiredChecks) {
      console.log('Looking for required checks in status checks.');
      //since find function finds the value of the first element in the array, that will take care of the chronological order of the tests
      const checkCompleted = checkStatus.find(
        (element: CheckStatus) => element.context === check
      );
      if (checkCompleted === undefined) {
        console.log(
          'The status checks do not include your required checks. We will check in check runs.'
        );
        //if we can't find it in the statuses, let's check under check runs
        const checkRuns = await mergeOnGreen.getRuns(
          owner,
          repo,
          github,
          headSha
        );
        mergeable = mergeOnGreen.checkForRequiredSC(checkRuns, check);
        if (!mergeable) {
          console.log(
            'We could not find your required checks in check runs. You have no statuses or checks that match your required checks.'
          );
          return mergeable;
        }
      } else if (checkCompleted.state !== 'success') {
        console.info(
          `Setting mergeable false due to ${checkCompleted.context} = ${checkCompleted.state}`
        );
        mergeable = false;
        return mergeable;
      }
    }
  } else {
    mergeable = false;
    console.log(
      'Either you have no head sha, no required checks, or no MOG Label'
    );
    return mergeable;
  }
  return mergeable;
};

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
    return [];
  }
};

mergeOnGreen.getReviewsRequested = async function getReviewsRequested(
  owner: string,
  repo: string,
  pr: number,
  github: GitHubAPI
): Promise<ReviewsRequested> {
  try {
    return (
      await github.pulls.listReviewRequests({
        owner,
        repo,
        pull_number: pr,
      })
    ).data as ReviewsRequested;
  } catch (err) {
    return { users: [], teams: [] };
  }
};

//this function cleans the reviews, since the listReviews method github provides returns a complete history of all comments added
//and we just want the most recent for each reviewer
mergeOnGreen.cleanReviews = function cleanReviews(
  reviewsCompleted: Reviews[]
): Reviews[] {
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
  pr: number,
  github: GitHubAPI
): Promise<boolean> {
  console.info('=== checking required reviews ===');
  let reviewsPassed = true;
  const reviewsCompletedDirty = await mergeOnGreen.getReviewsCompleted(
    owner,
    repo,
    pr,
    github
  );
  const reviewsRequested = await mergeOnGreen.getReviewsRequested(
    owner,
    repo,
    pr,
    github
  );
  if (reviewsCompletedDirty.length !== 0) {
    const reviewsCompleted = mergeOnGreen.cleanReviews(reviewsCompletedDirty);
    if (reviewsCompleted.length !== 0) {
      reviewsCompleted.forEach(review => {
        if (review.state !== 'APPROVED') {
          console.log('One of your reviewers did not approve the PR');
          reviewsPassed = false;
        }
      });
    }
  } else {
    //if no one has reviewed it, fail the merge
    console.log('No one has reviewed your PR');
    reviewsPassed = false;
    return reviewsPassed;
  }
  if (
    reviewsRequested.users.length !== 0 ||
    reviewsRequested.teams.length !== 0
  ) {
    console.log('You have assigned reviewers that have not submitted a PR');
    reviewsPassed = false;
    return reviewsPassed;
  }
  return reviewsPassed;
};

mergeOnGreen.merge = async function merge(
  owner: string,
  repo: string,
  pr: number,
  github: GitHubAPI
) {
  const commitInfo = await mergeOnGreen.getPR(owner, repo, pr, github);
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

mergeOnGreen.updateBranch = async function updateBranch(
  owner: string,
  repo: string,
  pr: number,
  github: GitHubAPI
) {
  try {
    const update = await github.pulls.updateBranch({
      owner,
      repo,
      pull_number: pr,
    });
    return update;
  } catch (err) {
    return null;
  }
};

mergeOnGreen.createFailedParam = async function createFailedParam(
  owner: string,
  repo: string,
  pr: number,
  github: GitHubAPI
): Promise<CheckParam | null> {
  const headSha = await mergeOnGreen.getLatestCommit(owner, repo, pr, github);
  //removed the check for if headSha exists, since we're returning an empty string and the error block will catch it
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
  github: GitHubAPI
): Promise<boolean> {
  console.info(`${owner}/${repo} checking merge on green PR status`);
  // Checks for reviewers and ensures that the latest review has been
  // approved.
  const checkReview = await mergeOnGreen.checkReviews(owner, repo, pr, github);
  // Checks statuses and check runs, ensuring that the latest version of
  // a status was a success.
  const checkStatus = await mergeOnGreen.statusesForRef(
    owner,
    repo,
    pr,
    labelName,
    github
  );

  console.info(
    `checkReview = ${checkReview} checkStatus = ${checkStatus} state = ${state}`
  );

  if (checkReview === true && checkStatus === true && state === 'continue') {
    console.log('Updating branch');
    await mergeOnGreen.updateBranch(owner, repo, pr, github);
    console.log('Merging PR');
    await mergeOnGreen.merge(owner, repo, pr, github);
    return true;
  } else if (state === 'stop') {
    console.log('Your PR timed out before its statuses & reviews passed');
    await mergeOnGreen.createFailedParam(owner, repo, pr, github);
    return true;
  } else {
    console.log('Statuses and/or checks failed, will check again');
    return false;
  }
}
