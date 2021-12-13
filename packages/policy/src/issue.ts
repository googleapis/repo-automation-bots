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

import {PolicyResult} from './policy';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import {Endpoints} from '@octokit/types';

export type ListIssuesResult =
  Endpoints['GET /repos/{owner}/{repo}/issues']['response']['data'][number];

export type UpdateIssueParam =
  Endpoints['POST /repos/{owner}/{repo}/issues']['parameters'];

export async function openIssue(octokit: Octokit, result: PolicyResult) {
  // Craft the message to be used in the GitHub
  const message = `
[Policy Bot](https://github.com/googleapis/repo-automation-bots/tree/main/packages/policy#policy-bot) found one or more issues with this repository.
- [${result.hasMainDefault ? 'x' : ' '}] Default branch is 'main'
- [${result.hasBranchProtection ? 'x' : ' '}] Branch protection is enabled
- [${result.hasRenovateConfig ? 'x' : ' '}] Renovate bot is enabled
- [${result.hasMergeCommitsDisabled ? 'x' : ' '}] Merge commits disabled
- [${result.hasCodeowners ? 'x' : ' '}] There is a CODEOWNERS file
- [${result.hasValidLicense ? 'x' : ' '}] There is a valid LICENSE.md
- [${result.hasCodeOfConduct ? 'x' : ' '}] There is a CODE_OF_CONDUCT.md
- [${result.hasContributing ? 'x' : ' '}] There is a CONTRIBUTING.md
- [${result.hasSecurityPolicy ? 'x' : ' '}] There is a SECURITY.md
`;

  // Check to see if the issue is already present. It would be more efficient
  // to use the Search API here, but it has rate limits that make it untenable
  // for usage within a bot:
  // https://docs.github.com/en/rest/reference/search#rate-limit
  const issueIterator = octokit.paginate.iterator(octokit.issues.listForRepo, {
    owner: result.org,
    repo: result.repo,
    state: 'open',
  });
  let existingIssue: ListIssuesResult | undefined = undefined;
  for await (const page of issueIterator) {
    for (const issue of page.data) {
      if (issue.title.includes('[Policy Bot] ')) {
        existingIssue = issue;
        break;
      }
    }
    if (existingIssue) break;
  }

  // Check if this repository is compliant
  const isValid =
    result.hasCodeowners &&
    result.hasContributing &&
    result.hasMergeCommitsDisabled &&
    result.hasRenovateConfig &&
    result.hasSecurityPolicy &&
    result.hasValidLicense &&
    result.hasCodeOfConduct &&
    result.hasBranchProtection &&
    result.hasMainDefault;

  if (existingIssue) {
    const labels = existingIssue.labels.map(x =>
      typeof x === 'string' ? x : x.name!
    );
    if (!labels.includes('policybot')) {
      labels.push('policybot');
    }
    await octokit.issues.update({
      issue_number: existingIssue.number,
      owner: result.org,
      repo: result.repo,
      body: message,
      state: isValid ? 'closed' : 'open',
      labels,
    });
  } else {
    if (!isValid) {
      await octokit.issues.create({
        title: '[Policy Bot] found one or more issues with this repository.',
        owner: result.org,
        repo: result.repo,
        body: message,
        labels: ['policybot', 'type: process'],
      });
    }
  }
}
