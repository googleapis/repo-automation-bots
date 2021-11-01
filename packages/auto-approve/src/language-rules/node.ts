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

import {logger} from 'gcf-utils';
import {
  getVersions,
  runVersioningValidation,
  isOneDependencyChanged,
  mergesOnWeekday,
  doesDependencyChangeMatchPRTitle,
} from '../utils-for-pr-checking';
import {LanguageRule, File, FileSpecificRule, Versions} from '../interfaces';

export const PERMITTED_FILES = [
  {
    prAuthor: 'release-please[bot]',
    process: 'release',
    targetFile: /^package.json$/,
    // This would match: -  "version": "2.3.0"
    oldVersion: /-[\s]*"(@?\S*)":[\s]"([0-9]*)*\.([0-9]*\.[0-9]*)",/,
    // This would match: +  "version": "2.3.0"
    newVersion: /\+[\s]*"(@?\S*)":[\s]"([0-9]*)*\.([0-9]*\.[0-9]*)",/,
  },
  {
    prAuthor: 'renovate-bot',
    process: 'dependency',
    targetFile: /^package.json$/,
    title: /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
    // This would match: -  "version": "^2.3.0" or -  "version": "~2.3.0"
    oldVersion: /-[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)",/,
    // This would match: +  "version": "^2.3.0" or +  "version": "~2.3.0"
    newVersion: /\+[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)"/,
  },
  {
    prAuthor: 'renovate-bot',
    process: 'dependency',
    targetFile: /^samples\/package.json$/,
    // This would match: fix(deps): update dependency @octokit to v1
    title: /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
    // This would match: -  "version": "^2.3.0" or -  "version": "~2.3.0"
    oldVersion: /-[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)",/,
    // This would match: +  "version": "^2.3.0" or +  "version": "~2.3.0"
    newVersion: /\+[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)"/,
  },
];

export class Rules implements LanguageRule {
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
      if (this.fileRule.process === 'release') {
        passesAdditionalChecks = await this.releaseProcess(versions);
      } else if (this.fileRule.process === 'dependency') {
        passesAdditionalChecks = await this.dependencyProcess(versions);
      }
    }

    return passesAdditionalChecks;
  }

  public async releaseProcess(versions: Versions): Promise<boolean> {
    const versionsCorrect = runVersioningValidation(versions);
    const oneDependencyChanged = isOneDependencyChanged(this.changedFile);
    const mergedOnWeekday = mergesOnWeekday();
    logger.info(
      `Versions upgraded correctly for ${this.changedFile.sha}/${this.changedFile.filename}/${this.author}? ${versionsCorrect}`
    );
    logger.info(
      `One dependency changed for ${this.changedFile.sha}/${this.changedFile.filename}/${this.author}? ${versionsCorrect}? ${oneDependencyChanged}`
    );
    logger.info(
      `Merges on the correct time for ${this.changedFile.sha}/${this.changedFile.filename}/${this.author}? ${versionsCorrect}? ${mergedOnWeekday}`
    );
    return versionsCorrect && oneDependencyChanged && mergedOnWeekday;
  }

  public async dependencyProcess(versions: Versions): Promise<boolean> {
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
