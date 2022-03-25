import {execSync} from 'child_process';
import {authenticateOctokit, parseSecretInfo} from './authenticate-github';
import {SECRET_NAME_APP} from './authenticate-github';
import {uuid} from 'uuidv4';
import {logger} from 'gcf-utils';

export const BRANCH_NAME_PREFIX = 'owlbot-bootstrapper-initial-PR';

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

export async function openBranch(repoName: string) {
  const UUID = uuid().split('-')[4];
  const branchName = `${BRANCH_NAME_PREFIX}-${UUID}`;
  console.log('a thing');
  logger.info(execSync('pwd').toString());
  execSync(`echo '${branchName}' >> branchName.md`);
  execSync(
    `cd ${repoName}; git checkout -b ${branchName}; git commit --allow-empty -m "initial commit"; git push -u origin ${branchName}`
  );
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
  branchName: string,
  owner: string,
  repo: string,
  token: string
) {
  const octokit = await authenticateOctokit(token);
  await octokit.rest.pulls.create({
    owner,
    repo,
    head: 'main',
    base: branchName,
  });
}
