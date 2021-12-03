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
//

import {logger} from 'gcf-utils';
import {OctokitType} from './utils/octokit-util';
import {ValidationResult} from './validate';

const LINT_LABEL = 'repo-metadata: lint';
const ISSUE_LABELS = [LINT_LABEL, 'type: process'];

// Given a validation result open a tracking issue on GitHub.
export class IssueOpener {
  octokit: OctokitType;
  owner: string;
  repo: string;
  constructor(owner: string, repo: string, octokit: OctokitType) {
    this.octokit = octokit;
    this.owner = owner;
    this.repo = repo;
  }
  async open(results: ValidationResult[]) {
    const repoMetadataIssues = (
      await this.octokit.rest.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        labels: LINT_LABEL,
      })
    ).data;
    if (repoMetadataIssues.length) {
      const issue = repoMetadataIssues[0];
      logger.info(
        `${this.owner}/${this.repo} already had open issue ${issue.number}`
      );
      return;
    }
    const title = `Your .repo-metadata.json file${
      results.length > 1 ? 's have' : ' has'
    } a problem 🤒`;
    let body = `You have a problem with your .repo-metadata.json file${
      results.length > 1 ? 's' : ''
    }:

Result of scan 📈:

\`\`\`
`;
    for (const result of results) {
      body += result.errors.join('\n') + '\n';
    }
    body +=
      '```\n\n ☝️ Once you correct these problems, you can close this issue.\n\nReach out to **go/github-automation** if you have any questions.';
    await this.octokit.issues.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body,
      labels: ISSUE_LABELS,
    });
  }
}
