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

import { GitHubAPI } from 'probot/lib/github';

interface CommentOnPR {}

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

interface PullRequest {
  title: string;
  body: string;
}

interface RequiredChecksByLanguage {
  [key: string]: {
    requiredStatusChecks: string[];
    repoOverrides: [RepoOverrides];
  };
}

interface RepoOverrides {
  repo: string;
  requiredStatusChecks: string[];
}

interface Language {
  language: string;
  repo: string;
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
): Promise<PullRequest> {
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

/*
The function above gets the required checks for each repo based on
language. However, since we only have the repo name from the payload,
we need to figure out what language the repo name attaches to. Grabbing
this file tells us that info.
*/
mergeOnGreen.mapReposToLanguage = async function mapReposToLanguage(
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
  const [checksByLanguage, languageMap] = await Promise.all([
    mergeOnGreen.requiredChecksByLanguage(github),
    mergeOnGreen.mapReposToLanguage(github),
  ]);
  if (checksByLanguage && languageMap) {
    const language = languageMap.find(
      (element: Language) => element.repo === `${owner}/${repo}`
    );
    if (language !== undefined) {
      if (checksByLanguage[language.language].repoOverrides !== undefined) {
        const isOverriden = checksByLanguage[
          language.language
        ].repoOverrides.find(
          (element: RepoOverrides) => element.repo === `${owner}/${repo}`
        );
        if (isOverriden) {
          console.log(
            "Your language's required checks were overridden because of the PR's repo"
          );
          return isOverriden.requiredStatusChecks;
        }
      }
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
  const start = Date.now();
  try {
    const data = await github.repos.listStatusesForRef({
      owner,
      repo,
      ref: headSha,
      per_page: 100,
    });
    console.info(
      `called getStatusi in ${Date.now() - start}ms ${owner}/${repo}`
    );
    return data.data;
  } catch (err) {
    return [];
  }
};

mergeOnGreen.getCheckRuns = async function getCheckRuns(
  owner: string,
  repo: string,
  github: GitHubAPI,
  headSha: string
): Promise<CheckRun[]> {
  const start = Date.now();
  try {
    const checkRuns = await github.checks.listForRef({
      owner,
      repo,
      ref: headSha,
      per_page: 100,
    });
    console.info(
      `called getCheckRuns in ${Date.now() - start}ms ${owner}/${repo}`
    );
    return checkRuns.data.check_runs;
  } catch (err) {
    return [];
  }
};

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

mergeOnGreen.statusesForRef = async function statusesForRef(
  owner: string,
  repo: string,
  pr: number,
  labelName: string,
  github: GitHubAPI
): Promise<boolean> {
  const start = Date.now();
  const headSha = await mergeOnGreen.getLatestCommit(owner, repo, pr, github);
  const [mogLabel, checkStatus, requiredChecks] = await Promise.all([
    await mergeOnGreen.hasMOGLabel(owner, repo, pr, labelName, github),
    await mergeOnGreen.getStatusi(owner, repo, github, headSha),
    await mergeOnGreen.getRequiredChecks(github, owner, repo),
  ]);
  console.info(
    `fetched statusesForRef in ${Date.now() - start}ms ${owner}/${repo}/${pr}`
  );

  let mergeable = true;
  let checkRuns;
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
        if (!checkRuns) {
          checkRuns = await mergeOnGreen.getCheckRuns(
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
      'Either you have no head sha, no required checks, or no MOG Label'
    );
    return false;
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

//this function cleans the reviews, since the listReviews method github provides returns a complete history of all comments added
//and we just want the most recent for each reviewer
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
mergeOnGreen.checkReviews = async function checkReviews(
  owner: string,
  repo: string,
  pr: number,
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
    `fetched completed reviews in ${Date.now() -
      start}ms ${owner}/${repo}/${pr}`
  );
  if (reviewsCompleted.length !== 0) {
    reviewsCompleted.forEach(review => {
      if (review.state !== 'APPROVED') {
        console.log(
          `One of your reviewers did not approve the PR ${owner}/${repo}/${pr} state = ${review.state}`
        );
        reviewsPassed = false;
      }
    });
  } else {
    //if no one has reviewed it, fail the merge
    console.log('No one has reviewed your PR');
    return false;
  }
  return reviewsPassed;
};

mergeOnGreen.merge = async function merge(
  owner: string,
  repo: string,
  pr: number,
  github: GitHubAPI
): Promise<Merge> {
  const commitInfo = await mergeOnGreen.getPR(owner, repo, pr, github);
  const merge = (
    await github.pulls.merge({
      owner,
      repo,
      pull_number: pr,
      commit_title: commitInfo.title,
      commit_message: commitInfo.body,
      merge_method: 'squash',
    })
  ).data as Merge;
  return merge;
};

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
    return null;
  }
};

mergeOnGreen.commentOnPR = async function commentOnPR(
  owner: string,
  repo: string,
  pr: number,
  github: GitHubAPI
): Promise<CommentOnPR | null> {
  try {
    const data = github.issues.createComment({
      owner,
      repo,
      issue_number: pr,
      body:
        'Your PR was not mergeable because either one of your required status checks failed, or one of your required reviews was not approved.',
    });
    return data;
  } catch (err) {
    console.log('There was an issue commenting on the PR');
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
): Promise<boolean | undefined> {
  console.info(`${owner}/${repo} checking merge on green PR status`);

  const [checkReview, checkStatus] = await Promise.all([
    mergeOnGreen.checkReviews(owner, repo, pr, github),
    mergeOnGreen.statusesForRef(owner, repo, pr, labelName, github),
  ]);

  console.info(
    `checkReview = ${checkReview} checkStatus = ${checkStatus} state = ${state}`
  );

  if (checkReview === true && checkStatus === true) {
    let merged = false;
    try {
      console.info(`attempt to merge ${owner}/${repo}`);
      await mergeOnGreen.merge(owner, repo, pr, github);
      merged = true;
    } catch (err) {
      console.error(`failed to merge "${err.message}" ${owner}/${repo}/${pr}`);
      console.log(`Attempting to update branch ${owner}/${repo}/${pr}`);
      try {
        await mergeOnGreen.updateBranch(owner, repo, pr, github);
      } catch (err) {
        console.error(
          `failed to update branch "${err.message}" ${owner}/${repo}/${pr}`
        );
      }
    }
    return merged;
  } else if (state === 'stop') {
    console.log('Your PR timed out before its statuses & reviews passed');
    await mergeOnGreen.commentOnPR(owner, repo, pr, github);
    return true;
  } else {
    console.log('Statuses and/or checks failed, will check again');
    return false;
  }
}
