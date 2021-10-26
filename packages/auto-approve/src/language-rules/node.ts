import {logger} from 'gcf-utils';
import {File} from '../get-pr-info';
import {
  getVersions,
  FileSpecificRule,
  runVersioningValidation,
  isOneDependencyChanged,
  mergesOnWeekday,
  Versions,
  doesDependencyChangeMatchPRTitle,
} from '../utils-for-pr-checking';

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
      if (this.fileRule.process === 'release') {
        passesAdditionalChecks = await this.releaseProcess(versions);
      } else if (this.fileRule.process === 'dependency') {
        passesAdditionalChecks = await this.dependencyProcess(versions);
      }
    }

    return passesAdditionalChecks;
  }

  private async releaseProcess(versions: Versions) {
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
