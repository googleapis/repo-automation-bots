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
  reportIndividualChecks,
  getGoVersions,
  runVersioningValidationWithShaOrRev,
  doesDependencyChangeMatchPRTitleGo,
} from '../../utils-for-pr-checking';
import {Octokit} from '@octokit/rest';
import {BaseLanguageRule} from '../base';

/**
 * The GoDependency class's checkPR function returns
 * true if the PR:
  - has an author is 'renovate-bot'
  - has a title that matches the regexp: /^(fix|chore)\(deps\): update (?:module (\D*?)|(\D*?) digest) to v?(\S*)$/
  - Each file path must match one of these regexp:
    - /go\.sum$/
    - /go\.mod$/
  - All files must:
    - Match this regexp: /go\.mod$/ (if it's go.sum, there are no additional checks, but it passes)
    - Increase the non-major package version of a dependency or digest
    - Change the dependency that was there previously, and that is on the title of the PR
 */
export class GoDependency extends BaseLanguageRule {
  classRule = {
    author: 'renovate-bot',
    titleRegex:
      /^(fix|chore)\(deps\): update (?:module (\D*?)|(\D*?) digest) to v?(\S*)$/,
    fileNameRegex: [/go\.sum$/, /go\.mod$/],
  };
  fileRules = [
    {
      targetFileToCheck: /go\.mod$/,
      // This would match: chore(deps): update cypress/included docker tag to v12.12.0
      dependencyTitle: new RegExp(
        /^(fix|chore)\(deps\): update (?:module (\D*?)|(\D*?) digest) to v?(\S*)$/
      ),

      // This would match: '-google.golang.org/grpc v1.50.0' or '-golang.org/x/net v0.0.0-20221012135044-0b7e1fb9d458'
      oldVersion: new RegExp(
        /-\t(\D*?)[\s](?:v([0-9])*\.([0-9]*\.[0-9]*)\n|v([0-9]*)\.([0-9]*\.[0-9]*)-([a-z0-9-]*))/
      ),
      // This would match: '+google.golang.org/grpc v1.50.0' or '+golang.org/x/net v0.0.0-20221012135044-0b7e1fb9d458'
      newVersion: new RegExp(
        /\+\t(\D*?)[\s](?:v([0-9])*\.([0-9]*\.[0-9]*)\n|v([0-9]*)\.([0-9]*\.[0-9]*)-([a-z0-9-]*))/
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

      const versions = getGoVersions(
        file,
        fileMatch.oldVersion,
        fileMatch.newVersion
      );

      if (!versions) {
        return false;
      }

      const doesDependencyMatch = doesDependencyChangeMatchPRTitleGo(
        versions,
        // We can assert this exists since we're in the class rule that contains it
        fileMatch.dependencyTitle!,
        incomingPR.title
      );

      const isVersionValid = runVersioningValidationWithShaOrRev(versions);

      if (!(doesDependencyMatch && isVersionValid)) {
        reportIndividualChecks(
          ['doesDependencyMatch', 'isVersionValid'],
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
