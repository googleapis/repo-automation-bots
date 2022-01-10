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

import {LanguageRule, File, FileRule, Process} from '../../interfaces';
import {
  checkAuthor,
  checkTitleOrBody,
  checkFileCount,
  checkFilePathsMatch,
  doesDependencyChangeMatchPRTitleV2,
  getVersionsV2,
  runVersioningValidation,
  isOneDependencyChanged,
  reportIndividualChecks,
} from '../../utils-for-pr-checking';
import {Octokit} from '@octokit/rest';

export class PythonDependency extends Process implements LanguageRule {
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
    incomingPrNumber: number,
    incomingOctokit: Octokit,
    incomingBody?: string
  ) {
    super(
      incomingPrAuthor,
      incomingTitle,
      incomingFileCount,
      incomingChangedFiles,
      incomingRepoName,
      incomingRepoOwner,
      incomingPrNumber,
      incomingOctokit,
      incomingBody
    ),
      (this.classRule = {
        author: 'renovate-bot',
        titleRegex:
          /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
        maxFiles: 3,
        fileNameRegex: [/requirements.txt$/],
        fileRules: [
          {
            targetFileToCheck: /^samples\/snippets\/requirements.txt$/,
            // This would match: fix(deps): update dependency @octokit to v1
            dependencyTitle: new RegExp(
              /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/
            ),
            // This would match: '-google-cloud-storage==1.39.0
            oldVersion: new RegExp(
              /[\s]-(@?[^=0-9]*)==([0-9])*\.([0-9]*\.[0-9]*)/
            ),
            // This would match: '+google-cloud-storage==1.40.0
            newVersion: new RegExp(
              /[\s]\+(@?[^=0-9]*)==([0-9])*\.([0-9]*\.[0-9]*)/
            ),
          },
        ],
      });
  }

  public async checkPR(): Promise<boolean> {
    const authorshipMatches = checkAuthor(
      this.classRule.author,
      this.incomingPR.author
    );

    const titleMatches = checkTitleOrBody(
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

    for (const file of this.incomingPR.changedFiles) {
      const fileMatch = this.classRule.fileRules?.find((x: FileRule) =>
        x.targetFileToCheck.test(file.filename)
      );

      if (fileMatch) {
        const versions = getVersionsV2(
          file,
          fileMatch.oldVersion,
          fileMatch.newVersion
        );
        if (versions) {
          const doesDependencyMatch = doesDependencyChangeMatchPRTitleV2(
            versions,
            // We can assert this exists since we're in the class rule that contains it
            fileMatch.dependencyTitle!,
            this.incomingPR.title
          );

          const isVersionValid = runVersioningValidation(versions);

          const oneDependencyChanged = isOneDependencyChanged(file);

          if (
            !(doesDependencyMatch && isVersionValid && oneDependencyChanged)
          ) {
            reportIndividualChecks(
              ['doesDependencyMatch', 'isVersionValid', 'oneDependencyChanged'],
              [doesDependencyMatch, isVersionValid, oneDependencyChanged],
              this.incomingPR.repoOwner,
              this.incomingPR.repoName,
              this.incomingPR.prNumber,
              file.filename
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
