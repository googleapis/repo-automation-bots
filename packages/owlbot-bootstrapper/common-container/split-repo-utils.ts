import {execSync} from 'child_process';
import {Octokit} from '@octokit/rest';
export const ORG = 'soficodes';

export async function createRepo(octokit: Octokit, repoName: string) {
  await octokit.rest.repos.createInOrg({
    org: ORG,
    name: repoName,
  });
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
  execSync(`git remote set-url origin https://github.com/${ORG}/${repoName}`);
}
