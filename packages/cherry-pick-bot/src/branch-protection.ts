// Copyright 2022 Google LLC
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
// eslint-disable-next-line node/no-extraneous-import
import {RequestError} from '@octokit/request-error';
import {logger} from 'gcf-utils';

type OctokitType = InstanceType<typeof Octokit>;

/**
 * Helper to determine if the branch requires code review
 *
 * @param {Octokit} octokit An authenticate octokit instance
 * @param {string} owner Repository owner
 * @param {string} repo Repository name
 * @param {string} branchName Branch name
 * @returns {boolean} Whether or not the branch requires code review
 */
export async function branchRequiresReviews(
  octokit: OctokitType,
  owner: string,
  repo: string,
  branchName: string
): Promise<boolean> {
  try {
    const {
      data: {required_pull_request_reviews},
    } = await octokit.repos.getBranchProtection({
      owner,
      repo,
      branch: branchName,
    });
    if (required_pull_request_reviews) {
      return true;
    }
    logger.info('branch protection set, but does not require reviews');
    return false;
  } catch (e) {
    if (e instanceof RequestError) {
      if (e.status >= 400 && e.status < 500) {
        logger.debug(
          `branch protection response for ${branchName}: ${e.status} ${e.message}`
        );
        return false;
      }
    }
    throw e;
  }
}
