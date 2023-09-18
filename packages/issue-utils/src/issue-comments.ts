// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';

/**
 * It creates a comment string used for `addOrUpdateissuecomment`.
 */
export const getCommentMark = (installationId: number): string => {
  return `<!-- probot comment [${installationId}]-->`;
};

export interface IssueComment {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
  htmlUrl: string;
}

interface AddOrUpdateIssueCommentOptions {
  onlyUpdate?: boolean;
}

/**
 * It creates a comment, or if the bot already created a comment, it
 * updates the same comment.
 *
 * @param {Octokit} octokit - The Octokit instance.
 * @param {string} owner - The owner of the issue.
 * @param {string} repo - The name of the repository.
 * @param {number} issueNumber - The number of the issue.
 * @param {number} installationId - A unique number for identifying the issue
 *   comment.
 * @param {string} commentBody - The body of the comment.
 * @param {AddOrUpdateIssueCommentOptions} options
 * @param {boolean} options.onlyUpdate - If set to true, it will only update an
 *   existing issue comment.
 */
export const addOrUpdateIssueComment = async (
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  installationId: number,
  commentBody: string,
  options: AddOrUpdateIssueCommentOptions = {}
): Promise<IssueComment | null> => {
  const commentMark = getCommentMark(installationId);
  const listCommentsResponse = await octokit.issues.listComments({
    owner: owner,
    repo: repo,
    per_page: 50, // I think 50 is enough, but I may be wrong.
    issue_number: issueNumber,
  });
  for (const comment of listCommentsResponse.data) {
    if (comment.body?.includes(commentMark)) {
      // We found the existing comment, so updating it
      const {data: updatedComment} = await octokit.issues.updateComment({
        owner,
        repo,
        comment_id: comment.id,
        body: `${commentMark}\n${commentBody}`,
      });
      return {
        owner,
        repo,
        issueNumber,
        body: updatedComment.body || '',
        htmlUrl: updatedComment.html_url,
      };
    }
  }

  if (options.onlyUpdate) {
    return null;
  }

  const {data: newComment} = await octokit.issues.createComment({
    owner: owner,
    repo: repo,
    issue_number: issueNumber,
    body: `${commentMark}\n${commentBody}`,
  });
  return {
    owner,
    repo,
    issueNumber,
    body: newComment.body || '',
    htmlUrl: newComment.html_url,
  };
};
