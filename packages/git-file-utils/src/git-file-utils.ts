// Copyright 2022 Google LLC
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

import {Octokit} from '@octokit/rest';
import {basename, extname} from 'path';

export const DEFAULT_FILE_MODE = '100644';

export class FileNotFoundError extends Error {
  path: string;
  constructor(path: string) {
    super(`Failed to find file: ${path}`);
    this.path = path;
    this.name = FileNotFoundError.name;
  }
}

export interface Repository {
  readonly owner: string;
  readonly repo: string;
}

export interface GitHubFileContents {
  sha: string;
  content: string;
  parsedContent: string;
  mode: string;
}

interface TreeReference {
  ref: string;
  path?: string;
}

/**
 * This class is a read-through cache aimed at minimizing the
 * number of API requests needed to fetch file data/contents.
 * It lazy-caches data as it reads and will return cached data
 * for resources already fetched.
 */
export class RepositoryFileCache {
  private octokit: Octokit;
  private repository: Repository;
  private cache: Map<string, BranchFileCache>;

  /**
   * Instantiate a new loading cache instance
   *
   * @param {Octokit} octokit An authenticated octokit instance
   * @param {Repository} repository The repository we are fetching data for
   */
  constructor(octokit: Octokit, repository: Repository) {
    this.octokit = octokit;
    this.repository = repository;
    this.cache = new Map();
  }

  /**
   * Fetch file contents for given path on a given branch. If the
   * data has already been fetched, return a cached copy.
   *
   * @param {string} path Path to the file
   * @param {string} branch Branch to fetch the file from
   * @returns {GitHubFileContents} The file contents
   */
  async getFileContents(
    path: string,
    branch: string
  ): Promise<GitHubFileContents> {
    const fileCache = this.getBranchFileCache(branch);
    return await fileCache.getFileContents(path);
  }

  /**
   * Find all files with a given filename.
   *
   * @param {string} filename The filename of the files to search for.
   * @param {string} branch The name of the branch to search on.
   * @param {string} pathPrefix If set, limit results to files that begin
   *   with this path prefix. Also if set, returns the path relative to
   *   the path prefix.
   * @returns {string[]} Paths to the files (relative to path prefix)
   */
  async findFilesByFilename(
    filename: string,
    branch: string,
    pathPrefix?: string
  ): Promise<string[]> {
    const fileCache = this.getBranchFileCache(branch);
    return await fileCache.findFilesByFilename(filename, pathPrefix);
  }

  /**
   * Find all files with a given file extension.
   *
   * @param {string} filename The file extension (excluding `.`) of the
   *   files to search for. Example: `yaml`.
   * @param {string} branch The name of the branch to search on.
   * @param {string} pathPrefix If set, limit results to files that begin
   *   with this path prefix. Also if set, returns the path relative to
   *   the path prefix.
   * @returns {string[]} Paths to the files (relative to path prefix)
   */
  async findFilesByExtension(
    extension: string,
    branch: string,
    pathPrefix?: string
  ): Promise<string[]> {
    const fileCache = this.getBranchFileCache(branch);
    return await fileCache.findFilesByExtension(extension, pathPrefix);
  }

  /**
   * Helper to find or create a BranchFileCache
   * @param {string} branch The branch the cache is for
   * @returns {BranchFileCache} The branch file cache
   */
  private getBranchFileCache(branch: string): BranchFileCache {
    let fileCache = this.cache.get(branch);
    if (!fileCache) {
      fileCache = new BranchFileCache(this.octokit, this.repository, branch);
      this.cache.set(branch, fileCache);
    }
    return fileCache;
  }
}

interface TreeEntry {
  type?: string;
  mode?: string;
  path?: string;
  sha?: string;
  size?: number;
}

interface CachedTree {
  tree: TreeEntry[];
  recursive: boolean;
}

interface TreeResponse {
  tree: TreeEntry[];
  truncated: boolean;
}

/**
 * This class is a read-through cache for a single branch aimed
 * at minimizing the number of API requests needed to fetch file
 * data/contents. It lazy-caches data as it reads and will return
 * cached data for resources already fetched.
 */
export class BranchFileCache {
  private octokit: Octokit;
  private repository: Repository;
  private branch: string;
  private cache: Map<string, GitHubFileContents>;
  private treeCache: Map<string, CachedTree>;

