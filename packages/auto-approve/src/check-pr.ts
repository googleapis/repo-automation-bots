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
import {getChangedFiles, File} from './get-PR-info';
import {logger} from 'gcf-utils';
import {
  FileSpecificRule,
  getTargetFile,
  getVersions,
  isMajorVersionChanging,
  isMinorVersionUpgraded,
  isOneDependencyChanged,
  checkFilePathsMatch,
} from './utils-for-PR-checking';
import languageVersioningRules from './language-versioning-rules.json';
// type PullsListFilesResponseData = operations['pulls/list-files']['responses']['200']['application/json'];

// This file manages the logic to check whether a given PR matches the config in the repository

export interface ValidPr {
  author: string;
  title: string;
  changedFiles?: string[];
  maxFiles?: number;
}

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
    let versionChecks = true;

    // Since there's only one allowed title per author right now, we don't need to
    // add complicated logic to see which title should match the incoming PR; but,
    // this could be logic we work into the future.
    if (!title.match(rulesToValidateAgainst.title)) {
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
    const fileAndFileRule = getTargetFile(
      changedFiles,
      rulesToValidateAgainst.author,
      languageVersioningRules
    );

    // If we've found the file in this ruleset, let's run the additional checks
    if (fileAndFileRule) {
      // TODO: make the checks conditional based on the different kinds of conditions
      // to be checked, i.e., runDependencyUpgradeValidation, etc.
      versionChecks = runVersioningValidation(fileAndFileRule);
    }

    //check if changed file paths match1
    if (rulesToValidateAgainst.changedFiles) {
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
      `Info for ${repoOwner}/${repo}/${prNumber}\nAuthor: ${rulesToValidateAgainst.author}\nFile Paths Match? ${filePathsMatch}\nFile Count Matches? ${fileCountMatch}\nVersions are correct? ${versionChecks}`
    );

    return filePathsMatch && fileCountMatch && versionChecks;
  } else {
    logger.info(`${repoOwner}/${repo}/${prNumber} does not match config`);
    return false;
  }
}

/**
 * Runs additional validation checks when a version is upgraded to ensure that the
 * version is only upgraded, not downgraded, and that the major version is not bumped.
 * Also ensures that only one package is changed at a time.
 *
 * @param file The incoming target file that has a matching ruleset in language-versioning-rules
 * @param pr The matching ruleset of the file above from language-versioning-rules
 * @returns true if the package was upgraded appropriately, and had only one thing changed
 */
function runVersioningValidation(addtlValidationFile?: {
  file: File;
  fileRule: FileSpecificRule;
}): boolean {
  let majorBump = true;
  let minorBump = false;
  let oneDependencyChanged = false;
  // If there's no additional validation file, then it will
  // be trivially true
  if (!addtlValidationFile) {
    return true;
  }

  // We can assert addtlValidationFile exists since we exit if it doesn't
  // before we enter these checks
  const versions = getVersions(
    addtlValidationFile.file!,
    addtlValidationFile.fileRule!.oldRegexVersion,
    addtlValidationFile.fileRule!.newRegexVersion
  );

  if (versions) {
    majorBump = isMajorVersionChanging(versions);
    minorBump = isMinorVersionUpgraded(versions);
    oneDependencyChanged = isOneDependencyChanged(addtlValidationFile.file!);
  }

  return !majorBump && minorBump && oneDependencyChanged;
}
