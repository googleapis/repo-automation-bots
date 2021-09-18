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

/**
 * This class provides scannng of repositories to ensure they follow the
 * guidance listed in go/cloud-dpe-oss-standards. It can be run locally as
 * a CLI:
 *
 *  $ policy --repo googleapis/sloth
 *
 * Or it can be used as an export to a Google Sheet that's used to construct
 * a dashboard (go/yoshi-live in this case)
 */

import {request} from 'gaxios';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import {Endpoints} from '@octokit/types';

export type GitHubRepo =
  Endpoints['GET /repos/{owner}/{repo}']['response']['data'];

export const githubRawBase = 'https://raw.githubusercontent.com';

export interface PolicyResult {
  /**
   * The short name of the GitHub repository, not including the org/owner
   */
  repo: string;
  /**
   * The GitHub organization name of the given repository
   */
  org: string;
  /**
   * A list of repository topics for the given repository
   */
  topics: string[];
  /**
   * Primary programming language used in the repository
   */
  language: string;
  /**
   * Does the repository have a `renovate.json` available in the root?
   */
  hasRenovateConfig: boolean;
  /**
   * Does the repository have a LICENSE file in an approved location, with a valid LICENSE?
   */
  hasValidLicense: boolean;
  /**
   * Does the repository have a CODE_OF_CONDUCT file available?
   */
  hasCodeOfConduct: boolean;
  /**
   * Does the repository have a CONTRIBUTING file available?
   */
  hasContributing: boolean;
  /**
   * Does the repository have a CODEOWNERS file available?
   */
  hasCodeowners: boolean;
  /**
   * Does the repository have Branch Proection configured in a safe way?
   */
  hasBranchProtection: boolean;
  /**
   * Does the repository have merge commits disabled?
   */
  hasMergeCommitsDisabled: boolean;
  /**
   * Does the repository have a SECURITY file available?
   */
  hasSecurityPolicy: boolean;
  /**
   * Date when the scan was run for this repository
   */
  timestamp: Date;
}

export function getPolicy(octokit: Octokit, logger: Logger) {
  return new Policy(octokit, logger);
}

export interface Logger {
  warn: (message: string) => void;
}

export class Policy {
  constructor(private octokit: Octokit, private logger: Logger) {}

  /**
   * Fetch the Repository metadata from the GitHub API
   * @param repo Name of the repository in org/name format
   */
  async getRepo(name: string): Promise<GitHubRepo> {
    const [owner, repo] = name.split('/');
    const res = await this.octokit.repos.get({
      owner,
      repo,
      headers: {
        accept: 'application/vnd.github.mercy-preview+json',
      },
    });
    return res.data;
  }

  /**
   * Call the GitHub API to obtain repository metadata for a set of repositories
   * that match the given filter.
   * @param search Search query in the GitHub API search syntax.
   *    See https://docs.github.com/en/github/searching-for-information-on-github/searching-for-repositories
   *    Example: `org:googleapis is:public archived:false`
   */
  async getRepos(search: string) {
    const repos: Array<GitHubRepo> = [];
    for (let page = 1; ; page++) {
      const res = await this.octokit.search.repos({
        page,
        per_page: 100,
        q: search,
        headers: {
          // This header is required to obtain `topic` info, which we want to
          // include for queryability purposes.
          accept: 'application/vnd.github.mercy-preview+json',
        },
      });
      if (res.data.incomplete_results) {
        this.logger.warn(`Incomplete results from repo query: ${search}`);
      }
      repos.push(...(res.data.items as {}[] as GitHubRepo[]));
      if (res.data.items.length < 100) {
        break;
      }
    }
    return repos;
  }

  /**
   * Given a relative path, search a given GitHub repository for the file.
   * @param repo Repository metadata from GitHub
   * @param file Relative path to the root of the GitHub repository to find
   * @param checkMagicFolder Also search the `.github` folder for a file
   */
  async checkFileExists(
    repo: GitHubRepo,
    file: string,
    checkMagicFolder = true
  ) {
    const urls = [
      `${githubRawBase}/${repo.full_name}/${repo.default_branch}/${file}`,
    ];
    if (checkMagicFolder) {
      urls.push(
        `${githubRawBase}/${repo.full_name}/${repo.default_branch}/.github/${file}`
      );
    }
    const results = await Promise.all(
      urls.map(url => {
        return request<void>({
          url,
          validateStatus: () => true,
        });
      })
    );
    const good = results.filter(x => x.status === 200);
    return good.length > 0;
  }

