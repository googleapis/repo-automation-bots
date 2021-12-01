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

import {LanguageRule, File, Process} from '../../interfaces';
import {
  checkAuthor,
  checkTitle,
  checkFileCount,
  checkFilePathsMatch,
  getVersionsV2,
  runVersioningValidation,
  isOneDependencyChanged,
  mergesOnWeekday,
  reportIndividualChecks,
} from '../../utils-for-pr-checking';
export class NodeRelease extends Process implements LanguageRule {
  classRule: {
    author: string;
    titleRegex?: RegExp;
    maxFiles: number;
    fileNameRegex?: RegExp[];
    fileRules?: {
      oldVersion?: RegExp;
      newVersion?: RegExp;
      dependencyTitle?: RegExp;
      targetFileToCheck: RegExp;
    }[];
  };

  constructor(
    incomingPrAuthor: string,
    incomingTitle: string,
    incomingFileCount: number,
    incomingChangedFiles: File[],
    incomingRepoName: string,
    incomingRepoOwner: string,
    incomingPrNumber: number
  ) {
    super(
      incomingPrAuthor,
      incomingTitle,
      incomingFileCount,
      incomingChangedFiles,
      incomingRepoName,
      incomingRepoOwner,
      incomingPrNumber
    ),
      (this.classRule = {
        author: 'release-please',
        titleRegex: /^chore: release/,
        maxFiles: 2,
        fileNameRegex: [/^package.json$/, /^CHANGELOG.md$/],
        fileRules: [
          {
            targetFileToCheck: /^package.json$/,
            // This would match: -  "version": "2.3.0"
            oldVersion: new RegExp(
              /-[\s]*"(@?\S*)":[\s]"([0-9]*)*\.([0-9]*\.[0-9]*)",/
            ),
            // This would match: +  "version": "2.3.0"
            newVersion: new RegExp(
              /\+[\s]*"(@?\S*)":[\s]"([0-9]*)*\.([0-9]*\.[0-9]*)",/
            ),
          },
        ],
      });
  }

  public checkPR(): boolean {
    const authorshipMatches = checkAuthor(
      this.classRule.author,
      this.incomingPR.author
    );

    const titleMatches = checkTitle(
      this.incomingPR.title,
      this.classRule.titleRegex
    );

    const fileCountMatch = checkFileCount(
      this.incomingPR.fileCount,
      this.classRule.maxFiles
    );

    const filePatternsMatch = checkFilePathsMatch(
      this.incomingPR.changedFiles.map(x => x.filename),
      this.classRule.fileNameRegex
    );

    for (const fileRule of this.classRule.fileRules!) {
      const fileMatch = this.incomingPR.changedFiles?.find((x: File) =>
        fileRule.targetFileToCheck.test(x.filename)
      );

      if (fileMatch) {
        const versions = getVersionsV2(
          fileMatch,
          fileRule.oldVersion,
          fileRule.newVersion
        );
        if (versions) {
          const isVersionValid = runVersioningValidation(versions);

          const oneDependencyChanged = isOneDependencyChanged(fileMatch);

          const isMergedOnWeekDay = mergesOnWeekday();

          if (!(isMergedOnWeekDay && isVersionValid && oneDependencyChanged)) {
            reportIndividualChecks(
              ['isMergedOnWeekDay', 'isVersionValid', 'oneDependencyChanged'],
              [isMergedOnWeekDay, isVersionValid, oneDependencyChanged],
              this.incomingPR.repoOwner,
              this.incomingPR.repoName,
              this.incomingPR.prNumber,
              fileMatch.filename
            );
            return false;
          }
        } else {
          return false;
        }
      } else {
        return false;
      }
    }

    reportIndividualChecks(
      [
        'authorshipMatches',
        'titleMatches',
        'fileCountMatches',
        'filePatternsMatch',
      ],
      [authorshipMatches, titleMatches, fileCountMatch, filePatternsMatch],
      this.incomingPR.repoOwner,
      this.incomingPR.repoName,
      this.incomingPR.prNumber
    );

    return (
      authorshipMatches && titleMatches && fileCountMatch && filePatternsMatch
    );
  }
}
