import {execSync} from 'child_process';
import {logger} from 'gcf-utils';

export async function commitAndPushChanges(
  repoName: string,
  branchName: string
) {
  logger.info(
    `In branch ${execSync(
      'git rev-parse --abbrev-ref HEAD'
    )} in directory ${execSync(`pwd; cd ${repoName}; ls -a`)}`
  );
  logger.info(`${execSync('cat .git-credentials')}`);
  console.log(branchName);
  try {
    execSync(
      `cd ${repoName}; git commit -am "feat: initial generation of library"`
    );
  } catch (err: any) {
    console.log(err);
    console.log(err.output.toString());
    throw err;
  }
  execSync(`cd ${repoName}; git push`);
}
