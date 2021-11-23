import {LanguageRule, File, FileRule} from '../../interfaces';
import {
  checkAuthor,
  checkTitle,
  checkFileCount,
  checkFilePathsMatch,
  getJavaVersions,
  runVersioningValidation,
  isOneDependencyChanged,
  doesDependencyChangeMatchPRTitleJava,
  reportIndividualChecks,
} from '../../utils-for-pr-checking';

export class JavaDependency implements LanguageRule {
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
        titleRegex:
          /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
        maxFiles: 50,
        fileNameRegex: [/pom.xml$/],
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
              /<groupId>([^<]*)<\/groupId>[\s]*<artifactId>([^<]*)<\/artifactId>[\s]*-[\s]*<version>(v[0-9]-rev[0-9]*-([0-9]*)\.([0-9]*\.[0-9])|([0-9]*)\.([0-9]*\.[0-9]*))<\/version>[\s]*/
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
              /<groupId>([^<]*)<\/groupId>[\s]*<artifactId>([^<]*)<\/artifactId>[\s]*-[\s]*<version>(v[0-9]-rev[0-9]*-[0-9]*\.[0-9]*\.[0-9]|[[0-9]*\.[0-9]*\.[0-9]*)<\/version>[\s]*\+[\s]*<version>(v[0-9]-rev[0-9]*-([0-9]*)\.([0-9]*\.[0-9])|([0-9]*)\.([0-9]*\.[0-9]*))<\/version>/
            ),
          },
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
