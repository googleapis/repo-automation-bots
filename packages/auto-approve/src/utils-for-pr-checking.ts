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

import {File, ValidPr, Versions} from './interfaces';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import {PullRequestEvent} from '@octokit/webhooks-types/schema';
import * as node from './language-rules/node';
import * as python from './language-rules/python';
import * as java from './language-rules/java';

dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * Takes all of the files changed in a given PR, and checks them against a set of
 * language rules, to see if there are additional rules for that kind of file. In this case,
 * a given file name, plus the author of the PR, act as the 'key' to search for in the list
 * of rules in the json file.
 *
 * @param changedFiles an array of changed files from a PR
 * @param author the author of the PR
 * @returns an array of objects containing the specific files to be scrutinized.
 */
export function getTargetFiles(
  changedFiles: File[],
  author: string,
  title: string
) {
  const languages = [node, java, python];
  const languageChecks = [];

  for (const changedFile of changedFiles) {
    for (const language of languages) {
      const fileMatch = language.PERMITTED_FILES.find(
        (x: {prAuthor: string; targetFile: RegExp}) =>
          x.prAuthor === author && x.targetFile.test(changedFile.filename)
      );

      if (fileMatch) {
        const languageRule = new language.Rules(
          changedFile,
          author,
          fileMatch,
          title
        );
        languageChecks.push(languageRule);
      }
    }
  }

  return languageChecks;
}

/**
 * Given a patch for a file that was changed in a PR, and a regular expression to search
 * for the old version number and a regular expression to search for the new version number,
 * this function will return the old and new versions of a package.
 *
 * @param versionFile the changed file that has additional rules to conform to
 * @param oldVersionRegex the regular exp to find the old version number of whatever is being changed
 * @param newVersionRegex the regular exp to find the new version number of whatever is being changed
 * @returns the previous and new major and minor versions of a package in an object containing those 4 properties.
 */
export function getVersions(
  versionFile: File | undefined,
  oldVersionRegex: RegExp,
  newVersionRegex: RegExp
): Versions | undefined {
  if (!versionFile) {
    return undefined;
  }

  let oldDependencyName;
  let newDependencyName;
  let oldMajorVersion;
  let oldMinorVersion;
  let newMajorVersion;
  let newMinorVersion;

  const oldVersions = versionFile.patch?.match(oldVersionRegex);
  const newVersions = versionFile.patch?.match(newVersionRegex);
  if (oldVersions) {
    oldDependencyName = oldVersions[1];
    oldMajorVersion = oldVersions[2];
    oldMinorVersion = oldVersions[3];
  }

  if (newVersions) {
    newDependencyName = newVersions[1];
    newMajorVersion = newVersions[2];
    newMinorVersion = newVersions[3];
  }

  // If there is a change with a file that requires special validation checks,
  // and we can't find these pieces of information, we should throw an error, and not
  // perform any other checks, since that would open us up to potentially merging a
  // sensitive file without having proper checks.
  if (
    !(
      oldDependencyName &&
      newDependencyName &&
      oldMajorVersion &&
      oldMinorVersion &&
      newMajorVersion &&
      newMinorVersion
    )
  ) {
    throw Error(
      `Could not find versions in ${versionFile.filename}/${versionFile.sha}`
    );
  }
  return {
    oldDependencyName,
    newDependencyName,
    oldMajorVersion,
    oldMinorVersion,
    newMajorVersion,
    newMinorVersion,
  };
}

/**
 * Given a patch for a file that was changed in a PR, and a regular expression to search
 * for the old version number and a regular expression to search for the new version number,
 * this function will return the old and new versions of a package for a Java file.
 *
 * @param versionFile the changed file that has additional rules to conform to
 * @param oldVersionRegex the regular exp to find the old version number of whatever is being changed
 * @param newVersionRegex the regular exp to find the new version number of whatever is being changed
 * @returns the previous and new major and minor versions of a package in an object containing those 4 properties.
 */
export function getJavaVersions(
  versionFile: File | undefined,
  oldVersionRegex: RegExp,
  newVersionRegex: RegExp
): Versions | undefined {
  if (!versionFile) {
    return undefined;
  }

  let oldDependencyName;
  let newDependencyName;
  let oldMajorVersion;
  let oldMinorVersion;
  let newMajorVersion;
  let newMinorVersion;

  const oldVersions = versionFile.patch?.match(oldVersionRegex);
  const newVersions = versionFile.patch?.match(newVersionRegex);
  if (oldVersions) {
    oldDependencyName = `${oldVersions[1]}:${oldVersions[2]}`;
    oldMajorVersion = oldVersions[4] || oldVersions[6];
    oldMinorVersion = oldVersions[5] || oldVersions[7];
  }

  if (newVersions) {
    newDependencyName = `${newVersions[1]}:${newVersions[2]}`;
    newMajorVersion = newVersions[5] || newVersions[7];
    newMinorVersion = newVersions[6] || newVersions[8];
  }

  // If there is a change with a file that requires special validation checks,
  // and we can't find these pieces of information, we should throw an error, and not
  // perform any other checks, since that would open us up to potentially merging a
  // sensitive file without having proper checks.
  if (
    !(
      oldDependencyName &&
      newDependencyName &&
      oldMajorVersion &&
      oldMinorVersion &&
      newMajorVersion &&
      newMinorVersion
    )
  ) {
    throw Error(
      `Could not find versions in ${versionFile.filename}/${versionFile.sha}`
    );
  }

  return {
    oldDependencyName,
    newDependencyName,
    oldMajorVersion,
    oldMinorVersion,
    newMajorVersion,
    newMinorVersion,
  };
}
/**
 * This function checks whether the dependency stated in a given title was the one that was changed
 *
 * @param versions the Versions object that contains the old dependency name and new dependency name and versions
 * @param dependencyRegex the regular exp to find the dependency within the title of the PR
 * @param title the title of the PR
 * @returns whether the old dependency, new dependency, and dependency in the title all match
 */
