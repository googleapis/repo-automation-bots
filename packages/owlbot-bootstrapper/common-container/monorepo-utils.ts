import {execSync} from 'child_process';
import {authenticateOctokit, parseSecretInfo} from './authenticate-github';
import {SECRET_NAME_APP} from './authenticate-github';

export async function cloneRepo(
  githubToken: string,
  repoToClone: string | undefined
) {
  if (!repoToClone) {
    throw new Error(
      'Missing address for repo to clone even though this is a monorepo'
    );
  }
  execSync(`git clone https://x-access-token:${githubToken}@${repoToClone}`);
}

export async function openBranch(repoToClone: string) {
  execSync(`cd ${repoToClone}; git checkout -b owlbot-googleapis-initial-PR`);
}

export function isMonoRepo(language: string | undefined) {
  const monoRepos = ['dotnet', 'php', 'ruby', 'nodejs'];
  console.log(`LANGUAGE: ${language}`);
  if (!language) {
    throw Error('Language not specified for repo creation');
  }
  if (monoRepos.includes(language)) {
    return true;
  }
  return false;
}

export async function openAPR(
  projectId: string,
  branchName: string,
  owner: string,
  repo: string,
  installationId: string
) {
  const authValues = parseSecretInfo(projectId, SECRET_NAME_APP);
  const octokit = await authenticateOctokit(true, authValues, installationId);
  await octokit.rest.pulls.create({
    owner,
    repo,
    head: 'main',
    base: branchName,
  });
}
