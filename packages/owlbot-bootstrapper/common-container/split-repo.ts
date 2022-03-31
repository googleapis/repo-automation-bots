import {execSync} from 'child_process';
import {logger} from 'gcf-utils';
import {ORG} from './common-container';
import {Language} from './interfaces';
import {Octokit} from '@octokit/rest';
import {getBranchNameUtils, openABranchUtils, openAPRUtils} from './utils';

export const BRANCH_NAME_PREFIX = 'owlbot-bootstrapper-initial-PR';

/**
 * SplitRepo class
 *
 * @param language the Language of the particular monorepo
 * @param repoName the name for the repo to clone, i.e., nodejs-kms
 * @param apiId the api ID that was generated, i.e., google.cloud.kms.v1
 * @param octokit an instance of Octokit
 * @param githubToken a short-lived access Github access token
 */
export class SplitRepo {
  language: Language;
  repoName: string;
  apiId: string;
  octokit: Octokit;
  githubToken: string;

  constructor(
    language: Language,
    apiId: string,
    githubToken: string,
    octokit: Octokit
  ) {
    this.language = language;
    this.apiId = apiId;
    this.repoName = this._createRepoName(this.language, this.apiId);
    this.githubToken = githubToken;
    this.octokit = octokit;
  }
  /**
   * Creates a new repo in github
   *
   * @param octokit the url for the repo to clone without the preceeding https://, e.g., just github.com/googleapis/nodejs-kms.git
   * @param repoName the name of the repo to create, i.e., python-kms
   */
  public async _createRepo(octokit: Octokit, repoName: string) {
    try {
      await octokit.rest.repos.createInOrg({
        org: ORG,
        name: repoName,
      });
    } catch (err) {
      if ((err as any).message.match(/name already exists on this account/)) {
        logger.info(
          `${ORG}/${repoName} already exists, skipping repo creation`
        );
      } else {
        logger.error(err as any);
        throw err;
      }
    }
  }

  /**
   * Creates a repo name from the api Id
   *
   * @param language the Language that is triggering the process
   * @param apiId the api ID that is triggering the process, i.e., google.cloud.kms.v1
   */
  public _createRepoName(language: string, apiId: string): string {
    const apiIdSplit = apiId.split('.');
    if (apiIdSplit[1] === 'cloud') {
      return `${language}-${apiIdSplit[2]}`;
    } else {
      return `${language}-${apiIdSplit[1]}-${apiIdSplit[2]}`;
    }
  }

  /**
   * Initializes an empty git repo locally
   *
   * @param repoName the name of the git repo to initialize
   */
  public async _initializeEmptyGitRepo(
    repoName: string,
    directoryPath: string
  ) {
    try {
      execSync(`mkdir ${repoName}`, {cwd: directoryPath});
      execSync('git init', {cwd: `${directoryPath}/${repoName}`});
    } catch (err) {
      logger.error(err as any);
      throw err;
    }
  }

  /**
   * Commits any changes made to main and pushes them
   *
   * @param githubToken a short-lived access Github access token
   * @param repoName the name of the repo on githu to push the changes to
   */
  public async _commitAndPushToMain(
    githubToken: string,
    repoName: string,
    directoryPath: string
  ) {
    try {
      execSync(
        `git add .; git commit -m "feat: adding initial files"; git branch -M main; git remote add origin https://x-access-token:${githubToken}@github.com/${ORG}/${repoName}; git push -u origin main`,
        {
          cwd: `${directoryPath}/${repoName}`,
        }
      );
    } catch (err) {
      logger.error(err as any);
      throw err;
    }
  }

  /**
   * Creates an empty branch and pushes to main
   *
   * @param repoName the repo on which to create a brancn
   * @param octokit an authenticated Octokit instance
   */
  public async _createEmptyBranchAndOpenPR(
    repoName: string,
    octokit: Octokit,
    directoryPath: string
  ) {
    await openABranchUtils(repoName, directoryPath);
    const branchName = await getBranchNameUtils(directoryPath);
    await openAPRUtils(octokit, branchName, repoName);
  }

  /**
   * Initializes an empty git repo locally, and creates an empty repo on github
   */
  public async createAndInitializeEmptyGitRepo(directoryPath: string) {
    await this._createRepo(this.octokit, this.repoName);
    await this._initializeEmptyGitRepo(this.repoName, directoryPath);
  }

  /**
   * Pushes any changes made locally to main and creates an empty PR
   */
  public async pushToMainAndCreateEmptyPR(directoryPath: string) {
    await this._commitAndPushToMain(
      this.githubToken,
      this.repoName,
      directoryPath
    );
    await this._createEmptyBranchAndOpenPR(
      this.repoName,
      this.octokit,
      directoryPath
    );
  }
}
