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

import {GitHubAPI} from 'probot/lib/github';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('./../data/config.json');

interface SLOStatus {
  appliesTo: boolean;
  isCompliant: boolean | null;
}

/**
 * Function gets ooslo label name in repo from the config file
 * @returns the name of ooslo label
 */
handle_labeling.getLabelName = async function (): Promise<string> {
  try {
    return config.name;
  } catch (err) {
    throw 'Unable to get ooslo name from config-label file';
  }
};

/**
 * Function adds ooslo label to the given issue or pr.
 * Throws an error if label does not exist in repo
 * @param github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param issueNumber number of issue pr
 * @param name of ooslo label in repo
 * @returns void
 */
handle_labeling.addLabel = async function addLabel(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueNumber: number,
  name: string
) {
  try {
    const labels = [name];
    await github.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });
  } catch (err) {
    //Error if ooslo label does not exist in repo
    throw `Error in adding ooslo label for org ${owner} in repo ${repo} since it does not exist \n ${err}`;
  }
};

/**
 * Function removes ooslo label from the given issue or pr.
 * @param github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param issueNumber number of issue pr
 * @param name of ooslo label in repo
 * @returns void
 */
handle_labeling.removeIssueLabel = async function removeIssueLabel(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueNumber: number,
  name: string
) {
  try {
    await github.issues.removeLabel({
      owner,
      repo,
      issue_number: issueNumber,
      name,
    });
  } catch (err) {
    console.error(
      `Error removing OOSLO label in repo ${repo} for issue number ${issueNumber}\n ${err.request}`
    );
    return;
  }
};

/**
 * Function handles adding and removing labels according to slo status.
 * If slo is not compliant and does not habe ooslo label, adds it to issue.
 * If slo is compliant but has ooslo label, removes it from issue
 * @param github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param issueNumber number of issue pr
 * @param sloStatus if issue applies to given issue and if it is compliant with the issue
 * @param labels on the issue or pr
 * @returns void
 */
export async function handle_labeling(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueNumber: number,
  sloStatus: SLOStatus,
  labels: string[] | null
) {
  const name = await handle_labeling.getLabelName();
  if (!sloStatus.isCompliant && !labels?.includes(name)) {
    await handle_labeling.addLabel(github, owner, repo, issueNumber, name);
  } else if (sloStatus.isCompliant && labels?.includes(name)) {
    await handle_labeling.removeIssueLabel(
      github,
      owner,
      repo,
      issueNumber,
      name
    );
  }
}
