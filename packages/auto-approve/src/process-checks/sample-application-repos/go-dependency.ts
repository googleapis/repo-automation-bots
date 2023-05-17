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

import {
  FileRule,
  PullRequest,
  File,
  VersionsWithShaDiff,
} from '../../interfaces';
import {
  checkAuthor,
  checkTitleOrBody,
  checkFilePathsMatch,
  reportIndividualChecks,
  isVersionValidWithShaOrRev,
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
    },
  ];

  constructor(octokit: Octokit) {
    super(octokit);
  }

  /**
   * This function checks whether the dependency stated in a given title was the one that was changed for Go
   * This function is different from doesDependencyChangeMatchPRTitle as it is specific to Go, since those titles
   * vary in their regex.
   *
   * @param versions the Versions object that contains the old dependency name and new dependency name and versions
   * @param dependencyRegex the regular exp to find the dependency within the title of the PR
   * @param title the title of the PR
   * @returns whether the old dependency, new dependency, and dependency in the title all match
   */
  public doesDependencyChangeMatchPRTitleGo(
    versions: VersionsWithShaDiff,
    title: string
  ): boolean {
    let dependencyName = '';

    // This would match: chore(deps): update cypress/included docker tag to v12.12.0
    const titleRegex = title.match(
      /^(fix|chore)\(deps\): update (?:module (\D*?)|(\D*?) digest) to v?(\S*)$/
    );
    if (titleRegex) {
      // Go titles can vary by either: `module NAME` or `NAME digest`
      dependencyName = titleRegex[3] || titleRegex[2];
    }

    return (
      versions.newDependencyName === versions.oldDependencyName &&
      dependencyName === versions.newDependencyName
    );
  }

  /**
   * Given a patch for a file that was changed in a PR for a go.mod file, and a regular expression to search
   * for the old version number and a regular expression to search for the new version number,
   * this function will return the old and new versions of a package.
   * This function is different from above, since Go packages sometimes will have a rev tag, which changes the grouping
   * for the regular expressions.
   *
   * @param versionFile the changed file that has additional rules to conform to
   * @param oldVersionRegex the regular exp to find the old version number of whatever is being changed
   * @param newVersionRegex the regular exp to find the new version number of whatever is being changed
   * @returns the previous and new major and minor versions of a package in an object containing those 4 properties.
   */
  public getGoVersions(
    versionFile: File | undefined
  ): VersionsWithShaDiff | undefined {
    if (!versionFile) {
      return undefined;
    }

    let oldDependencyName;
    let newDependencyName;
    let oldMajorVersion;
    let oldMinorVersion;
    let newMajorVersion;
    let newMinorVersion;
    let oldShaOrRevTag;
    let newShaOrRevTag;

    // This would match: '-google.golang.org/grpc v1.50.0' or '-golang.org/x/net v0.0.0-20221012135044-0b7e1fb9d458'
    const oldVersions = versionFile.patch?.match(
      /-\t(\D*?)[\s](?:v([0-9])*\.([0-9]*\.[0-9]*)\n|v([0-9]*)\.([0-9]*\.[0-9]*)-([a-z0-9-]*))/
    );
    // This would match: '+google.golang.org/grpc v1.50.0' or '+golang.org/x/net v0.0.0-20221012135044-0b7e1fb9d458'
    const newVersions = versionFile.patch?.match(
      /\+\t(\D*?)[\s](?:v([0-9])*\.([0-9]*\.[0-9]*)\n|v([0-9]*)\.([0-9]*\.[0-9]*)-([a-z0-9-]*))/
    );

    if (oldVersions) {
      oldDependencyName = oldVersions[1];
      oldMajorVersion = oldVersions[2] || oldVersions[4];
      oldMinorVersion = oldVersions[3] || oldVersions[5];
      oldShaOrRevTag = oldVersions[6] || undefined;
    }

    if (newVersions) {
      newDependencyName = newVersions[1];
      newMajorVersion = newVersions[2] || newVersions[4];
      newMinorVersion = newVersions[3] || newVersions[5];
      newShaOrRevTag = newVersions[6] || undefined;
    }

    // If there is a change with a file that requires special validation checks,
    // and we can't find these pieces of information, we should throw an error, and not
    // perform any other checks, since that would open us up to potentially merging a
    // sensitive file without having proper checks.
    if (
      !(
        oldDependencyName &&
        newDependencyName &&
        oldMajorVersion &&
        oldMinorVersion &&
        newMajorVersion &&
        newMinorVersion
      )
    ) {
      this.logger.warn(
        `Could not find versions in ${versionFile.filename}/${versionFile.sha}`
      );
      return undefined;
    }
    return {
      oldDependencyName,
      newDependencyName,
      oldMajorVersion,
      oldMinorVersion,
      newMajorVersion,
      newMinorVersion,
      oldShaOrRevTag,
      newShaOrRevTag,
    };
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

      const versions = this.getGoVersions(file);

      if (!versions) {
        return false;
      }

      const doesDependencyMatch = this.doesDependencyChangeMatchPRTitleGo(
        versions,
        incomingPR.title
      );

      const isVersionValid = isVersionValidWithShaOrRev(versions);

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