  /**
   * Instantiate a new loading cache instance
   *
   * @param {Octokit} octokit An authenticated octokit instance
   * @param {Repository} repository The repository we are fetching data for
   * @param {string} branch The branch we are fetching data from
   */
  constructor(octokit: Octokit, repository: Repository, branch: string) {
    this.octokit = octokit;
    this.repository = repository;
    this.branch = branch;
    this.cache = new Map();
    this.treeCache = new Map();
  }

  /**
   * Fetch file contents for given path. If the data has already been
   * fetched, return the cached copy.
   *
   * @param {string} path Path to the file
   * @param {string} branch Branch to fetch the file from
   * @returns {GitHubFileContents} The file contents
   */
  async getFileContents(path: string): Promise<GitHubFileContents> {
    const cached = this.cache.get(path);
    if (cached) {
      return cached;
    }
    const fetched = await this.fetchFileContents(path);
    this.cache.set(path, fetched);
    return fetched;
  }

  /**
   * Find all files with a given filename.
   *
   * @param {string} filename The filename of the files to search for.
   * @param {string} pathPrefix If set, limit results to files that begin
   *   with this path prefix. Also if set, returns the path relative to
   *   the path prefix.
   * @returns {string[]} Paths to the files (relative to path prefix)
   */
  async findFilesByFilename(
    filename: string,
    pathPrefix?: string
  ): Promise<string[]> {
    const files: string[] = [];
    for await (const treeEntry of this.treeEntryIterator(this.branch, pathPrefix)) {
      if (basename(treeEntry.path!) === filename) {
        files.push(treeEntry.path!);
      }
    }
    return stripPrefix(files, pathPrefix);
  }

  /**
   * Find all files with a given file extension.
   *
   * @param {string} filename The file extension (excluding `.`) of the
   *   files to search for. Example: `yaml`.
   * @param {string} pathPrefix If set, limit results to files that begin
   *   with this path prefix. Also if set, returns the path relative to
   *   the path prefix.
   * @returns {string[]} Paths to the files (relative to path prefix)
   */
  async findFilesByExtension(
    extension: string,
    pathPrefix?: string
  ): Promise<string[]> {
    const files: string[] = [];
    for await (const treeEntry of this.treeEntryIterator(this.branch, pathPrefix)) {
      if (extname(treeEntry.path!) === extension) {
        files.push(treeEntry.path!);
      }
    }
    return stripPrefix(files, pathPrefix);
  }

  /**
   * Actually fetch the file contents. Uses the tree API to fetch file
   * data.
   *
   * @param {string} path Path to the file
   */
  private async fetchFileContents(path: string): Promise<GitHubFileContents> {
    // try to use the entire git tree if it's not too big
    const treeEntries = await this.getFullTree();
    if (treeEntries) {
      // logger.debug(`Using full tree to find ${path}`);
      const found = treeEntries.find(entry => entry.path === path);
      if (found?.sha) {
        return await this.fetchContents(found.sha, found);
      }
      throw new FileNotFoundError(path);
    }

    // full tree is too big, use data API to fetch
    const parts = path.split('/');
    let treeSha = this.branch;
    let found: TreeEntry | undefined;
    for (const part of parts) {
      const {tree} = await this.getTree(treeSha);
      found = tree.find(item => item.path === part);
      if (!found?.sha) {
        throw new FileNotFoundError(path);
      }
      treeSha = found.sha;
    }

    if (found?.sha) {
      return await this.fetchContents(found.sha, found);
    }
    throw new FileNotFoundError(path);
  }

  /**
   * Return the full recursive git tree. If already fetched, return
   * the cached version. If the tree is too big, return null.
   *
   * @returns {TreeEntry[]} The tree entries
   */
  private async getFullTree(): Promise<TreeEntry[] | null> {
    const cachedTree = await this.getTree(this.branch);
    if (cachedTree.recursive) {
      return cachedTree.tree;
    }
    return null;
  }

