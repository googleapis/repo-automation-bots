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

import {Octokit} from '@octokit/rest';
import {createPullRequest, Changes} from 'code-suggester';
import {request} from 'gaxios';
import {v4 as uuid} from 'uuid';
import {PolicyResult, GitHubRepo} from './policy';

export const cocUrl =
  'https://raw.githubusercontent.com/googleapis/.github/master/CODE_OF_CONDUCT.md';
export const securityUrl =
  'https://raw.githubusercontent.com/googleapis/.github/master/SECURITY.md';

export async function getCoC() {
  return cachedGet(cocUrl);
}

export async function getSecurity() {
  return cachedGet(securityUrl);
}

const fileCache = new Map<string, string>();

/**
 * Gets the contents of the given URL and caches it.
 * The file is fetched once and cached for the lifetime of the program.
 *
 * @param url the URL.
 * @returns contents of the file.
 */
async function cachedGet(url: string) {
  let contents = fileCache.get(url);
  if (contents) {
    return contents;
  }

  const res = await request<string>({
    url: url,
    responseType: 'text',
  });
  contents = res.data;
  fileCache.set(url, contents);
  return contents;
}

/**
 * Submit a pull request to the target repository to add a CODE_OF_CONDUCT.md.
 * @param owner Repostiory owner - ex: "googleapis"
 * @param repo Repository name - ex: "repo-automation-bots"
 * @param octokit Pre-authenticated octokit instance
 */
export async function addCodeOfConduct(repo: GitHubRepo, octokit: Octokit) {
  // first, make sure there's no open PR for this
  const title = 'chore: add a Code of Conduct';
  const prs = await octokit.search.issuesAndPullRequests({
    q: `repo:${repo.full_name} "${title}" in:title is:open`,
  });
  if (prs.data.total_count > 0) {
    return;
  }

  // fetch the CoC from `googleapis/.github`
  const content = await getCoC();

  // submit the PR
  const changes: Changes = new Map([
    [
      'CODE_OF_CONDUCT.md',
      {
        content,
        mode: '100644',
      },
    ],
  ]);

  const [owner, name] = repo.full_name.split('/');
  await createPullRequest(octokit, changes, {
    title,
    message: title,
    description: 'add a code of conduct',
    upstreamOwner: owner,
    upstreamRepo: name,
    fork: false,
    primary: repo.default_branch,
    retry: 0,
    branch: `policy-bot-${uuid()}`,
  });
}

/**
 * Submit a pull request to the target repository to add a SECURITY.md.
 * @param repo Repository name - ex: "repo-automation-bots"
 * @param octokit Pre-authenticated octokit instance
 */
export async function addSecurityPolicy(repo: GitHubRepo, octokit: Octokit) {
  // first, make sure there's no open PR for this
  const title = 'chore: add SECURITY.md';
  const prs = await octokit.search.issuesAndPullRequests({
    q: `repo:${repo.full_name} "${title}" in:title is:open`,
  });
  if (prs.data.total_count > 0) {
    return;
  }

  // fetch the SECURITY.md from `googleapis/.github`
  const content = await getSecurity();

  // submit the PR
  const changes: Changes = new Map([
    [
      'SECURITY.md',
      {
        content,
        mode: '100644',
      },
    ],
  ]);

  const [owner, name] = repo.full_name.split('/');
  await createPullRequest(octokit, changes, {
    title,
    message: title,
    description: 'add a security policy',
    upstreamOwner: owner,
    upstreamRepo: name,
    fork: false,
    primary: repo.default_branch,
    retry: 0,
    branch: `policy-bot-${uuid()}`,
  });
}

/**
 * Given a set of policy results, automatically submit fixes for the things we
 * know how to fix.
 * @param result The Policy result for a single repository.
 * @param octokit A pre-authenticated octokit instance.
 */
export async function submitFixes(
  result: PolicyResult,
  repo: GitHubRepo,
  octokit: Octokit
) {
  if (!result.hasCodeOfConduct) {
    await addCodeOfConduct(repo, octokit);
  }
  if (!result.hasSecurityPolicy) {
    await addSecurityPolicy(repo, octokit);
  }
}
