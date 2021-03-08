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
}

/**
 * Create a GithubRepo instance from its usual `owner/repo` syntax.
 */
export function githubRepoFromOwnerSlashName(arg: string): GithubRepo {
  const [owner, repo] = arg.split('/');
  return {
    owner,
    repo,
    getCloneUrl(accessToken?: string): string {
      return accessToken
        ? `https://x-access-token:${accessToken}@github.com/${arg}.git`
        : `https://github.com/${arg}.git`;
    },
  };
}
