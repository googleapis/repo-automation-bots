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
import {createPullRequest, Changes} from 'code-suggester';
import {request} from 'gaxios';
import {v4 as uuid} from 'uuid';
import {operations} from '@octokit/openapi-types';
import {PolicyResult, GitHubRepo} from './policy';
type PullRequests =
  operations['pulls/list']['responses']['200']['content']['application/json'];

export const cocUrl =
  'https://raw.githubusercontent.com/googleapis/.github/master/CODE_OF_CONDUCT.md';
export const securityUrl =
  'https://raw.githubusercontent.com/googleapis/.github/master/SECURITY.md';

const fileCache = new Map<string, string>();

/**
 * Gets the contents of the given URL and caches it.
 * The file is fetched once and cached for the lifetime of the program.
 * These are purposefully cached *outside* of the `Changer` instance so they
 * can be re-used across requests.
 *
 * @param url the URL.
 * @returns contents of the file.
 */
export async function cachedGet(url: string) {
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

export class Changer {
  private octokit: Octokit;
  private repo: GitHubRepo;
  private owner: string;
  private name: string;
  private prsCache?: PullRequests;

  constructor(octokit: Octokit, repo: GitHubRepo) {
    this.octokit = octokit;
    this.repo = repo;
    const [owner, name] = repo.full_name.split('/');
    this.owner = owner;
    this.name = name;
  }

  /**
   * Check to see if the current repository has an open pull request with the given title
   * @param title The title to search for
   * @returns
   */
  private async hasMatchingPR(title: string) {
    if (!this.prsCache) {
      this.prsCache = await this.octokit.paginate(this.octokit.pulls.list, {
        owner: this.owner,
        repo: this.name,
        state: 'open',
        per_page: 100,
      });
    }
    const matches = this.prsCache.filter(x => x.title === title);
    return matches.length > 0;
  }

  /**
   * Submit a pull request to the target repository to add a SECURITY.md.
   * @param title - The title used in the PR
   * @param sourceUrl - the location of the file to be added
   * @param targetPath - the location in the GitHub repository
   */
  async addFile(title: string, sourceUrl: string, targetPath: string) {
    // first, make sure there's no open PR for this
    if (await this.hasMatchingPR(title)) {
      return;
    }

    // fetch the SECURITY.md from `googleapis/.github`
    const content = await cachedGet(sourceUrl);

    // submit the PR
    const changes: Changes = new Map([
      [
        targetPath,
        {
          content,
          mode: '100644',
        },
      ],
    ]);

    await createPullRequest(this.octokit, changes, {
      title,
      message: title,
      description: title,
      upstreamOwner: this.owner,
      upstreamRepo: this.name,
      fork: false,
      primary: this.repo.default_branch,
      retry: 0,
      branch: `policy-bot-${uuid()}`,
    });
  }

  /**
   * Given a set of policy results, automatically submit fixes for the things we
   * know how to fix.
   * @param result The Policy result for a single repository.
   */
  async submitFixes(result: PolicyResult) {
    if (!result.hasCodeOfConduct) {
      const title = 'chore: add a Code of Conduct';
      await this.addFile(title, cocUrl, 'CODE_OF_CONDUCT.md');
    }
    if (!result.hasSecurityPolicy) {
      const title = 'chore: add SECURITY.md';
      await this.addFile(title, securityUrl, 'SECURITY.md');
    }
  }
}

export function getChanger(octokit: Octokit, repo: GitHubRepo) {
  return new Changer(octokit, repo);
}
