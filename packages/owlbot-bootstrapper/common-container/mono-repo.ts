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

  constructor(language: Language, repoToCloneUrl: string) {
    this.language = language;
    this.repoToCloneUrl = repoToCloneUrl;
  }

  private async cloneRepo() {}

  private async openABranch() {}

  private async openAPR() {}

  private async getRepoName(repoToCloneUrl: string) {
    repoToCloneUrl!.split('/')[2].split('.')[0];
  }

  public async commitAndPushToBranch() {}

  public async cloneRepoAndOpenBranch() {}
}
