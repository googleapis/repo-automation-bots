import {LanguageRule, File} from '../../interfaces';
import {
  checkAuthor,
  checkTitle,
  checkFileCount,
  checkFilePathsMatch,
  getVersionsV2,
  runVersioningValidation,
  isOneDependencyChanged,
  mergesOnWeekday,
} from '../../utils-for-pr-checking';
export class NodeRelease implements LanguageRule {
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
        author: 'renovate-bot',
        allFilesChecked: true,
        titleRegex:
          /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
        maxFiles: 2,
        fileNameRegex: [/^package.json$/, /^CHANGELOG.md$/],
        fileRules: [
          {
            targetFileToCheck: /^package.json$/,
            // This would match: -  "version": "2.3.0"
            oldVersion: new RegExp(
              /-[\s]*"(@?\S*)":[\s]"([0-9]*)*\.([0-9]*\.[0-9]*)",/
            ),
            // This would match: +  "version": "2.3.0"
            newVersion: new RegExp(
              /\+[\s]*"(@?\S*)":[\s]"([0-9]*)*\.([0-9]*\.[0-9]*)",/
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

    for (const fileRule of this.classRule.fileRules!) {
      const fileMatch = this.incomingPR.changedFiles?.find((x: File) =>
        fileRule.targetFileToCheck.test(x.filename)
      );

      if (fileMatch) {
        const versions = getVersionsV2(
          fileMatch,
          fileRule.oldVersion,
          fileRule.newVersion
        );
        if (versions) {
          const isVersionValid = runVersioningValidation(versions);

          const oneDependencyChanged = isOneDependencyChanged(fileMatch);

          const isMergedOnWeekDay = mergesOnWeekday();

          if (!(isMergedOnWeekDay && isVersionValid && oneDependencyChanged)) {
            return false;
          }
        } else {
          return false;
        }
      } else {
        return false;
      }
    }

    return (
      authorshipMatches && titleMatches && fileCountMatch && filePatternsMatch
    );
  }
}
