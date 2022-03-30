import {execSync} from 'child_process';
import {Octokit} from '@octokit/rest';
import {logger} from 'gcf-utils';
export const ORG = 'soficodes';

export async function createRepo(octokit: Octokit, repoName: string) {
  try {
    await octokit.rest.repos.createInOrg({
      org: ORG,
      name: repoName,
    });
  } catch (err) {
    if ((err as any).message.match(/name already exists on this account/)) {
      logger.info(`${ORG}/${repoName} already exists, skipping repo creation`);
    } else {
      throw err;
    }
  }
}

export function createRepoName(language: string, apiId: string) {
  const apiIdSplit = apiId.split('.');
  if (apiIdSplit[1] === 'cloud') {
    return `${language}-${apiIdSplit[2]}`;
  } else {
    return `${language}-${apiIdSplit[1]}-${apiIdSplit[2]}`;
  }
}

export async function initializeEmptyGitRepo(repoName: string) {
  execSync(`mkdir ${repoName}`);
  execSync(`cd ${repoName}; git init`);
}
