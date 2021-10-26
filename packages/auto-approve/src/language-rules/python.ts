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

import {File} from '../get-pr-info';
import {logger} from 'gcf-utils';
import {
  getVersions,
  FileSpecificRule,
  runVersioningValidation,
  isOneDependencyChanged,
  Versions,
  doesDependencyChangeMatchPRTitle,
} from '../utils-for-pr-checking';

export const PERMITTED_FILES = [
  {
    prAuthor: 'renovate-bot',
    process: 'dependency',
    targetFile: /^samples\/snippets\/requirements.txt$/,
    // This would match: fix(deps): update dependency @octokit to v1
    title: /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
    // This would match: -  google-cloud-storage==1.39.0
    oldVersion: /-[\s]?(@?[^=]*)==([0-9])*\.([0-9]*\.[0-9]*)/,
    // This would match: +  google-cloud-storage==1.40.0
    newVersion: /\+[\s]?(@?[^=]*)==([0-9])*\.([0-9]*\.[0-9]*)/,
  },
];

export class Rules {
  changedFile: File;
  author: string;
  fileRule: FileSpecificRule;
  title: string;

  permittedFilesAndAuthors = PERMITTED_FILES;

  constructor(
    changedFile: File,
    author: string,
    languageRule: FileSpecificRule,
    title: string
  ) {
    this.changedFile = changedFile;
    this.author = author;
    this.fileRule = languageRule;
    this.title = title;
  }

  public async checkPR(): Promise<boolean> {
    const versions = getVersions(
      this.changedFile,
      this.fileRule.oldVersion!,
      this.fileRule.newVersion!
    );
    let passesAdditionalChecks = false;
    if (versions) {
      if (this.fileRule.process === 'dependency') {
        passesAdditionalChecks = await this.dependencyProcess(versions);
      }
    }

    return passesAdditionalChecks;
  }

  private async dependencyProcess(versions: Versions) {
    const doesDependencyMatch = doesDependencyChangeMatchPRTitle(
      versions,
      // We can assert title will exist, since the process is type 'dependency'
      this.fileRule.title!,
      this.title
    );
    const isVersionValid = runVersioningValidation(versions);
    const oneDependencyChanged = isOneDependencyChanged(this.changedFile);
    logger.info(
      `Versions upgraded correctly for ${this.changedFile.sha}/${this.changedFile.filename}/${this.author}? ${isVersionValid}`
    );
    logger.info(
      `One dependency changed for ${this.changedFile.sha}/${this.changedFile.filename}/${this.author}? ${oneDependencyChanged}`
    );
    logger.info(
      `Does dependency match title for ${this.changedFile.sha}/${this.changedFile.filename}/${this.author}? ${doesDependencyMatch}`
    );
    return doesDependencyMatch && isVersionValid && oneDependencyChanged;
  }
}
