// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// eslint-disable-next-line node/no-extraneous-import
import {ProbotOctokit} from 'probot';
import {logger} from 'gcf-utils';

// This file gets information about the incoming pull request, such as what files were changed, etc.

export interface File {
  sha: string;
  filename: string;
  patch?: string;
  additions?: number;
  deletions?: number;
  changes?: number;
}
/**
 * Returns file names of the PR that were changed.
 *
 * @param octokit Octokit instance
 * @param owner string, the owner of the repo
 * @param repo string, the name of the repo
 * @param prNumber number, the number of the repo
 * @returns an array of File objects that were changed in a pull request
 */
export async function getChangedFiles(
  octokit: InstanceType<typeof ProbotOctokit>,
  owner: string,
  repo: string,
  prNumber: number
): Promise<File[]> {
  try {
    return (
      await octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: prNumber,
      })
    ).data;
  } catch (err) {
    // These errors happen frequently, so adding cleaner logging; will still throw error
    if (err === 404) {
      logger.error(
        `Not found error, ${err.code}, ${err.message} for ${owner}/${repo}/${prNumber}`
      );
    }
    throw err;
  }
}
/**
 * Gets the blob of a file from an array of changed files from a PR
 *
 * @param octokit Octokit instance
 * @param owner string, the owner of the repo for the incoming PR
 * @param repo string, the name of the repo for the incoming PR
 * @param changedFiles the array of File objects to get the blob of
 * @param targetFile the name of the specific file object you want to get
 * @returns the contents of the changed File in a string
 */
export async function getBlobFromPRFiles(
  octokit: InstanceType<typeof ProbotOctokit>,
  owner: string,
  repo: string,
  changedFiles: File[],
  targetFile: string
): Promise<string | undefined> {
  // Check to see whether the target file is in the array of changed files
  const isFileInPR = changedFiles.find(x => x.filename === targetFile);

  // If the target file is there, get the blob
  if (isFileInPR) {
    const blob = await octokit.git.getBlob({
      owner,
      repo,
      file_sha: isFileInPR.sha,
    });

    return Buffer.from(blob.data.content, 'base64').toString('utf8');
  } else {
    return undefined;
  }
}
