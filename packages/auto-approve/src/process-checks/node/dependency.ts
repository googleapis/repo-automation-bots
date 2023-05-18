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
import {
  checkAuthor,
  checkTitleOrBody,
  checkFilePathsMatch,
  doesDependencyChangeMatchPRTitleV2,
  getVersionsV2,
  runVersioningValidation,
  isOneDependencyChanged,
  reportIndividualChecks,
} from '../../utils-for-pr-checking';
import {Octokit} from '@octokit/rest';
import {BaseLanguageRule} from '../base';

/**
 * The NodeDependency class's checkPR function returns
 * true if the PR:
  - has an author that is 'renovate-bot'
  - has a title that matches the regexp: /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/
  - Each file path must match one of these regexps:
    - /package\.json$/
  - All files must:
    - Match either these regexp:
      - /^samples\/package.json$/
      - /^\/package.json$/
    - Increase the non-major package version of a dependency
    - Only change one dependency
    - Change the dependency that was there previously, and that is on the title of the PR
 */
export class NodeDependency extends BaseLanguageRule {
  classRule = {
    author: 'renovate-bot',
    titleRegex:
      // This would match: fix(deps): update dependency @octokit/rest to v19.0.8 or ^0.23.0 or ~0.23.0
      /^(fix|chore)\(deps\): update dependency (@?\S*) to v?\^?~?(\S*)$/,
    fileNameRegex: [/package\.json$/],
  };
  fileRules = [
    {
      dependencyTitle:
        // This would match: fix(deps): update dependency @octokit/rest to v19.0.8 or ^0.23.0 or ~0.23.0
        /^(fix|chore)\(deps\): update dependency (@?\S*) to v?\^?~?(\S*)$/,
      targetFileToCheck: /package.json$/,
      // This would match: -  "version": "^2.3.0" or -  "version": "~2.3.0"
      oldVersion: /-[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)"/,
      // This would match: +  "version": "^2.3.0" or +  "version": "~2.3.0"
      newVersion: /\+[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)"/,
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
      incomingPR.changedFiles.map((x: {filename: string}) => x.filename),
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

      const isVersionValid = runVersioningValidation(versions);

      const oneDependencyChanged = isOneDependencyChanged(file);

      if (
        (doesDependencyMatch && isVersionValid && oneDependencyChanged) ===
        false
      ) {
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
