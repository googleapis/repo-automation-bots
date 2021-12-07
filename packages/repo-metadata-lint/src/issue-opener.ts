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
import {ErrorMessageText} from './error-message-text';
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
    let update = false;
    let updateIssueNumber = 0;
    const repoMetadataIssues = (
      await this.octokit.rest.issues.listForRepo({
        owner: this.owner,
        repo: this.repo,
        labels: LINT_LABEL,
      })
    ).data;
    if (repoMetadataIssues.length) {
      const issue = repoMetadataIssues[0];
      update = true;
      updateIssueNumber = issue.number;
      if (ErrorMessageText.eql(issue.body || '', results)) {
        logger.info(
          `${this.owner}/${this.repo} has identical issue ${issue.number}`
        );
        return;
      }
    }
    if (results.length === 0) {
      logger.info(`${this.owner}/${this.repo} has no validation errors`);
      if (update) {
        await this.octokit.issues.update({
          owner: this.owner,
          repo: this.repo,
          issue_number: updateIssueNumber,
          state: 'closed',
        });
      }
      return;
    }
    const title = `Your .repo-metadata.json file${
      results.length > 1 ? 's have' : ' has'
    } a problem 🤒`;
    if (update) {
      await this.octokit.issues.update({
        owner: this.owner,
        repo: this.repo,
        title,
        body: ErrorMessageText.forIssueBody(results),
        issue_number: updateIssueNumber,
      });
    } else {
      await this.octokit.issues.create({
        owner: this.owner,
        repo: this.repo,
        title,
        body: ErrorMessageText.forIssueBody(results),
        labels: ISSUE_LABELS,
      });
    }
  }
}
