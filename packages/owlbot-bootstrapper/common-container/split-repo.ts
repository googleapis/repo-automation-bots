import {execSync} from 'child_process';
import {authenticateOctokit, parseSecretInfo} from './authenticate-github';
import {SECRET_NAME_APP} from './authenticate-github';
import {uuid} from 'uuidv4';
import {logger} from 'gcf-utils';
import {ORG} from './split-repo-utils';
import {Language} from './interfaces';

export const BRANCH_NAME_PREFIX = 'owlbot-bootstrapper-initial-PR';

export class SplitRepo {
  language: Language;
  repoToClone: string;

  constructor(language: Language, repoToClone: string) {
    this.language = language;
    this.repoToClone = repoToClone;
  }

  private async createARepo() {}

  private async createRepoName() {}

  private async initializeEmptyGitRepo() {}

  public async createAndInitializeEmptyGitRepo() {}

  public async commitAndPushToMain() {}
}
