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
import {PullRequestEvent} from '@octokit/webhooks-types/schema';
import {getChangedFiles} from './get-pr-info';
import {File, ValidPr} from './interfaces';
import {logger} from 'gcf-utils';
import {
  getTargetFiles,
  checkFilePathsMatch,
  correctNumberOfFiles,
} from './utils-for-pr-checking';
import {Octokit} from '@octokit/rest';

// This file manages the logic to check whether a given PR matches the config in the repository

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
  octokit: Octokit
): Promise<Boolean> {
  const repoOwner = pr.repository.owner.login;
  const prAuthor = pr.pull_request.user.login;
  const repo = pr.pull_request.base.repo.name;
  const prNumber = pr.number;
  const title = pr.pull_request.title;

  const rulesToValidateAgainst = config.rules.find(x => x.author === prAuthor);

  if (rulesToValidateAgainst) {
    // setting these to true, as this should be the default if
    // changedFiles and maxFiles are not set in the JSON schema
    let filePathsMatch = true;
    let fileCountMatch = true;
    let additionalRules = true;
    const releasePRFiles: File[] = [];

    // Since there's only one allowed title per author right now, we don't need to
    // add complicated logic to see which title should match the incoming PR; but,
    // this could be logic we work into the future.
    if (!title.match(rulesToValidateAgainst.title)) {
      logger.info(
        `Info for ${repoOwner}/${repo}/${prNumber} title does not match what is allowed`
      );
      return false;
    }

    // Get changed files fromPR
    const changedFiles = await getChangedFiles(
      octokit,
      repoOwner,
      repo,
      prNumber
    );

    // This function checks to see if the PR is a 'special' PR,
    // i.e., if its authorship qualifies it for further checks
    const fileAndFileRules = getTargetFiles(
      changedFiles,
      rulesToValidateAgainst.author,
      title
    );

    // If we've found the file in this ruleset, let's run the additional checks
    // We're running each file through the check so that we can make customized checks
    // for each file. This way, we can be as specific as possible as to how the file
    // needs to be checked.
    for (const fileAndFileRule of fileAndFileRules) {
      additionalRules = await fileAndFileRule.checkPR();

      if (additionalRules === false) {
        // Adding in logging statement and additional vars for debugging
        logger.info(
          `File ${fileAndFileRule.changedFile.filename} failed additional validation check for ${repoOwner}/${repo}/${prNumber}`
        );
        return false;
      }

      releasePRFiles.push(fileAndFileRule.changedFile);
    }

    // This additional check confirms that there were no files changed in the PR
    // that weren't checked by the additional files rule if it's from renovate-bot
    if (prAuthor === 'renovate-bot') {
      for (let i = 0; i < changedFiles.length; i++) {
        if (changedFiles[i] !== releasePRFiles[i]) {
          logger.info(
            `Info for ${repoOwner}/${repo}/${prNumber}: A file that should have been checked with additional guidelines was not checked`
          );
          return false;
        }
      }
    }

    //check if changed files counts match
    fileCountMatch = correctNumberOfFiles(rulesToValidateAgainst, pr);

    //check to see if file paths match
    filePathsMatch = checkFilePathsMatch(
      changedFiles.map(x => x.filename),
      rulesToValidateAgainst
    );
    logger.info(
      `Info for ${repoOwner}/${repo}/${prNumber} Author: ${rulesToValidateAgainst.author}`
    );
    logger.info(
      `Info for ${repoOwner}/${repo}/${prNumber} File Paths Match? ${filePathsMatch}`
    );
    logger.info(
      `Info for ${repoOwner}/${repo}/${prNumber} File Count Matches? ${fileCountMatch}`
    );
    logger.info(
      `Info for ${repoOwner}/${repo}/${prNumber} Additional rules are correct? ${additionalRules}`
    );

    return filePathsMatch && fileCountMatch && additionalRules;
  } else {
    logger.info(`${repoOwner}/${repo}/${prNumber} does not match config`);
    return false;
  }
}
