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
  reportIndividualChecks,
} from '../../utils-for-pr-checking';
import {Octokit} from '@octokit/rest';
import {BaseLanguageRule} from '../base';

/**
 * The NodeGeneratorDependency class's checkPR function returns
 * true if the PR:
  - has an author that is 'renovate-bot'
  - has a title that matches the regexp: /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/
  - Each file path must match one of these regexps:
    - /package\.json$/
    - /.bzl$/
    - /pnpm-lock.yaml$/
  - All files must:
    - Match either these regexp:
        - /package\.json$/
        - /.bzl$/
    - Increase the non-major package version of a dependency
    - Change the dependency that was there previously, and that is on the title of the PR
 */
export class NodeGeneratorDependency extends BaseLanguageRule {
  classRule = {
    author: 'renovate-bot',
    titleRegex:
      // This would match: fix(deps): update dependency @octokit/rest to v19.0.8 or ^0.23.0 or ~0.23.0
      /^(fix|chore)\(deps\): update dependency (@?\S*) to v?\^?~?(\S*)$/,
    fileNameRegex: [/package\.json$/, /\.bzl$/, /pnpm-lock\.yaml$/],
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
    {
      dependencyTitle:
        // This would match: fix(deps): update dependency @octokit/rest to v19.0.8 or ^0.23.0 or ~0.23.0
        /^(fix|chore)\(deps\): update dependency (@?\S*) to v?\^?~?(\S*)$/,
      targetFileToCheck: /\.bzl$/,
      /* This would match:
               name = "com_google_protobuf",
        -      sha256 = "39b52572da90ad54c883a828cb2ca68e5ac918aa75d36c3e55c9c76b94f0a4f7",
        -      strip_prefix = "protobuf-24.2",
        -      urls = ["https://github.com/protocolbuffers/protobuf/archive/v24.2.tar.gz"],
      */
      oldVersion:
        /[\s]*name = "(@?\S*)",\n-[\s]*sha256 = "\S*",\n-[\s]*strip_prefix = "\w*-(\d*)\.(\d*|\d*\.\d*)",\n-[\s]*urls? = \S*/,
      /* This would match:
            name = "aspect_rules_js",
        -    anything,
        -    anything,
        -    anything,
        +    sha256 = "e3e6c3d42491e2938f4239a3d04259a58adc83e21e352346ad4ef62f87e76125",
        +    strip_prefix = "rules_js-1.30.0",
        +    url = "https://github.com/aspect-build/rules_js/archive/refs/tags/v1.30.0.tar.gz",
      */ newVersion:
        /[\s]*name = "(@?\S*)",\n-.*\n-.*\n-.*\n\+[\s]*sha256 = "\S*",\n\+[\s]*strip_prefix = "\w*-(\d*)\.(\d*|\d*\.\d*)",\n\+[\s]*urls? = \S*/,
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

      if (!fileMatch && file.filename.match(/pnpm-lock.yaml$/)) {
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

      if ((doesDependencyMatch && isVersionValid) === false) {
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
