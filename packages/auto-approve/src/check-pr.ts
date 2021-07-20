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
import {PullRequestEvent} from '@octokit/webhooks-definitions/schema';
import {getChangedFiles, File} from './get-pr-info';
import {logger} from 'gcf-utils';
import {
  getTargetFiles,
  getVersions,
  isMajorVersionChanging,
  isMinorVersionUpgraded,
  isOneDependencyChanged,
  checkFilePathsMatch,
  doesDependencyChangeMatchPRTitle,
  Versions,
  mergesOnWeekday,
} from './utils-for-pr-checking';
import {Octokit} from '@octokit/rest';
import {languageVersioningRules} from './language-versioning-rules';
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
  octokit: Octokit
): Promise<Boolean> {
  const repoOwner = pr.repository.owner.login;
  const prAuthor = pr.pull_request.user.login;
  const repoBase = pr.pull_request.base.repo.name;
  const prNumber = pr.number;
  const title = pr.pull_request.title;

  const rulesToValidateAgainst = config.rules.find(x => x.author === prAuthor);

  if (rulesToValidateAgainst) {
    // setting these to true, as this should be the default if
    // changedFiles and maxFiles are not set in the JSON schema
    let filePathsMatch = true;
    let fileCountMatch = true;
    let additionalRules = true;
    let doesDependencyMatch;
    let isVersionValid;
    let oneDependencyChanged;
    const releasePRFiles: File[] = [];

    // Since there's only one allowed title per author right now, we don't need to
    // add complicated logic to see which title should match the incoming PR; but,
    // this could be logic we work into the future.
    if (!title.match(rulesToValidateAgainst.title)) {
      logger.info(
        `Info for ${repoOwner}/${repoBase}/${prNumber} title does not match what is allowed`
      );
      return false;
    }

    // Get changed files fromPR
    const changedFiles = await getChangedFiles(
      octokit,
      repoOwner,
      repoBase,
      prNumber
    );

    // This function checks to see if the PR is a 'special' PR,
    // i.e., if its authorship qualifies it for further checks
    const fileAndFileRules = getTargetFiles(
      changedFiles,
      rulesToValidateAgainst.author,
      languageVersioningRules
    );

    // If we've found the file in this ruleset, let's run the additional checks
    // We're running each file through the check so that we can make customized checks
    // for each file. This way, we can be as specific as possible as to how the file
    // needs to be checked.
    for (const fileAndFileRule of fileAndFileRules) {
      // First, get the versions we're checking for the file
      const versions = getVersions(
        fileAndFileRule.file,
        fileAndFileRule.fileRule.oldVersion!,
        fileAndFileRule.fileRule.newVersion!,
        fileAndFileRule.fileRule.process
      );

      // Have to enter different processes for different checks
      if (versions && fileAndFileRule.fileRule.process === 'release') {
        // If it's a release process, just make sure that the versions are minor
        // bumps and are increasing, and are only changing one at a time
        additionalRules =
          runVersioningValidation(versions) &&
          isOneDependencyChanged(fileAndFileRule.file) &&
          mergesOnWeekday();
      } else if (
        versions &&
        (fileAndFileRule.fileRule.process === 'dependency' ||
          fileAndFileRule.fileRule.process === 'java-dependency')
      ) {
        // If it's a dependency update process, make sure that the versions are minor
        // bumps and are increasing, are only changing one at a time, and are changing
        // the dependency they say they are supposed to change

        // At the end of the loop, we want to make sure that all of the changed files
        // in a renovate bot pr conform to one of the language versioning rules
        releasePRFiles.push(fileAndFileRule.file);

        doesDependencyMatch = doesDependencyChangeMatchPRTitle(
          versions,
          // We can assert dependency will exist, since the process is type 'dependency'
          fileAndFileRule.fileRule.dependency!,
          title,
          fileAndFileRule.fileRule.process
        );
        isVersionValid = runVersioningValidation(versions);
        oneDependencyChanged = isOneDependencyChanged(fileAndFileRule.file);
        additionalRules =
          doesDependencyMatch && isVersionValid && oneDependencyChanged;
      }

      if (additionalRules === false) {
        // Adding in logging statement and additional vars for debugging
        logger.info(
          `File ${fileAndFileRule.file.filename} failed additional validation check for ${repoOwner}/${repoBase}/${prNumber}: Does dependency match? ${doesDependencyMatch}, are the versions minor bumps? ${isVersionValid}, is only one dependency changed? ${oneDependencyChanged}`
        );
        return false;
      }
    }

    // This additional check confirms that there were no files changed in the PR
    // that weren't checked by the additional files rule if it's from renovate-bot
    if (prAuthor === 'renovate-bot') {
      for (let i = 0; i < changedFiles.length; i++) {
        if (changedFiles[i] !== releasePRFiles[i]) {
          logger.info(
            `Info for ${repoOwner}/${repoBase}/${prNumber}: A file that should have been checked with additional guidelines was not checked`
          );
          return false;
        }
      }
    }

    //check if changed file paths match
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
      `Info for ${repoOwner}/${repoBase}/${prNumber} Author: ${rulesToValidateAgainst.author}`
    );
    logger.info(
      `Info for ${repoOwner}/${repoBase}/${prNumber} File Paths Match? ${filePathsMatch}`
    );
    logger.info(
      `Info for ${repoOwner}/${repoBase}/${prNumber} File Count Matches? ${fileCountMatch}`
    );
    logger.info(
      `Info for ${repoOwner}/${repoBase}/${prNumber} Additional rules are correct? ${additionalRules}`
    );

    return filePathsMatch && fileCountMatch && additionalRules;
  } else {
    logger.info(`${repoOwner}/${repoBase}/${prNumber} does not match config`);
    return false;
  }
}

/**
 * Runs additional validation checks when a version is upgraded to ensure that the
 * version is only upgraded, not downgraded, and that the major version is not bumped.
 *
 * @param file The incoming target file that has a matching ruleset in language-versioning-rules
 * @param pr The matching ruleset of the file above from language-versioning-rules
 * @returns true if the package was upgraded appropriately, and had only one thing changed
 */
function runVersioningValidation(versions: Versions): boolean {
  let majorBump = true;
  let minorBump = false;

  if (versions) {
    majorBump = isMajorVersionChanging(versions);
    minorBump = isMinorVersionUpgraded(versions);
  }

  return !majorBump && minorBump;
}
