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

import {Octokit} from '@octokit/rest';
import {FileRule, PullRequest} from '../../interfaces';
import {
  checkAuthor,
  checkTitleOrBody,
  checkFileCount,
  checkFilePathsMatch,
  getJavaVersions,
  runVersioningValidation,
  isOneDependencyChanged,
  doesDependencyChangeMatchPRTitleV2,
  reportIndividualChecks,
} from '../../utils-for-pr-checking';
import {BaseLanguageRule} from '../base';

/**
 * The JavaDependency class's checkPR function returns
 * true if the PR:
  - has an author that is 'renovate-bot'
  - has a title that matches the regexp: /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/
  - has max 50 files changed
  - Each file path must match one of these regexps:
    - /pom.xml$/
  - All files must:
    - Match this regexp: /pom.xml$/
    - Increase the non-major package version of a dependency
    - Only change one dependency
    - Change the dependency that was there previously, and that is on the title of the PR, and is a Google dependency
 */
export class JavaSampleAppDependency extends BaseLanguageRule {
  classRule = {
    author: 'renovate-bot',
    titleRegex: /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
    maxFiles: 50,
    fileNameRegex: [/pom.xml$/, /build.gradle$/],
  };
  fileRules = [
    {
      targetFileToCheck: /pom.xml$/,
      // This would match: chore(deps): update dependency com.google.cloud:google-cloud-datacatalog to v1.4.2 or chore(deps): update dependency com.google.apis:google-api-services-policytroubleshooter to v1-rev20210319-1.32.1
      dependencyTitle: new RegExp(
        /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/
      ),
      /* This would match:
                  <groupId>com.google.apis</groupId>
                  <artifactId>google-api-services-policytroubleshooter</artifactId>
                  -      <version>v1-rev20210319-1.31.5</version>
                  or
                  <groupId>com.google.apis</groupId>
                  <artifactId>google-api-services-policytroubleshooter</artifactId>
                  -     <version>v1-rev20210319-1.31.5</version>
                */
      oldVersion: new RegExp(
        /<groupId>(?<oldDependencyNamePrefixPom>[^<]*)<\/groupId>[\s]*<artifactId>(?<oldDependencyNamePom>[^<]*)<\/artifactId>[\s]*-[\s]*<version>(?:v[0-9]-rev(?<oldRevVersionPom>[0-9]*)-(?<oldMajorRevVersionPom>[0-9]*)\.(?<oldMinorRevVersionPom>[0-9]*\.[0-9])|(?<oldMajorVersionPom>[0-9]*)\.(?<oldMinorVersionPom>[0-9]*\.[0-9]*))<\/version>[\s]*/
      ),
      /* This would match:
                  <groupId>com.google.cloud</groupId>
                  <artifactId>google-cloud-datacatalog</artifactId>
            -     <version>1.4.1</version>
            +     <version>1.4.2</version>
                  or
                   <groupId>com.google.apis</groupId>
                   <artifactId>google-api-services-policytroubleshooter</artifactId>
            -      <version>v1-rev20210319-1.31.5</version>
            +      <version>v1-rev20210319-1.32.1</version>
                */
      newVersion: new RegExp(
        /<groupId>(?<newDependencyNamePrefixPom>[^<]*)<\/groupId>[\s]*<artifactId>(?<newDependencyNamePom>[^<]*)<\/artifactId>[\s]*-[\s]*<version>(?:v[0-9]-rev[0-9]*-[0-9]*\.[0-9]*\.[0-9]|[[0-9]*\.[0-9]*\.[0-9]*)<\/version>[\s]*\+[\s]*<version>(v[0-9]-rev(?<newRevVersionPom>[0-9]*)-(?<newMajorRevVersionPom>[0-9]*)\.(?<newMinorRevVersionPom>[0-9]*\.[0-9])|(?<newMajorVersionPom>[0-9]*)\.(?<newMinorVersionPom>[0-9]*\.[0-9]*))<\/version>/
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

    for (const file of incomingPR.changedFiles) {
      const fileMatch = this.fileRules?.find((x: FileRule) =>
        x.targetFileToCheck.test(file.filename)
      );

      if (!fileMatch) {
        return false;
      }

      const versions = getJavaVersions(
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
