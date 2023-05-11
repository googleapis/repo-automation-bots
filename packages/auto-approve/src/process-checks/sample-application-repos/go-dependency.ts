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
  isOneDependencyChanged,
  reportIndividualChecks,
  runVersioningValidation,
} from '../../utils-for-pr-checking';
import {Octokit} from '@octokit/rest';
import {BaseLanguageRule} from '../base';

/**
//TODO
 */
export class GoDependency extends BaseLanguageRule {
  classRule = {
    author: 'renovate-bot',
    titleRegex: /^(fix|chore)\(deps\): update module (\D*?) to v(\S*)$/,
    fileNameRegex: [/go\.sum$, go\.mod$/],
  };
  fileRules = [
    {
      targetFileToCheck: /go\.mod$/,
      // This would match: chore(deps): update cypress/included docker tag to v12.12.0
      dependencyTitle: new RegExp(
        /^(fix|chore)\(deps\): update module (\D*?) to v(\S*)$/
      ),

      // TODO: figure out how to confirm revs are changing if versions aren't
      // This would match: '-FROM cypress/included:12.11.0@sha256:29dfeed99db7a9678a4402f9175c98074c23bbb5ad109058702bc401fc3cdd02'
      oldVersion: new RegExp(/[\s]-(\D*?)[\s]v([0-9])*\.([0-9]*\.[0-9]*)/),
      // This would match: '+FROM cypress/included:12.11.0@sha256:29dfeed99db7a9678a4402f9175c98074c23bbb5ad109058702bc401fc3cdd02'
      newVersion: new RegExp(/[\s]+(\D*?)[\s]v([0-9])*\.([0-9]*\.[0-9]*)/),
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
      // Each file must conform to at least one file rule, or else we could
      // be allowing a random file to be approved
      const fileMatch = this.fileRules?.find((x: FileRule) =>
        x.targetFileToCheck.test(file.filename)
      );

      // In this particular case, we don't have any details to check for go.sum,
      // So just keep checking iterating through the PR's files to check go.mod files
      if (!fileMatch && /go\.sum$/.test(file.filename)) {
        continue;
      } else if (!fileMatch) {
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

      if (!(doesDependencyMatch && isVersionValid)) {
        reportIndividualChecks(
          ['doesDependencyMatch', 'isVersionValid', 'oneDependencyChanged'],
          [doesDependencyMatch, isVersionValid],
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