  /**
   * RenovateBot is enabled
   */
  async hasRenovate(repo: GitHubRepo) {
    const results = await Promise.all([
      this.checkFileExists(repo, 'renovate.json', true),
      this.checkFileExists(repo, 'renovate.json5', true),
    ]);
    return results.find(x => x === true) || false;
  }

  /**
   * Branch protection with the following rules are enabled:
   * - require code reviews
   * - at least one reviewer required
   * - codeowners approval required
   * - at least one required status check
   */
  async hasBranchProtection(repo: GitHubRepo) {
    const [owner, name] = repo.full_name.split('/');
    type GetBranchProtectionResult =
      Endpoints['GET /repos/{owner}/{repo}/branches/{branch}/protection']['response']['data'];
    let data: GetBranchProtectionResult;
    try {
      const res = await this.octokit.repos.getBranchProtection({
        owner,
        repo: name,
        branch: repo.default_branch,
      });
      data = res.data;
    } catch (e) {
      const err = e as Error;
      console.error(
        `Error checking branch protection for ${repo.full_name}`,
        err.toString()
      );
      // no branch protection at all 😱
      return false;
    }

    if (!data.required_pull_request_reviews) {
      // require code reviews
      return false;
    }
    if (
      !data.required_status_checks ||
      data.required_status_checks.contexts.length === 0
    ) {
      // there is at least one required check
      return false;
    }
    if (!data.required_pull_request_reviews.require_code_owner_reviews) {
      // require code owners review
      return false;
    }
    return true;
  }

  /**
   * Ensure there is a `CODEOWNERS` file.  If this is not available,
   * but the flag is enabled in branch protection, GitHub ignores it.
   */
  async hasCodeOwners(repo: GitHubRepo) {
    return this.checkFileExists(repo, 'CODEOWNERS', true);
  }

  /**
   * Ensure there is a `SECURITY.md` file.
   *
   * In future, also check for:
   * - Reference to SECURITY.md in README.md
   * - Contents of SECURITY.md
   */
  async hasSecurityPolicy(repo: GitHubRepo) {
    return this.checkFileExists(repo, 'SECURITY.md', true);
  }

  /**
   * Merge Commits are disabled
   */
  async hasMergeCommitsDisabled(repo: GitHubRepo) {
    return !repo.allow_merge_commit;
  }

  /**
   * Ensure there is a recognized LICENSE. GitHub verifies the license
   * is valid using https://github.com/licensee/licensee. This license
   * list is purposefully small. We can expand as needed.
   */
  async hasLicense(repo: GitHubRepo) {
    const validLicenses = ['apache-2.0', 'mit', 'bsd-3-clause'];
    return validLicenses.includes(repo.license?.key || '');
  }

  /**
   * Ensure there is a Code of Conduct
   */
  async hasCodeOfConduct(repo: GitHubRepo) {
    // NOTE: With a flag, the GitHub API will return this from the
    // `orgs/${org}/repos` endpoint, but it will NOT be returned
    // from the search endpoint.
    return this.checkFileExists(repo, 'CODE_OF_CONDUCT.md', true);
  }

  /**
   * There is a CONTRIBUTING.md
   */
  async hasContributing(repo: GitHubRepo) {
    return this.checkFileExists(repo, 'CONTRIBUTING.md', true);
  }

  /**
   * Run all known checks in parallel, and return the results.
   *
   * Note: as of now, the GitHub API is not complaining about potential abuse
   * or rate limiting.  We should keep an eye out here to make sure it doesn't
   * start.
   */
  async checkRepoPolicy(repo: GitHubRepo): Promise<PolicyResult> {
    const [
      hasRenovateConfig,
      hasValidLicense,
      hasCodeOfConduct,
      hasContributing,
      hasCodeowners,
      hasBranchProtection,
      hasMergeCommitsDisabled,
      hasSecurityPolicy,
    ] = await Promise.all([
      this.hasRenovate(repo),
      this.hasLicense(repo),
      this.hasCodeOfConduct(repo),
      this.hasContributing(repo),
      this.hasCodeOwners(repo),
      this.hasBranchProtection(repo),
      this.hasMergeCommitsDisabled(repo),
      this.hasSecurityPolicy(repo),
    ]);
    const [org, name] = repo.full_name.split('/');
    const results: PolicyResult = {
      repo: name,
      org: org,
      topics: repo.topics || [],
      language: repo.language || '',
      hasRenovateConfig,
      hasValidLicense,
      hasCodeOfConduct,
      hasContributing,
      hasCodeowners,
      hasBranchProtection,
      hasMergeCommitsDisabled,
      hasSecurityPolicy,
      timestamp: new Date(),
    };
    return results;
  }
}
