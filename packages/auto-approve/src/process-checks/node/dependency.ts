import {LanguageRule, File} from '../../interfaces';
import {
  checkAuthor,
  checkTitle,
  checkFileCount,
  checkFilePathsMatch,
} from '../../utils-for-pr-checking';
import {Octokit} from '@octokit/rest';

export class NodeDependency implements LanguageRule {
  incomingPR: {
    author: string;
    title: string;
    fileCount: number;
    changedFiles: File[];
    repoName: string;
    repoOwner: string;
    prNumber: number;
  };
  classRule: {
    author: string;
    allFilesChecked: boolean;
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
  octokitInstance: Octokit;

  constructor(
    incomingPrAuthor: string,
    incomingTitle: string,
    incomingFileCount: number,
    incomingChangedFiles: File[],
    incomingRepoName: string,
    incomingRepoOwner: string,
    incomingPrNumber: number,
    octokitInstance: Octokit
  ) {
    (this.incomingPR = {
      author: incomingPrAuthor,
      title: incomingTitle,
      fileCount: incomingFileCount,
      changedFiles: incomingChangedFiles,
      repoName: incomingRepoName,
      repoOwner: incomingRepoOwner,
      prNumber: incomingPrNumber,
    }),
      (this.classRule = {
        author: 'renovate-bot',
        allFilesChecked: true,
        titleRegex:
          /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
        maxFiles: 50,
        fileNameRegex: [/package\.json$/],
        fileRules: [
          {
            dependencyTitle:
              /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
            targetFileToCheck: /^samples\/package.json$/,
            // This would match: -  "version": "^2.3.0" or -  "version": "~2.3.0"
            oldVersion:
              /-[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)",/,
            // This would match: +  "version": "^2.3.0" or +  "version": "~2.3.0"
            newVersion:
              /\+[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)"/,
          },
          {
            dependencyTitle:
              /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
            targetFileToCheck: /^package.json$/,
            // This would match: -  "version": "^2.3.0" or -  "version": "~2.3.0"
            oldVersion:
              /-[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)",/,
            // This would match: +  "version": "^2.3.0" or +  "version": "~2.3.0"
            newVersion:
              /\+[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)"/,
          },
        ],
      }),
      (this.octokitInstance = octokitInstance);
  }

  public async checkPR(): Promise<boolean> {
    const authorshipMatches = checkAuthor(
      this.classRule.author,
      this.incomingPR.author
    );

    const titleMatches = checkTitle(
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

    return (
      authorshipMatches && titleMatches && fileCountMatch && filePatternsMatch
    );
  }
}
