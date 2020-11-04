// Copyright 2020 Google LLC
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
//

// eslint-disable-next-line node/no-extraneous-import
import {ProbotOctokit} from 'probot';
import {logger} from 'gcf-utils';
import {IssueItem} from './types';

/**
 * Function adds ooslo label to the given issue or pr.
 * Throws an error if label does not exist in repo
 * @param github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param number of issue pr
 * @param name of ooslo label in repo
 * @returns void
 */
async function addLabel(
  github: InstanceType<typeof ProbotOctokit>,
  owner: string,
  repo: string,
  number: number,
  name: string
) {
  try {
    const labels = [name];
    await github.issues.addLabels({
      owner,
      repo,
      issue_number: number,
      labels,
    });
  } catch (err) {
    err.message = `Error in adding ooslo label: ${name}, for org ${owner} in repo ${repo} since it does not exist \n ${err.message}`;
    logger.error(err);
  }
}

/**
 * Function removes ooslo label from the given issue or pr.
 * @param github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param number of issue pr
 * @param name of ooslo label in repo
 * @returns void
 */
export const removeLabel = async function removeLabel(
  github: InstanceType<typeof ProbotOctokit>,
  owner: string,
  repo: string,
  number: number,
  name: string
) {
  try {
    await github.issues.removeLabel({
      owner,
      repo,
      issue_number: number,
      name,
    });
  } catch (err) {
    logger.error(
      `Error removing label: ${name}, in repo ${repo} for issue number ${number}\n ${err.message}`
    );
  }
};

/**
 * Function handles adding and removing labels according to slo status.
 * If slo is not compliant and does not have ooslo label, adds it to issue.
 * If slo is compliant but has ooslo label, removes it from issue
 * @param github unique installation id for each function
 * @param issueItem is an object that has issue owner, repo, number, type, created time of issue, assignees, labels, and comments
 * @param isCompliant boolean to see if issue is compliant with slo
 * @param name of OOSLO label in repo
 * @returns void
 */
export async function handleLabeling(
  github: InstanceType<typeof ProbotOctokit>,
  issueItem: IssueItem,
  isCompliant: boolean,
  name: string
) {
  if (!isCompliant && !issueItem.labels?.includes(name)) {
    await addLabel(
      github,
      issueItem.owner,
      issueItem.repo,
      issueItem.number,
      name
    );
  } else if (isCompliant && issueItem.labels?.includes(name)) {
    await removeLabel(
      github,
      issueItem.owner,
      issueItem.repo,
      issueItem.number,
      name
    );
  }
}
