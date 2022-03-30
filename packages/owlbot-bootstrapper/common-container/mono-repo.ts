import {execSync} from 'child_process';
import {authenticateOctokit, parseSecretInfo} from './authenticate-github';
import {SECRET_NAME_APP} from './authenticate-github';
import {uuid} from 'uuidv4';
import {logger} from 'gcf-utils';
import {ORG} from './split-repo-utils';
import {Language} from './interfaces';

export const BRANCH_NAME_PREFIX = 'owlbot-bootstrapper-initial-PR';

export class MonoRepo {
  language: Language;
  repoToCloneUrl: string;
  repoName: string;
  githubToken: string;

  constructor(language: Language, repoToCloneUrl: string, githubToken: string) {
    this.language = language;
    this.repoToCloneUrl = repoToCloneUrl;
    // Get the repo name from the repoToCloneUrl, i.e. github.com/googleapis/nodejs-kms.git becomes nodejs-kms
    this.repoName = repoToCloneUrl.split('/')[2].split('.')[0];
    this.githubToken = githubToken;
  }

  private async cloneRepo(githubToken: string, repoToClone: string) {
    execSync(`git clone https://x-access-token:${githubToken}@${repoToClone}`);
  }

  private async openABranch(repoName: string) {
    const UUID = uuid().split('-')[4];
    const branchName = `${BRANCH_NAME_PREFIX}-${UUID}`;
    execSync(`echo '${branchName}' >> branchName.md`);
    execSync(
      `git checkout -b ${branchName}; git commit --allow-empty -m "initial commit"; git push -u origin ${branchName}`,
      {cwd: `/workspace/${repoName}`}
    );
  }

  private async openAPR() {}

  public async commitAndPushToBranch() {}

  public async cloneRepoAndOpenBranch() {}
}
