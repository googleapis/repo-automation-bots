// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Interface for a github repo allows us to write tests that use local directories
 * instead of touching Github.
 */
export interface GithubRepo {
  getCloneUrl(accessToken?: string): string;
  readonly owner: string;
  readonly repo: string;
  toString(): string;
}

function githubRepo(owner: string, repo: string): GithubRepo {
  return {
    owner,
    repo,
    getCloneUrl(accessToken?: string): string {
      return accessToken
        ? `https://x-access-token:${accessToken}@github.com/${owner}/${repo}.git`
        : `https://github.com/${owner}/${repo}.git`;
    },
    toString(): string {
      return `${owner}/${repo}`;
    },
  };
}

/**
 * Create a GithubRepo instance from its usual `owner/repo` syntax.
 */
export function githubRepoFromOwnerSlashName(arg: string): GithubRepo {
  const [owner, repo] = arg.split('/');
  return githubRepo(owner, repo);
}

/**
 * Create a GithubRepo instance from a full uri like:
 *   git@github.com:googleapis/synthtool.git
 *   https://github.com/googleapis/synthtool.git
 */

export function githubRepoFromUri(uri: string): GithubRepo {
  const matchSsh = uri.match(/^git@github.com:([^/]+)\/(.*)\.git$/);
  if (matchSsh) {
    return githubRepo(matchSsh[1], matchSsh[2]);
  }
  const matchHttps = uri.match(/^https:\/\/[^/]+\/([^/]+)\/(.*)\.git$/);
  if (matchHttps) {
    return githubRepo(matchHttps[1], matchHttps[2]);
  }
  throw `Unable to parse owner and repo name from github uri ${uri}`;
}
