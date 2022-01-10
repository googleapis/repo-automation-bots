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
import {RequestError} from '@octokit/request-error';
import {logger} from 'gcf-utils';
import {Octokit} from '@octokit/rest';
import {Reviews, File, GHFile} from './interfaces';

// This file gets information about the incoming pull request, such as what files were changed, etc.

function isFile(file: GHFile | unknown): file is GHFile {
  return (file as GHFile).content !== undefined;
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
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<File[]> {
  try {
    return await octokit.paginate(octokit.pulls.listFiles, {
      owner,
      repo,
      pull_number: prNumber,
    });
  } catch (e) {
    const err = e as RequestError;
    // These errors happen frequently, so adding cleaner logging; will still throw error
    if (err.status === 404) {
      logger.error(
        `Not found error, ${err.status}, ${err.message} for ${owner}/${repo}/${prNumber}`
      );
    }
    throw new Error(
      `${err.status}, ${err.message} for ${owner}/${repo}/${prNumber}`
    );
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
  octokit: Octokit,
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

/**
 * This function cleans the reviews, since the listReviews method github provides returns a complete
 * history of all comments added and we just want the most recent for each reviewer
 * @param Reviews is an array of completed reviews from getReviewsCompleted()
 * @returns an array of only the most recent reviews for each reviewer
 */
export function cleanReviews(reviewsCompleted: Reviews[]): Reviews[] {
  const cleanReviews = [];
  const distinctReviewers: string[] = [];
  if (reviewsCompleted.length !== 0) {
    for (let x = reviewsCompleted.length - 1; x >= 0; x--) {
      const reviewsCompletedUser = reviewsCompleted[x].user.login;
      if (!distinctReviewers.includes(reviewsCompletedUser)) {
        cleanReviews.push(reviewsCompleted[x]);
        distinctReviewers.push(reviewsCompletedUser);
      }
    }
  }
  return cleanReviews;
}

/**
 * Function grabs completed reviews on a given pr
 * @param owner of pr
 * @param repo of pr
 * @param pr pr number
 * @returns an array of Review types
 */
export async function getReviewsCompleted(
  owner: string,
  repo: string,
  pr: number,
  octokit: Octokit
): Promise<Reviews[]> {
  const reviewsCompleted = await octokit.pulls.listReviews({
    owner,
    repo,
    pull_number: pr,
  });
  return reviewsCompleted.data as Reviews[];
}

/**
 * Function grabs contents of a specific file in a repository
 * @param owner of repo of pr
 * @param repo of of repo of pr
 * @param path path to file
 * @returns content of the file, or else throws an error if not a file
 */
export async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  octokit: Octokit
): Promise<string> {
  const fileContent = await octokit.repos.getContent({
    owner,
    repo,
    path,
  });

  if (isFile(fileContent.data)) {
    const dataContent = Buffer.from(
      fileContent.data.content,
      'base64'
    ).toString('utf8');
    return dataContent;
  }

  throw new Error(
    `${owner}/${repo}/${path} is a folder, cannot get file contents`
  );
}

export async function listCommitsOnAPR(
  owner: string,
  repo: string,
  prNumber: number,
  octokit: Octokit
) {
  const commits = await octokit.paginate(await octokit.pulls.listCommits, {
    owner,
    repo,
    pull_number: prNumber,
  });

  return commits;
}
