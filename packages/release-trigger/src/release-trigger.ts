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
import {Octokit} from '@octokit/rest';
import {logger} from 'gcf-utils';

import * as child_process from 'child_process';

export const exec = function (
  command: string,
  token: string
): Promise<{stdout: string; stderr: string}> {
  return new Promise((resolve, reject) => {
    child_process.exec(
      command,
      {
        env: {
          ...process.env,
          GITHUB_TOKEN: token,
        },
      },
      (error, stdout, stderr) => {
        if (stdout) {
          logger.info(stdout);
        }
        if (stderr) {
          logger.warn(stderr);
        }
        if (error) {
          reject(error);
        } else {
          resolve({stdout, stderr});
        }
      }
    );
  });
};

export const ALLOWED_ORGANIZATIONS = ['googleapis', 'GoogleCloudPlatform'];

export const FAILED_LABEL = 'autorelease: failed';
export const TAGGED_LABEL = 'autorelease: tagged';
export const TRIGGERED_LABEL = 'autorelease: triggered';
export const PUBLISHED_LABEL = 'autorelease: published';
export interface Repository {
  owner: string;
  repo: string;
}

interface BasicPullRequest {
  owner: string;
  repo: string;
  number: number;
}

export interface PullRequest {
  html_url: string;
  number: number;
  state: string;
  labels: {
    name?: string;
  }[];
  merge_commit_sha: string | null;
  user?: {
    login?: string | undefined;
  } | null;
  base: {
    repo: {
      owner?: {
        login?: string | null;
      } | null;
      name: string;
    };
  };
  closed_at: string | null;
}

const LAUNCH_DATE = new Date('2021-08-01');
export function isReleasePullRequest(pullRequest: PullRequest): boolean {
  return (
    pullRequest.state === 'closed' &&
    !!pullRequest.merge_commit_sha &&
    pullRequest.labels.some(label => {
      return label.name === TAGGED_LABEL;
    }) &&
    !pullRequest.labels.some(label => {
      return label.name === TRIGGERED_LABEL;
    }) &&
    !!pullRequest.closed_at &&
    new Date(pullRequest.closed_at) > LAUNCH_DATE
  );
}

export async function findPendingReleasePullRequests(
  octokit: Octokit,
  repository: Repository,
  maxNumber = 5
): Promise<PullRequest[]> {
  // TODO: switch to graphql
  const listGenerator = octokit.paginate.iterator(
    'GET /repos/{owner}/{repo}/pulls',
    {
      owner: repository.owner,
      repo: repository.repo,
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
    }
  );

  const found: PullRequest[] = [];
  for await (const listResponse of listGenerator) {
    for (const pullRequest of listResponse.data) {
      if (isReleasePullRequest(pullRequest)) {
        found.push(pullRequest);
        if (found.length >= maxNumber) {
          break;
        }
      }
    }
  }
  return found;
}

export async function triggerKokoroJob(
  pullRequestUrl: string,
  token: string
): Promise<{stdout: string; stderr: string}> {
  logger.info(`triggering job for ${pullRequestUrl}`);

  const command = `python3 -m autorelease trigger-single --pull=${pullRequestUrl}`;
  logger.debug(`command: ${command}`);
  try {
    const {stdout, stderr} = await exec(command, token);
    if (stdout) {
      logger.info(stdout);
    }
    if (stderr) {
      logger.warn(stderr);
    }
    return {stdout, stderr};
  } catch (e) {
    logger.error(`error executing command: ${command}`, e);
    throw e;
  }
}

export async function markTriggered(
  octokit: Octokit,
  pullRequest: BasicPullRequest
) {
  logger.info('adding `autorelease: triggered` label');
  await octokit.issues.addLabels({
    owner: pullRequest.owner,
    repo: pullRequest.repo,
    issue_number: pullRequest.number,
    labels: [TRIGGERED_LABEL],
  });
}

export async function markFailed(
  octokit: Octokit,
  pullRequest: BasicPullRequest
) {
  logger.info('adding `autorelease: failed` label');
  await octokit.issues.addLabels({
    owner: pullRequest.owner,
    repo: pullRequest.repo,
    issue_number: pullRequest.number,
    labels: [FAILED_LABEL],
  });
}

export async function cleanupPublished(
  octokit: Octokit,
  pullRequest: BasicPullRequest
): Promise<boolean> {
  logger.info('adding `autorelease: failed` label');
  let success = true;
  for (const name of [TAGGED_LABEL, TRIGGERED_LABEL]) {
    try {
      await octokit.issues.removeLabel({
        owner: pullRequest.owner,
        repo: pullRequest.repo,
        issue_number: pullRequest.number,
        name,
      });
    } catch (err) {
      logger.warn(`failed to remove label ${name}`);
      success = false;
      // ignore error for 404
    }
  }
  return success;
}
