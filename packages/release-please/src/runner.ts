// Copyright 2019 Google LLC
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

import {Octokit, RestEndpointMethodTypes} from '@octokit/rest';
import {CreatedRelease, Manifest} from 'release-please';
import {Repository} from 'release-please/build/src/repository';

export class Runner {
  static createPullRequests = async (manifest: Manifest) => {
    await manifest.createPullRequests();
  };
  static createReleases = async (
    manifest: Manifest
  ): Promise<CreatedRelease[]> => {
    const releases = await manifest.createReleases();
    return releases.filter(release => !!release);
  };

  /**
   * Creates a lightweight tag in the GitHub repository.
   *
   * @param octokit
   * @param repository
   * @param tagName The tag name to create. It must not have 'refs/tags' prefix.
   * @param sha The sha to create tag to.
   * @returns
   */
  static createLightweightTag = async (
    octokit: Octokit,
    repository: Repository,
    tagName: string,
    sha: string
  ): Promise<RestEndpointMethodTypes['git']['createRef']['response']> => {
    // A lightweight tag only requires this create references API call,
    // rather than a tag object (/repos/{owner}/{repo}/git/tags).
    // https://docs.github.com/en/rest/git/tags?apiVersion=2022-11-28#create-a-tag-object
    // https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28#create-a-reference
    const tagRefName = `refs/tags/${tagName}`;
    return octokit.git.createRef({
      owner: repository.owner,
      repo: repository.repo,
      ref: tagRefName,
      sha: sha,
    });
  };
}
