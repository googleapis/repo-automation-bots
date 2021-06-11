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

import {File} from './get-pr-info';
import {ValidPr} from './check-pr';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);
export interface FileSpecificRule {
  prAuthor: string;
  targetFile: string;
  oldRegexVersion: string;
  newRegexVersion: string;
}

export interface Versions {
  oldMajorVersion: string;
  oldMinorVersion: string;
  newMajorVersion: string;
  newMinorVersion: string;
}

/**
 * Takes all of the files changed in a given PR, and checks them against a set of
 * language rules, to see if there are additional rules for that kind of file. In this case,
 * a given file name, plus the author of the PR, act as the 'key' to search for in the list
 * of rules in the json file.
 *
 * @param changedFiles an array of changed files from a PR
 * @param author the author of the PR
 * @param languageRules the json representation of additional rules for each kind of file
 * @returns an object containing the specific file to be scrutinized and the rules to scrutinize it by,
 * or undefined if not found.
 */
export function getTargetFile(
  changedFiles: File[],
  author: string,
  languageRules: FileSpecificRule[]
): {file: File; fileRule: FileSpecificRule} | undefined {
  let file;
  let fileRule;

  for (const i in changedFiles) {
    for (const j in languageRules) {
      if (
        languageRules[j].prAuthor === author &&
        languageRules[j].targetFile === changedFiles[i].filename
      ) {
        file = changedFiles[i];
        fileRule = languageRules[j];
        break;
      }
    }
  }

  // If we didn't find a match, return undefined, but this shouldn't
  // stop execution of the rest of the tests
  if (!(file && fileRule)) {
    return undefined;
  } else {
    return {file, fileRule};
  }
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
  oldVersionRegex: string,
  newVersionRegex: string
): Versions | undefined {
  if (!versionFile) {
    return undefined;
  }

  let oldMajorVersion;
  let oldMinorVersion;
  let newMajorVersion;
  let newMinorVersion;

  const oldVersions = versionFile.patch?.match(new RegExp(oldVersionRegex));
  const newVersions = versionFile.patch?.match(new RegExp(newVersionRegex));

  if (oldVersions) {
    oldMajorVersion = oldVersions[1];
    oldMinorVersion = oldVersions[2];
  }

  if (newVersions) {
    newMajorVersion = newVersions[1];
    newMinorVersion = newVersions[2];
  }

  // If there is a change with a file that requires special validation checks,
  // and we can't find these pieces of information, we should throw an error, and not
  // perform any other checks, since that would open us up to potentially merging a
  // sensitive file without having proper checks.
  if (
    !(oldMajorVersion && oldMinorVersion && newMajorVersion && newMinorVersion)
  ) {
    throw Error(
      `Could not find versions in ${versionFile.filename}/${versionFile.sha}`
    );
  }
  return {oldMajorVersion, oldMinorVersion, newMajorVersion, newMinorVersion};
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
