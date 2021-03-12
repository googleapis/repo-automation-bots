import {ProbotOctokit} from 'probot';
import {operations} from '@octokit/openapi-types';
// type PullsListFilesResponseData = operations['pulls/list-files']['responses']['200']['application/json'];

export interface ValidPr {
  author: string;
  title: string;
  changedFiles?: string[];
  maxFiles?: number;
}

//TODO: fix pr any type to correct type
export async function checkPRAgainstConfig(
  config: {rules: ValidPr[]},
  pr: any,
  octokit: InstanceType<typeof ProbotOctokit>
): Promise<Boolean> {
  const validTypeOfPR = config.rules.find(
    x => x.author === pr.pull_request.user.login
  );

  if (validTypeOfPR) {
    // setting these to true, as this should be the default if
    // changedFiles and maxFiles are not set in the JSON schema
    let filePathsMatch = true;
    let fileCountMatch = true;
    //check if changed file paths match
    if (validTypeOfPR.changedFiles) {
      const changedFiles = await getChangedFiles(
        octokit,
        pr.user.login,
        pr.head.repo.name,
        pr.number
      );
      filePathsMatch = checkFilePathsMatch(changedFiles, validTypeOfPR);
    }
    //check if Valid number of max files
    if (validTypeOfPR.maxFiles) {
      fileCountMatch = pr.changedFiles === validTypeOfPR.maxFiles;
    }

    return filePathsMatch && fileCountMatch;
  } else {
    return false;
  }
}

/**
 * Returns true if all changes to the prFiles are permitted by the PR type.
 *
 * @param prFiles list of file paths printed by 'git log --name-only'
 * @param validTypeOfPR a valid pull request
 */
export function checkFilePathsMatch(
  prFiles: string[],
  validTypeOfPR: ValidPr
): boolean {
  if (!validTypeOfPR.changedFiles) {
    return true;
  }
  let filesMatch = true;
  for (const file of prFiles) {
    if (!validTypeOfPR.changedFiles.some(x => file.match(x))) {
      filesMatch = false;
    }
  }
  return filesMatch;
}

/**
 * Returns file names of the PR that were changed.
 *
 * @param octokit Octokit instance
 * @param owner string, the owner of the repo
 * @param repo string, the name of the repo
 * @param prNumber number, the number of the repo
 */
export async function getChangedFiles(
  octokit: InstanceType<typeof ProbotOctokit>,
  owner: string,
  repo: string,
  prNumber: number
) {
  const changedFiles = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
  });

  return changedFiles.data.map(x => x.filename);
}
