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

import {
  getVersions,
  releaseProcess,
  dependencyProcess,
} from '../utils-for-pr-checking';
import {LanguageRule, File, FileSpecificRule} from '../interfaces';

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

export class NodeRelease implements LanguageRule {
  changedFile: File;
  author: string;
  fileRule: FileSpecificRule;
  title: string;

  constructor(changedFile: File, author: string, title: string) {
    this.changedFile = changedFile;
    this.author = author;
    this.title = title;
    this.fileRule = {
      prAuthor: 'release-please[bot]',
      process: 'release',
      targetFile: /^package.json$/,
      // This would match: -  "version": "2.3.0"
      oldVersion: /-[\s]*"(@?\S*)":[\s]"([0-9]*)*\.([0-9]*\.[0-9]*)",/,
      // This would match: +  "version": "2.3.0"
      newVersion: /\+[\s]*"(@?\S*)":[\s]"([0-9]*)*\.([0-9]*\.[0-9]*)",/,
    };
  }

  public async checkPR(): Promise<boolean> {
    const versions = getVersions(
      this.changedFile,
      this.fileRule.oldVersion!,
      this.fileRule.newVersion!
    );
    let passesAdditionalChecks = false;
    if (versions) {
      passesAdditionalChecks = await releaseProcess(
        versions,
        this.changedFile,
        this.author
      );
    }

    return passesAdditionalChecks;
  }
}

export class NodeDependency1 implements LanguageRule {
  changedFile: File;
  author: string;
  fileRule: FileSpecificRule;
  title: string;

  constructor(changedFile: File, author: string, title: string) {
    this.changedFile = changedFile;
    this.author = author;
    this.title = title;
    this.fileRule = {
      prAuthor: 'renovate-bot',
      process: 'dependency',
      targetFile: /^package.json$/,
      title: /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
      // This would match: -  "version": "^2.3.0" or -  "version": "~2.3.0"
      oldVersion: /-[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)",/,
      // This would match: +  "version": "^2.3.0" or +  "version": "~2.3.0"
      newVersion: /\+[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)"/,
    };
  }

  public async checkPR(): Promise<boolean> {
    const versions = getVersions(
      this.changedFile,
      this.fileRule.oldVersion!,
      this.fileRule.newVersion!
    );
    let passesAdditionalChecks = false;
    if (versions) {
      passesAdditionalChecks = await dependencyProcess(
        versions,
        this.fileRule,
        this.title,
        this.changedFile,
        this.author
      );
    }

    return passesAdditionalChecks;
  }
}

export class NodeDependency2 implements LanguageRule {
  changedFile: File;
  author: string;
  fileRule: FileSpecificRule;
  title: string;

  constructor(changedFile: File, author: string, title: string) {
    this.changedFile = changedFile;
    this.author = author;
    this.title = title;
    this.fileRule = {
      prAuthor: 'renovate-bot',
      targetFile: /^samples\/package.json$/,
      // This would match: fix(deps): update dependency @octokit to v1
      title: /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
      // This would match: -  "version": "^2.3.0" or -  "version": "~2.3.0"
      oldVersion: /-[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)",/,
      // This would match: +  "version": "^2.3.0" or +  "version": "~2.3.0"
      newVersion: /\+[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)"/,
    };
  }

  public async checkPR(): Promise<boolean> {
    const versions = getVersions(
      this.changedFile,
      this.fileRule.oldVersion!,
      this.fileRule.newVersion!
    );
    let passesAdditionalChecks = false;
    if (versions) {
      passesAdditionalChecks = await dependencyProcess(
        versions,
        this.fileRule,
        this.title,
        this.changedFile,
        this.author
      );
    }

    return passesAdditionalChecks;
  }
}
