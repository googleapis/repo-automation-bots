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

import {Octokit} from '@octokit/rest';
import {LanguageRule, File, FileRule, Process} from '../../interfaces';
import {
  checkAuthor,
  checkTitleOrBody,
  checkFileCount,
  checkFilePathsMatch,
  getJavaVersions,
  runVersioningValidation,
  isOneDependencyChanged,
  doesDependencyChangeMatchPRTitleJava,
  reportIndividualChecks,
} from '../../utils-for-pr-checking';

export class JavaDependency extends Process implements LanguageRule {
  classRule: {
    author: string;
    titleRegex?: RegExp;
    maxFiles: number;
    fileNameRegex?: RegExp[];
    fileRules?: {
      oldVersion?: RegExp;
      newVersion?: RegExp;
      dependencyTitle?: RegExp;
      targetFileToCheck: RegExp;
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
        maxFiles: 50,
        fileNameRegex: [/pom.xml$/, /build.gradle$/],
        fileRules: [
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
              /<groupId>([^<]*)<\/groupId>[\s]*<artifactId>([^<]*)<\/artifactId>[\s]*-[\s]*<version>(v[0-9]-rev([0-9]*)-([0-9]*)\.([0-9]*\.[0-9])|([0-9]*)\.([0-9]*\.[0-9]*))<\/version>[\s]*/
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
              /<groupId>([^<]*)<\/groupId>[\s]*<artifactId>([^<]*)<\/artifactId>[\s]*-[\s]*<version>(v[0-9]-rev[0-9]*-[0-9]*\.[0-9]*\.[0-9]|[[0-9]*\.[0-9]*\.[0-9]*)<\/version>[\s]*\+[\s]*<version>(v[0-9]-rev([0-9]*)-([0-9]*)\.([0-9]*\.[0-9])|([0-9]*)\.([0-9]*\.[0-9]*))<\/version>/
            ),
          },
          {
            targetFileToCheck: /build.gradle$/,
            // This would match: chore(deps): update dependency com.google.cloud:google-cloud-datacatalog to v1.4.2 or chore(deps): update dependency com.google.apis:google-api-services-policytroubleshooter to v1-rev20210319-1.32.1
            dependencyTitle: new RegExp(
              /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/
            ),
            /* This would match either
            -    invoker 'com.google.cloud.functions.invoker:java-function-invoker:1.0.2
            -    classpath 'com.google.cloud.tools:endpoints-framework-gradle-plugin:1.0.3'
            -def grpcVersion = '1.40.1'
            */
            oldVersion: new RegExp(
              /-(?:[\s]*(?:classpath|invoker)[\s]'(.*):([0-9]*)\.([0-9]*\.[0-9]*)|def[\s](grpcVersion)[\s]=[\s]'([0-9]*)\.([0-9]*\.[0-9]*))/
            ),
            /* This would match either:
            +    invoker 'com.google.cloud.functions.invoker:java-function-invoker:1.0.2
            +    classpath 'com.google.cloud.tools:endpoints-framework-gradle-plugin:1.0.3'
            +def grpcVersion = '1.40.1'
            */
            newVersion: new RegExp(
              /\+(?:[\s]*(?:classpath|invoker)[\s]'(.*):([0-9]*)\.([0-9]*\.[0-9]*)|def[\s](grpcVersion)[\s]=[\s]'([0-9]*)\.([0-9]*\.[0-9]*))/
            ),
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

    const fileCountMatch = checkFileCount(
      this.incomingPR.fileCount,
      this.classRule.maxFiles
    );

    const filePatternsMatch = checkFilePathsMatch(
      this.incomingPR.changedFiles.map(x => x.filename),
      this.classRule.fileNameRegex
    );

    for (const file of this.incomingPR.changedFiles) {
      const fileMatch = this.classRule.fileRules?.find((x: FileRule) =>
        x.targetFileToCheck.test(file.filename)
      );

      if (fileMatch) {
        const versions = getJavaVersions(
          file,
          fileMatch.oldVersion,
          fileMatch.newVersion
        );
        if (versions) {
          const doesDependencyMatch = doesDependencyChangeMatchPRTitleJava(
            versions,
            // We can assert this exists since we're in the class rule that contains it
            fileMatch.dependencyTitle!,
            this.incomingPR.title
          );

          const isVersionValid = runVersioningValidation(versions);

          const oneDependencyChanged = isOneDependencyChanged(file);

          if (
            !(doesDependencyMatch && isVersionValid && oneDependencyChanged)
          ) {
            reportIndividualChecks(
              ['doesDependencyMatch', 'isVersionValid', 'oneDependencyChanged'],
              [doesDependencyMatch, isVersionValid, oneDependencyChanged],
              this.incomingPR.repoOwner,
              this.incomingPR.repoName,
              this.incomingPR.prNumber,
              file.filename
            );

            return false;
          }
        } else {
          return false;
        }
      } else {
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
      this.incomingPR.repoOwner,
      this.incomingPR.repoName,
      this.incomingPR.prNumber
    );
    return (
      authorshipMatches && titleMatches && fileCountMatch && filePatternsMatch
    );
  }
}
