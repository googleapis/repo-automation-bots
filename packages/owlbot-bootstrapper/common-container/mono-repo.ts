import {execSync} from 'child_process';
import {logger} from 'gcf-utils';
import {Language} from './interfaces';
import {Octokit} from '@octokit/rest';
import {getBranchNameUtils, openABranchUtils, openAPRUtils} from './utils';
import {DIRECTORY_PATH} from './common-container';

/**
 * Monorepo class
 *
 * @param language the Language of the particular monorepo
 * @param repoToCloneUrl the url for the repo to clone without the preceeding https://, e.g., just github.com/googleapis/nodejs-kms.git
 * @param repoName the name for the repo to clone, i.e., nodejs-kms
 * @param githubToken a short-lived access Github access token
 * @param octokit an instance of Octokit
 */
export class MonoRepo {
  language: Language;
  repoToCloneUrl: string;
  repoName: string;
  githubToken: string;
  octokit: Octokit;

  constructor(
    language: Language,
    repoToCloneUrl: string,
    githubToken: string,
    octokit: Octokit
  ) {
    this.language = language;
    this.repoToCloneUrl = repoToCloneUrl;
    // Get the repo name from the repoToCloneUrl, i.e. github.com/googleapis/nodejs-kms.git becomes nodejs-kms
    this.repoName = repoToCloneUrl.split('/')[2].split('.')[0];
    this.githubToken = githubToken;
    this.octokit = octokit;
  }

  /**
   * Clones a repo from github
   *
   * @param githubToken a short-lived access Github access token
   * @param octokit the url for the repo to clone without the preceeding https://, e.g., just github.com/googleapis/nodejs-kms.git
   */
  public async _cloneRepo(
    githubToken: string,
    repoToCloneUrl: string,
    directoryPath: string
  ) {
    try {
      execSync(
        `git clone https://x-access-token:${githubToken}@${repoToCloneUrl}`,
        {cwd: directoryPath}
      );
    } catch (err) {
      logger.error(err as any);
      throw err;
    }
  }

  /**
   * Opens a new branch with a UUID in github in the given repo.
   *
   * @param repoName the name of the repository, i.e., nodejs-kms
   */
  public async _openABranch(repoName: string, directoryPath: string) {
    await openABranchUtils(repoName, directoryPath);
  }

  /**
   * Gets the name of the branch with a UUID from a well-known file path
   */
  public async _getBranchNameFromFile(directoryPath: string): Promise<string> {
    return await getBranchNameUtils(directoryPath);
  }

  /**
   * Opens a PR in github
   *
   * @param octokit an instantiated Octokit instance
   * @param branchName the name of the branch with a UUID
   * @param repoName the name of the repo to open the branch in
   */
  public async _openAPR(
    octokit: Octokit,
    branchName: string,
    repoName: string
  ) {
    await openAPRUtils(octokit, branchName, repoName);
  }

  /**
   * Commits changes and pushes them to a new branch in github
   *
   * @param branchName the name of the branch with a UUID
   * @param repoName the name of the repo containing the branch
   */
  public async _commitAndPushToBranch(
    branchName: string,
    repoName: string,
    directoryPath: string
  ) {
    try {
      execSync(
        `git add .; git commit -m "feat: initial generation of library"; git push -u origin ${branchName}`,
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
   * Commits changes to a branch, then opens a PR with those changes
   */
  public async pushToBranchAndOpenPR(directoryPath: string) {
    const branchName = await this._getBranchNameFromFile(directoryPath);
    await this._commitAndPushToBranch(branchName, this.repoName, directoryPath);
    await this._openAPR(this.octokit, branchName, this.repoName);
  }

  /**
   * Clones a repository and opens an empty branch in it
   */
  public async cloneRepoAndOpenBranch(directoryPath: string) {
    await this._cloneRepo(this.githubToken, this.repoToCloneUrl, directoryPath);
    await this._openABranch(this.repoName, directoryPath);
  }
}
