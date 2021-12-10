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

import {OctokitType} from './utils/octokit-util';
import {Storage} from '@google-cloud/storage';
import {logger} from 'gcf-utils';

/**
 * This interface is used for comforting typescript's type system to
 * deal with the response from `octokit.repos.getContent`.
 */
interface File {
  content: string | undefined;
}

/**
 * This function is used for comforting typescript's type system to
 * deal with the response from `octokit.repos.getContent`.
 */
function isFile(file: File | unknown): file is File {
  return (file as File).content !== undefined;
}

const COMMIT_CACHE_BUCKET = 'github_commit_cache';

// Load full contents of GitHub repository from commit cache,
// use this to iterate over individual .repo-metadata.json files.
// This approach is used for the benefit of mono-repos.
export class FileIterator {
  octokit: OctokitType;
  owner: string;
  repo: string;
  storage: Storage;
  lastSha?: string;
  constructor(owner: string, repo: string, octokit: OctokitType) {
    this.octokit = octokit;
    this.owner = owner;
    this.repo = repo;
    this.storage = new Storage();
  }
  // Emit any .repo-metadata.json files found in file listing.
  async *repoMetadata() {
    const files = await this.getFileListing();
    if (!files) {
      logger.warn(`unable to find file listing for ${this.owner}/${this.repo}`);
      return;
    }
    for (const path of files.trim().split(/\r?\n/)) {
      if (path.toLowerCase().endsWith('.repo-metadata.json')) {
        const resp = (
          await this.octokit.rest.repos.getContent({
            owner: this.owner,
            repo: this.repo,
            path,
          })
        ).data;
        if (isFile(resp)) {
          yield [path, Buffer.from(resp.content, 'base64').toString('utf8')];
        }
      }
    }
  }
  // Fetch the file listing from commit cache.
  async getFileListing(): Promise<string> {
    const perPage = 5;
    const commits = (
      await this.octokit.rest.repos.listCommits({
        owner: this.owner,
        repo: this.repo,
        per_page: perPage,
      })
    ).data;
    // Immediately after a commit, it can take a few minutes for a
    // manifest to populate, check the last few commits to
    // allow for this:
    let manifest = '';
    for (let i = 0; i < perPage; i++) {
      const commit = commits[i];
      if (commit) {
        // https://storage.cloud.google.com/github_commit_cache/owners/googleapis/repos/common-protos-ruby/commits/05c465a67533c9b0f71b1ff49903743a657c4208/file_manifest.txt
        const manifestFile = `owners/${this.owner}/repos/${this.repo}/commits/${commit.sha}/file_manifest.txt`;
        try {
          const [result] = await this.storage
            .bucket(COMMIT_CACHE_BUCKET)
            .file(manifestFile)
            .download();
          this.lastSha = commit.sha;
          manifest = result.toString('utf8');
          break;
        } catch (_err) {
          const err = _err as {code: number};
          if (err.code === 404) {
            continue;
          } else {
            throw err;
          }
        }
      }
    }
    return manifest;
  }
  async getFile(file: string): Promise<string> {
    // By loading the file index, we ensure that we've chosen a SHA for a fully indexed
    // version of commits in cache:
    if (!this.lastSha) {
      await this.getFileListing();
    }
    file = `owners/${this.owner}/repos/${this.repo}/commits/${this.lastSha}/files/${file}`;
    const [result] = await this.storage
      .bucket(COMMIT_CACHE_BUCKET)
      .file(file)
      .download();
    return result.toString('utf8');
  }
}
