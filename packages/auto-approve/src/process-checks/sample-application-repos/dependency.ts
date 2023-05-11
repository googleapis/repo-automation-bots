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

import {FileRule, PullRequest} from '../../interfaces';
import {BaseLanguageRule} from '../base';
import {
  checkAuthor,
  checkTitleOrBody,
  checkFilePathsMatch,
  doesDependencyChangeMatchPRTitleV2,
  getVersionsV2,
  isOneDependencyChanged,
  reportIndividualChecks,
  isVersionBumped,
} from '../../utils-for-pr-checking';
import {Octokit} from '@octokit/rest';

/**
 * The PythonDependency class's checkPR function returns
 * true if the PR:
    - has an author that is 'renovate-bot'
    - Checks that the title of the PR matches the regexp: /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/
    - Each file path must match one of these regexps:
    - /requirements.txt$/
    - /^samples/wildcard/requirements(wildcard).txt$/
  - All files must:
    - Match this regexp: /requirements.txt$/
    - Increase the package version of a dependency (major or nonmajor)
    - Only change one dependency
    - Change the dependency that was there previously, and that is on the title of the PR
 */
export class PythonDependency extends BaseLanguageRule {
  classRule = {
    author: 'renovate-bot',
    titleRegex: /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
    fileNameRegex: [
      /^samples\/.*?\/.*?requirements.*?\.txt$/,
      /requirements\.txt$/,
    ],
  };
  fileRules = [
    {
      targetFileToCheck: /requirements.txt$/,
      // This would match: fix(deps): update dependency @octokit to v1
      dependencyTitle: new RegExp(
        /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/
      ),
      // This would match: '-google-cloud-storage==1.39.0
      oldVersion: new RegExp(/[\s]-(@?[^=0-9]*)==([0-9])*\.([0-9]*\.[0-9]*)/),
      // This would match: '+google-cloud-storage==1.40.0
      newVersion: new RegExp(/[\s]\+(@?[^=0-9]*)==([0-9])*\.([0-9]*\.[0-9]*)/),
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

    const filePatternsMatch = checkFilePathsMatch(
      incomingPR.changedFiles.map(x => x.filename),
      this.classRule.fileNameRegex
    );

    for (const file of incomingPR.changedFiles) {
      const fileMatch = this.fileRules?.find((x: FileRule) =>
        x.targetFileToCheck.test(file.filename)
      );

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
        incomingPR.title
      );

      const isVersionValid = isVersionBumped(versions);
      const oneDependencyChanged = isOneDependencyChanged(file);

      if (!(doesDependencyMatch && isVersionValid && oneDependencyChanged)) {
        reportIndividualChecks(
          ['doesDependencyMatch', 'isVersionValid', 'oneDependencyChanged'],
          [doesDependencyMatch, isVersionValid, oneDependencyChanged],
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
