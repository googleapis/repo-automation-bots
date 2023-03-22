// Copyright 2023 Google LLC
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
  checkFilePathsMatch,
  doesDependencyChangeMatchPRTitleV2,
  getVersionsV2,
  runVersioningValidation,
  isOneDependencyChanged,
  reportIndividualChecks,
  doesDependencyMatchAgainstRegexes,
} from '../../utils-for-pr-checking';
import {Octokit} from '@octokit/rest';

export class PythonSampleDependency extends Process implements LanguageRule {
  classRule: {
    author: string;
    titleRegex?: RegExp;
    fileNameRegex?: RegExp[];
    fileRules?: {
      oldVersion?: RegExp;
      newVersion?: RegExp;
      dependencyTitle?: RegExp;
      targetFileToCheck: RegExp;
      targetFileToExclude: RegExp[];
      regexForDepToInclude: RegExp[];
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
        fileNameRegex: [/requirements.txt$/],
        fileRules: [
          {
            targetFileToCheck: /requirements.txt$/,
            // @Python team: please add API paths here to exclude from auto-approving
            targetFileToExclude: [/airflow/, /composer/],
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
            regexForDepToInclude: [/google/],
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

    const filePatternsMatch = checkFilePathsMatch(
      this.incomingPR.changedFiles.map(x => x.filename),
      this.classRule.fileNameRegex
    );

    for (const file of this.incomingPR.changedFiles) {
      // Each file must conform to at least one file rule, or else we could
      // be allowing a random file to be approved
      const fileMatch = this.classRule.fileRules?.find((x: FileRule) =>
        x.targetFileToCheck.test(file.filename)
      );

      if (fileMatch?.targetFileToExclude) {
        // Can disable the error message below because we are checking to see if
        // fileMatch.targetFileToExclude exists first
        // eslint-disable-next-line no-unsafe-optional-chaining
        for (const targetFilesToExclude of fileMatch?.targetFileToExclude) {
          // If any file contains an excluded name, exit out immediately
          if (targetFilesToExclude.test(file.filename)) {
            return false;
          }
        }
      }

      if (!fileMatch) {
        return false;
      }

      const versions = getVersionsV2(
        file,
        fileMatch.oldVersion,
        fileMatch.newVersion
      );

      if (!versions) {
        return false;
      }

      const doesDependencyMatch = doesDependencyChangeMatchPRTitleV2(
        versions,
        // We can assert this exists since we're in the class rule that contains it
        fileMatch.dependencyTitle!,
        this.incomingPR.title
      );

      const doesDependencyConformToRegexes = doesDependencyMatchAgainstRegexes(
        versions,
        fileMatch.regexForDepToInclude
      );

      const isVersionValid = runVersioningValidation(versions);

      const oneDependencyChanged = isOneDependencyChanged(file);

      if (
        !(
          doesDependencyMatch &&
          isVersionValid &&
          oneDependencyChanged &&
          doesDependencyConformToRegexes
        )
      ) {
        reportIndividualChecks(
          [
            'doesDependencyMatch',
            'isVersionValid',
            'oneDependencyChanged',
            'doesDependencyConformToRegexes',
          ],
          [
            doesDependencyMatch,
            isVersionValid,
            oneDependencyChanged,
            doesDependencyConformToRegexes,
          ],
          this.incomingPR.repoOwner,
          this.incomingPR.repoName,
          this.incomingPR.prNumber,
          file.filename
        );
        return false;
      }
    }

    reportIndividualChecks(
      ['authorshipMatches', 'titleMatches', 'filePatternsMatch'],
      [authorshipMatches, titleMatches, filePatternsMatch],
      this.incomingPR.repoOwner,
      this.incomingPR.repoName,
      this.incomingPR.prNumber
    );
    return authorshipMatches && titleMatches && filePatternsMatch;
  }
}
