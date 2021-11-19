import {LanguageRule, File} from '../interfaces';
import {
  checkAuthor,
  checkTitle,
  checkFileCount,
  checkFilePathsMatch,
} from '../utils-for-pr-checking';

export class UpdateDiscoveryArtifacts implements LanguageRule {
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
    fileRules?: [
      {
        oldVersion?: RegExp;
        newVersion?: RegExp;
        dependencyTitle?: RegExp;
        targetFileToCheck: RegExp;
      }
    ];
  };

  constructor(
    incomingPrAuthor: string,
    incomingTitle: string,
    incomingFileCount: number,
    incomingChangedFiles: File[],
    incomingRepoName: string,
    incomingRepoOwner: string,
    incomingPrNumber: number
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
        author: 'yoshi-code-bot',
        allFilesChecked: false,
        titleRegex: /^chore: Update discovery artifacts/,
        maxFiles: 2,
        fileNameRegex: [
          /^docs\/dyn\/index\.md$/,
          /^docs\/dyn\/.*\.html$/,
          /^googleapiclient\/discovery_cache\/documents\/.*\.json$/,
        ],
      });
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
