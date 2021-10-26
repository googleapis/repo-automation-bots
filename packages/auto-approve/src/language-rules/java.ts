import {File} from '../get-pr-info';
import {logger} from 'gcf-utils';
import {
  getJavaVersions,
  FileSpecificRule,
  runVersioningValidation,
  isOneDependencyChanged,
  Versions,
  doesDependencyChangeMatchPRTitleJava,
} from '../utils-for-pr-checking';

export const PERMITTED_FILES = [
  {
    prAuthor: 'renovate-bot',
    process: 'dependency',
    targetFile: /pom.xml$/,
    // This would match: chore(deps): update dependency com.google.cloud:google-cloud-datacatalog to v1.4.2 or chore(deps): update dependency com.google.apis:google-api-services-policytroubleshooter to v1-rev20210319-1.32.1
    title: /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
    /* This would match:
          <groupId>com.google.apis</groupId>
          <artifactId>google-api-services-policytroubleshooter</artifactId>
          -      <version>v1-rev20210319-1.31.5</version>
          or
          <groupId>com.google.apis</groupId>
          <artifactId>google-api-services-policytroubleshooter</artifactId>
    -     <version>v1-rev20210319-1.31.5</version>
        */
    oldVersion:
      /<groupId>([^<]*)<\/groupId>[\s]*<artifactId>([^<]*)<\/artifactId>[\s]*-[\s]*<version>(v[0-9]-rev[0-9]*-([0-9]*)\.([0-9]*\.[0-9])|([0-9]*)\.([0-9]*\.[0-9]*))<\/version>[\s]*/,
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
    newVersion:
      /<groupId>([^<]*)<\/groupId>[\s]*<artifactId>([^<]*)<\/artifactId>[\s]*-[\s]*<version>(v[0-9]-rev[0-9]*-[0-9]*\.[0-9]*\.[0-9]|[[0-9]*\.[0-9]*\.[0-9]*)<\/version>[\s]*\+[\s]*<version>(v[0-9]-rev[0-9]*-([0-9]*)\.([0-9]*\.[0-9])|([0-9]*)\.([0-9]*\.[0-9]*))<\/version>/,
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
    const versions = getJavaVersions(
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
    const doesDependencyMatch = doesDependencyChangeMatchPRTitleJava(
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
