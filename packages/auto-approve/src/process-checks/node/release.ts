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

import {File, PullRequest} from '../../interfaces';
import {
  checkAuthor,
  checkTitleOrBody,
  checkFileCount,
  checkFilePathsMatch,
  getVersionsV2,
  runVersioningValidation,
  isOneDependencyChanged,
  mergesOnWeekday,
  reportIndividualChecks,
} from '../../utils-for-pr-checking';
import {Octokit} from '@octokit/rest';
import {BaseLanguageRule} from '../base';

/**
 * The NodeRelease class's checkPR function returns
 * true if the PR:
  - has an author that is 'release-please'
  - has a title that matches the regexp: /^chore: release/
  - has max 2 files changed in the PR
  - Each file path must match one of these regexps:
    - /^package.json$/
    - /^CHANGELOG.md$/
  - At least one file must:
    - Match either this regexp: /^package.json$/
    - Increase the non-major package version
    - Only change the top-level package
    - Approve on a day between Mon - Thurs PST (so as to not trigger a weekend release)
 */
export class NodeRelease extends BaseLanguageRule {
  classRule = {
    author: 'release-please',
    titleRegex: /^chore: release/,
    maxFiles: 2,
    fileNameRegex: [/^package.json$/, /^CHANGELOG.md$/],
  };
  fileRules = [
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
  ];

  constructor(octokit: Octokit) {
    super(octokit);
  }
  public async checkPR(incomingPR: PullRequest): Promise<boolean> {
    const authorshipMatches = checkAuthor(
      this.classRule.author,
      incomingPR.author
    );

    const titleMatches = checkTitleOrBody(
      incomingPR.title,
      this.classRule.titleRegex
    );

    const fileCountMatch = checkFileCount(
      incomingPR.fileCount,
      this.classRule.maxFiles
    );

    const filePatternsMatch = checkFilePathsMatch(
      incomingPR.changedFiles.map((x: {filename: string}) => x.filename),
      this.classRule.fileNameRegex
    );

    for (const fileRule of this.fileRules!) {
      const fileMatch = incomingPR.changedFiles?.find((x: File) =>
        fileRule.targetFileToCheck.test(x.filename)
      );

      if (!fileMatch) {
        return false;
      }

      const versions = getVersionsV2(
        fileMatch,
        fileRule.oldVersion,
        fileRule.newVersion
      );

      if (!versions) {
        return false;
      }

      const isVersionValid = runVersioningValidation(versions);

      const oneDependencyChanged = isOneDependencyChanged(fileMatch);

      const isMergedOnWeekDay = mergesOnWeekday();

      if (!(isMergedOnWeekDay && isVersionValid && oneDependencyChanged)) {
        reportIndividualChecks(
          ['isMergedOnWeekDay', 'isVersionValid', 'oneDependencyChanged'],
          [isMergedOnWeekDay, isVersionValid, oneDependencyChanged],
          incomingPR.repoOwner,
          incomingPR.repoName,
          incomingPR.prNumber,
          fileMatch.filename
        );
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
      incomingPR.repoOwner,
      incomingPR.repoName,
      incomingPR.prNumber
    );

    return (
      authorshipMatches && titleMatches && fileCountMatch && filePatternsMatch
    );
  }
}