  /**
   * Returns the git tree for a given SHA. If already fetched, return
   * the cached version. If possible, return the entire contents of the
   * (sub)tree. This will limit the number
   *
   * @param {string} sha The tree SHA
   * @returns {CachedTree} The tree entries and whether the subtree response
   *   was complete or not (recursive: true means that we have all the files)
   */
  private async getTree(sha: string): Promise<CachedTree> {
    const cached = this.treeCache.get(sha);
    if (cached) {
      // We've already fetching this tree, return the cached version
      return cached;
    }

    // try the fetch the entire tree first
    const fetched = await this.fetchTree(sha, true);
    if (fetched.truncated) {
      // we are unable to fetch the entire tree, so fetch only contents of
      // this single directory
      const singleDirectory = await this.fetchTree(sha, false);
      if (singleDirectory.truncated) {
        // the single directory has too many files, we can't drill down any
        // further
        console.warn(
          `non-recursive file list for tree ${sha} is truncated, this folder has too many files!!!`
        );
      }
      const cachedTree = {
        tree: singleDirectory.tree,
        recursive: false,
      };
      this.treeCache.set(sha, cachedTree);
      return cachedTree;
    } else {
      // we are able to fetch all the files in this (sub)tree
      const cachedTree = {
        tree: fetched.tree,
        recursive: true,
      };
      this.treeCache.set(sha, cachedTree);
      return cachedTree;
    }
  }

  /**
   * Fetch the git tree via the GitHub API
   *
   * @param {string} sha The tree SHA
   * @param {boolean} recursive Whether to make a recursive call or not
   * @returns {TreeResponse} The tree response
   */
  private async fetchTree(
    sha: string,
    recursive: boolean
  ): Promise<TreeResponse> {
    const {
      data: {tree, truncated},
    } = await this.octokit.git.getTree({
      owner: this.repository.owner,
      repo: this.repository.repo,
      tree_sha: sha,
      // fetching tree non-recursively requires omitting the param
      recursive: recursive ? 'true' : undefined,
    });
    return {
      tree,
      truncated,
    };
  }

  /**
   * Async iterator for iterating over all files in the repository.
   *
   * @param {string} ref The starting git tree reference. Can be a tree SHA or
   *   a branch reference.
   * @param {string} pathPrefix If set, limit results to files that begin
   *   with this path prefix.
   */
  private async *treeEntryIterator(
    ref: string,
    pathPrefix?: string,
  ): AsyncGenerator<TreeEntry, void, void> {
    const treeShas: TreeReference[] = [{ref}];
    let treeReference: TreeReference | undefined;
    while ((treeReference = treeShas.shift())) {
      const cachedTree = await this.getTree(treeReference.ref);
      for (const treeEntry of cachedTree.tree) {
        // paths are relative to the fetched directory, so normalize the path
        const path = treeReference.path
          ? `${treeReference.path}/${treeEntry.path}`
          : treeEntry.path!;

        // short-circuit iterator if we're in the wrong directory
        if (pathPrefix && path && !pathPrefix.startsWith(path) && !path.startsWith(pathPrefix)) {
          continue;
        }

        // If the result for this SHA was incomplete, dig deeper on the subtrees
        if (!cachedTree.recursive && treeEntry.type === 'tree') {
          treeShas.push({ref: treeEntry.sha!, path});
        }
        yield {
          ...treeEntry,
          path,
        };
      }
    }
  }

  /**
   * Fetch the git blob from the GitHub API and convert into a
   * GitHubFileContents object.
   *
   * @param {string} blobSha The git blob SHA
   * @param {TreeEntry} treeEntry The associated tree object
   */
  private async fetchContents(
    blobSha: string,
    treeEntry: TreeEntry
  ): Promise<GitHubFileContents> {
    const {
      data: {content},
    } = await this.octokit.git.getBlob({
      owner: this.repository.owner,
      repo: this.repository.repo,
      file_sha: blobSha,
    });
    return {
      sha: blobSha,
      mode: treeEntry.mode || DEFAULT_FILE_MODE,
      content,
      parsedContent: Buffer.from(content, 'base64').toString('utf8'),
    };
  }
}

function stripPrefix(files: string[], prefix?: string): string[] {
  if (!prefix) {
    return files;
  }
  const prefixRegex = new RegExp(`^${prefix}[/\\\\]`);
  return files
    .filter(file => file.startsWith(`${prefix}/`))
    .map(file => file.replace(prefixRegex, ''));
}
