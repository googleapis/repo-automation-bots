// Copyright 2021 Google LLC
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

// eslint-disable-next-line node/no-extraneous-import
import {ProbotOctokit} from 'probot';
import {PullRequestEvent} from '@octokit/webhooks-definitions/schema';
import {getChangedFiles} from './get-PR-info';
import {logger} from 'gcf-utils';
// type PullsListFilesResponseData = operations['pulls/list-files']['responses']['200']['application/json'];

// This file manages the logic to check whether a given PR matches the config in the repository

export interface ValidPr {
  author: string;
  title: string;
  changedFiles?: string[];
  maxFiles?: number;
}

//TODO: fix pr any type to correct type
/**
 * Checks that a given PR matches the rules in the auto-approve.yml file in the repository
 *
 * @param config the config in the repository
 * @param pr the incoming PR
 * @param octokit the Octokit instance on which to make calls to the Github API
 * @returns true if PR matches config appropriately, false if not
 */
export async function checkPRAgainstConfig(
  config: {rules: ValidPr[]},
  pr: PullRequestEvent,
  octokit: InstanceType<typeof ProbotOctokit>
): Promise<Boolean> {
  const repoOwner = pr.pull_request.head.repo.owner.login;
  const prAuthor = pr.pull_request.user.login;
  const repo = pr.pull_request.head.repo.name;
  const prNumber = pr.number;
  const title = pr.pull_request.title;

  const rulesToValidateAgainst = config.rules.find(x => x.author === prAuthor);

  if (rulesToValidateAgainst) {
    // setting these to true, as this should be the default if
    // changedFiles and maxFiles are not set in the JSON schema
    let filePathsMatch = true;
    let fileCountMatch = true;

    // This variable defaults to false, as the title of the PR MUST match the title
    // on the config (as title is not optional, vs. the other config settings)
    let titlesMatch = false;

    // Since there's only one allowed title per author right now, we don't need to
    // add complicated logic to see which title should match the incoming PR; but,
    // this could be logic we work into the future.
    if (title.match(rulesToValidateAgainst.title)) {
      titlesMatch = true;
    }
    //check if changed file paths match
    if (rulesToValidateAgainst.changedFiles) {
      const changedFiles = await getChangedFiles(
        octokit,
        repoOwner,
        repo,
        prNumber
      );
      filePathsMatch = checkFilePathsMatch(
        changedFiles.map(x => x.filename),
        rulesToValidateAgainst
      );
    }

    //check if Valid number of max files
    if (rulesToValidateAgainst.maxFiles) {
      fileCountMatch =
        pr.pull_request.changed_files <= rulesToValidateAgainst.maxFiles;
    }
    logger.info(
      `Info for ${repoOwner}/${repo}/${prNumber}\nAuthor: ${rulesToValidateAgainst.author}\nTitles Match? ${titlesMatch}\nFile Paths Match? ${filePathsMatch}\nFile Count Matches? ${fileCountMatch}`
    );

    return titlesMatch && filePathsMatch && fileCountMatch;
  } else {
    logger.info(`${repoOwner}/${repo}/${prNumber} does not match config`);
    return false;
  }
}

/**
 * Returns true if all changes to the prFiles are permitted by the PR type.
 *
 * @param prFiles list of file paths printed by 'git log --name-only'
 * @param validTypeOfPR a valid pull request
 * @returns true if the file paths match the file paths allowed by the configuration, false if not
 */
export function checkFilePathsMatch(
  prFiles: string[],
  validTypeOfPR: ValidPr
): boolean {
  if (!validTypeOfPR.changedFiles) {
    return true;
  }
  let filesMatch = true;

  // Each file in a given PR should match at least one of the configuration rules
  // in auto-appprove.yml; should set filesMatch to false if at least one does not
  for (const file of prFiles) {
    if (!validTypeOfPR.changedFiles.some(x => file.match(x))) {
      filesMatch = false;
    }
  }
  return filesMatch;
}
