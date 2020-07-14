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

// handler.checkExistingLabel = async function checkExistingLabel(
//   github: GitHubAPI,
//   owner: string,
//   repo: string
// ): Promise<boolean | null> {
//   try {
//     const name = 'OOSLO';
//     const label = await github.issues.getLabel({
//       owner,
//       repo,
//       name,
//     });
//     return label.data.name === 'OOSLO';
//   } catch (err) {
//     //Error if ooslo label does not exist in repo
//     throw `Error in getting ooslo label for org ${owner} in repo ${repo} \n ${err}`;
//   }
// };

interface SLOStatus {
    appliesTo: boolean;
    isCompliant: boolean | null;
}

handle_labeling.addLabel = async function addLabel(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueNumber: number
) {
  try {
    const labels = ['OOSLO'];
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

handle_labeling.removeIssueLabel = async function removeIssueLabel(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueNumber: number
) {
  try {
    const name = 'OOSLO';
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

export async function handle_labeling(
    github: GitHubAPI,
    owner: string,
    repo: string,
    issueNumber: number,
    sloStatus: SLOStatus,
    labels: string[] | null
  ) {
    if (!sloStatus.isCompliant && !labels?.includes('ooslo')) {
      await handle_labeling.addLabel(github, owner, repo, issueNumber);
    } else if (sloStatus.isCompliant && labels?.includes('ooslo')) {
      await handle_labeling.removeIssueLabel(github, owner, repo, issueNumber);
    }
  };