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
  isVersionValidWithShaOrRev,
} from '../../utils-for-pr-checking';
import {Octokit} from '@octokit/rest';
import {BaseLanguageRule} from '../base';

/**
 * The DockerDependency class's checkPR function returns
 * true if the PR:
  - has an author that is 'renovate-bot'
  - has a title of the PR matches the regexp: /^(fix|chore)\(deps\): update (\D[^:?]*).* docker (digest|tag) to (.*)$/
  - Each file path must match this regexp:
    - /Dockerfile$/
  - All files must:
    - Match this regexp: /Dockerfile$/
    - Increase the non-major package version of a dependency or the tag
    - Only change one dependency
    - Change the dependency that was there previously, and that is on the title of the PR */
export class DockerDependency extends BaseLanguageRule {
  classRule = {
    author: 'renovate-bot',
    titleRegex:
      /^(fix|chore)\(deps\): update (\D[^:?]*).* docker (digest|tag) to (.*)$/,
    fileNameRegex: [/Dockerfile$/],
  };
  fileRules = [
    {
      targetFileToCheck: /Dockerfile$/,
      // This would match: chore(deps): update cypress/included docker tag to v12.12.0
      dependencyTitle: new RegExp(
        /^(fix|chore)\(deps\): update (\D[^:?]*).* docker (digest|tag) to (.*)$/
      ),
      // This would match: '-FROM cypress/included:12.11.0@sha256:29dfeed99db7a9678a4402f9175c98074c23bbb5ad109058702bc401fc3cdd02'
      oldVersion: new RegExp(
        /-FROM[\s](\D*):([0-9]*)\.([0-9]*\.[0-9]*).*@sha256:([a-z0-9]{64})/
      ),
      // This would match: '+FROM cypress/included:12.11.0@sha256:29dfeed99db7a9678a4402f9175c98074c23bbb5ad109058702bc401fc3cdd02'
      newVersion: new RegExp(
        /\+FROM[\s](\D*):([0-9]*)\.([0-9]*\.[0-9]*).*@sha256:([a-z0-9]{64})/
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

      const isVersionValid = isVersionValidWithShaOrRev(versions);

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
