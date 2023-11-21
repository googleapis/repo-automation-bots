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

import {FileRule, PullRequest} from '../../interfaces';
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
import {BaseLanguageRule} from '../base';

/**
 * The PythonSampleDependency class's checkPR function returns
 * true if the PR:
  - has an author that is 'renovate-bot'
  - has a title that matches the regexp: /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/
  - Each file path must match one of these regexps:
    - /requirements.txt$/
  - All files must:
    - Match this regexp: /requirements.txt$/
    - Increase the non-major package version of a dependency
    - Only change one dependency, that must be a google dependency
    - Change the dependency that was there previously, and that is on the title of the PR
    - Not match any regexes in the 'excluded' list
 */
export class PythonSampleDependency extends BaseLanguageRule {
  classRule = {
    authors: ['renovate-bot', 'dependabot'],
    titleRegex: [
      /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
      /^(chore)\(deps\): bump (@?\S*) from \S* to (\S*) in \S*/,
    ],
    fileNameRegex: [/requirements.txt$/],
  };
  fileRules = [
    {
      targetFileToCheck: /requirements.txt$/,
      // @Python team: please add API paths here to exclude from auto-approving
      targetFileToExclude: [/airflow/, /composer/],
      // This would match: fix(deps): update dependency @octokit to v1
      dependencyTitles: [
        /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
        /^(chore)\(deps\): bump (@?\S*) from \S* to v?([0-9]*)\.([0-9]*\.?[0-9]*) in \S*/,
      ],
      // This would match: '-google-cloud-storage==1.39.0
      oldVersion: new RegExp(/[\s]-(@?[^=0-9]*)==([0-9])*\.([0-9]*\.[0-9]*)/),
      // This would match: '+google-cloud-storage==1.40.0
      newVersion: new RegExp(/[\s]\+(@?[^=0-9]*)==([0-9])*\.([0-9]*\.[0-9]*)/),
      regexForDepToNotInclude: [/airflow/, /composer/, /secretmanager/],
    },
  ];

  constructor(octokit: Octokit) {
    super(octokit);
  }

  public async checkPR(incomingPR: PullRequest): Promise<boolean> {
    const authorshipMatches = checkAuthor(
      this.classRule.authors,
      incomingPR.author
    );

    const titleMatches = checkTitleOrBody(
      incomingPR.title,
      this.classRule.titleRegex
    );

    const filePatternsMatch = checkFilePathsMatch(
      incomingPR.changedFiles.map(x => x.filename),
      this.classRule.fileNameRegex
    );

    for (const file of incomingPR.changedFiles) {
      // Each file must conform to at least one file rule, or else we could
      // be allowing a random file to be approved
      const fileMatch = this.fileRules?.find((x: FileRule) =>
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

      let doesDependencyMatch = false;
      for (const dependencyTitle of fileMatch.dependencyTitles) {
        if (
          doesDependencyChangeMatchPRTitleV2(
            versions,
            // We can assert this exists since we're in the class rule that contains it
            dependencyTitle,
            incomingPR.title
          )
        ) {
          doesDependencyMatch = true;
        }
      }

      const doesDependencyConformToRegexes = !doesDependencyMatchAgainstRegexes(
        versions,
        fileMatch.regexForDepToNotInclude
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
          incomingPR.repoOwner,
          incomingPR.repoName,
          incomingPR.prNumber,
          file.filename
        );
        return false;
      }
    }

    reportIndividualChecks(
      ['authorshipMatches', 'titleMatches', 'filePatternsMatch'],
      [authorshipMatches, titleMatches, filePatternsMatch],
      incomingPR.repoOwner,
      incomingPR.repoName,
      incomingPR.prNumber
    );
    return authorshipMatches && titleMatches && filePatternsMatch;
  }
}