export function doesDependencyChangeMatchPRTitle(
  versions: Versions,
  dependencyRegex: RegExp,
  title: string
): boolean {
  let dependencyName;
  const titleRegex = title.match(dependencyRegex);

  if (titleRegex) {
    dependencyName = titleRegex[2];

    return (
      versions.newDependencyName === versions.oldDependencyName &&
      dependencyName === versions.newDependencyName
    );
  }

  return false;
}

/**
 * This function checks whether the dependency stated in a given title was the one that was changed in a Java file
 *
 * @param versions the Versions object that contains the old dependency name and new dependency name and versions
 * @param dependencyRegex the regular exp to find the dependency within the title of the PR
 * @param title the title of the PR
 * @returns whether the old dependency, new dependency, and dependency in the title all match
 */
export function doesDependencyChangeMatchPRTitleJava(
  versions: Versions,
  dependencyRegex: RegExp,
  title: string
): boolean {
  let dependencyName;
  const titleRegex = title.match(dependencyRegex);

  if (titleRegex) {
    dependencyName = titleRegex[2];

    if (!dependencyName.includes('com.google.')) {
      return false;
    }
    return (
      versions.newDependencyName === versions.oldDependencyName &&
      dependencyName === versions.newDependencyName
    );
  }

  return false;
}

/**
 * This function determines whether the major version of a package was changed.
 *
 * @param versions an object containing the previous and newer versions of the package being updated
 * @returns whether the major version changed.
 */
export function isMajorVersionChanging(versions: Versions): boolean {
  return versions.newMajorVersion !== versions.oldMajorVersion;
}

/**
 * This function determines whether the minor version of a package was updated.
 *
 * @param versions an object containing the previous and newer versions of the package being updated
 * @returns whether the minor version was upgraded.
 */
export function isMinorVersionUpgraded(versions: Versions): boolean {
  return Number(versions.newMinorVersion) > Number(versions.oldMinorVersion);
}

/**
 * This function determines whether there was at most one change in the given file.
 *
 * @param versionFile the file that has the specific rules to conform to
 * @returns if only one dependency was changed in the file
 */
export function isOneDependencyChanged(versionFile: File): boolean {
  return (
    versionFile.additions === 1 &&
    versionFile.deletions === 1 &&
    versionFile.changes === 2
  );
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

/**
 * Checks whether the attempted merge is happening during the week.
 *
 * @returns true if merge is happening on the weekday, false if it's on Friday or the weekend.
 */
export function mergesOnWeekday(): boolean {
  const date = dayjs.tz(Date.now(), 'America/Los_Angeles');
  const dayOfWeek = date.day();
  if (dayOfWeek >= 5 || dayOfWeek === 0) {
    return false;
  }
  return true;
}

/**
 * Runs additional validation checks when a version is upgraded to ensure that the
 * version is only upgraded, not downgraded, and that the major version is not bumped.
 *
 * @param file The incoming target file that has a matching ruleset in language-versioning-rules
 * @param pr The matching ruleset of the file above from language-versioning-rules
 * @returns true if the package was upgraded appropriately, and had only one thing changed
 */
export function runVersioningValidation(versions: Versions): boolean {
  let majorBump = true;
  let minorBump = false;

  if (versions) {
    majorBump = isMajorVersionChanging(versions);
    minorBump = isMinorVersionUpgraded(versions);
  }

  return !majorBump && minorBump;
}

/**
 * Checks to see if there is an appropriate number of files changed.
 *
 * @param rulesToValidateAgainst The matching ruleset of the file above from language-versioning-rules
 * @param pr The incoming pr
 * @returns true if there is a max number of files and the pr is under those files, or if there isn't a max number of files
 */
export function correctNumberOfFiles(
  rulesToValidateAgainst: ValidPr,
  pr: PullRequestEvent
) {
  //check if Valid number of max files
  if (rulesToValidateAgainst.maxFiles) {
    return pr.pull_request.changed_files <= rulesToValidateAgainst.maxFiles;
  }

  return true;
}
