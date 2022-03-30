import {execSync} from 'child_process';
import {logger} from 'gcf-utils';
import {ORG} from './split-repo-utils';

export async function commitAndPushChanges(
  repoName: string,
  branchName: string,
  githubToken?: string
) {
  logger.info(
    `In branch ${execSync(
      'git rev-parse --abbrev-ref HEAD'
    )} in directory ${execSync(`pwd; cd ${repoName}; ls -a`)}`
  );
  // logger.info(`${execSync('cat .git-credentials')}`);
  console.log(branchName);
  try {
    execSync(
      `cd ${repoName}; git add .; git commit -m "feat: initial generation of library"`
    );
  } catch (err: any) {
    console.log(err);
    console.log(err.output.toString());
    throw err;
  }

  try {
    if (branchName === 'main') {
      execSync(
        `cd ${repoName}; git branch -M main; git remote add origin https://x-access-token:${githubToken}@github.com/${ORG}/${repoName}; git push -u origin ${branchName}`
      );
    } else {
      execSync(`cd ${repoName}; git push -u origin ${branchName}`);
    }
  } catch (err: any) {
    console.log(err);
    console.log(err.output.toString());
    throw err;
  }
}
