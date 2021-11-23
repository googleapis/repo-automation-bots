import {LanguageRule, File} from '../interfaces';
import {
  checkAuthor,
  checkTitle,
  checkFileCount,
  checkFilePathsMatch,
  reportIndividualChecks,
} from '../utils-for-pr-checking';

export class RegenerateReadme implements LanguageRule {
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
        author: 'yoshi-automation',
        titleRegex: /^chore: regenerate README$/,
        maxFiles: 2,
        fileNameRegex: [
          /^README.md$/,
          /\.github\/readme\/synth.metadata\/synth\.metadata$/,
        ],
      });
  }

  public checkPR(): boolean {
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
