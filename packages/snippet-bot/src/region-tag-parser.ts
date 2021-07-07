// Copyright 2020 Google LLC
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

import {Violation} from './violations';
import {isFile} from './utils';

/* eslint-disable-next-line node/no-extraneous-import */
import {Octokit} from '@octokit/rest';
import parseDiff from 'parse-diff';
import fetch from 'node-fetch';
import {logger} from 'gcf-utils';

/**
 * The result for unmatched region tag checks.
 *
 * We want to keep track of which region tags are in which files.
 */
export interface ParseResult {
  result: boolean;
  violations: Violation[];
  tagsFound: boolean;
  startTags: string[];
}

type ChangeTypes = 'add' | 'del' | 'unknown';

/**
 * A single region tag change in a pull request.
 */
export interface RegionTagLocation {
  type: ChangeTypes;
  regionTag: string;
  owner: string;
  repo: string;
  file?: string;
  sha: string;
  line: number;
}

/**
 * The summary of the region tag changes in a pull request.
 */
export interface ChangesInPullRequest {
  changes: RegionTagLocation[];
  added: number;
  deleted: number;
  files: string[];
}

export const START_TAG_REGEX = /\[START ([^\]]*)\]/;
const END_TAG_REGEX = /\[END ([^\]]*)\]/;

/**
 * Detects region tag changes in a pull request and return the summary.
 */
export async function parseRegionTagsInPullRequest(
  octokit: Octokit,
  diffUrl: string,
  owner: string,
  repo: string,
  sha: string,
  headOwner: string,
  headRepo: string,
  headSha: string
): Promise<ChangesInPullRequest> {
  const changes: RegionTagLocation[] = [];
  const files: string[] = [];
  const ret = {
    changes: changes,
    added: 0,
    deleted: 0,
    files: files,
  };
  const response = await fetch(diffUrl);
  const diff = await response.text();
  const diffResult = parseDiff(diff);
  for (const file of diffResult) {
    if (file.to !== undefined && file.to !== '/dev/null') {
      ret.files.push(file.to);
    }
    if (
      file.to !== undefined &&
      file.to !== '/dev/null' &&
      file.from !== undefined &&
      file.from !== '/dev/null' &&
      file.from !== file.to
    ) {
      // For the case of renaming the file, we scan the files directly,
      // no need to understand the diffs.
      try {
        const blobBeforeRename = await octokit.repos.getContent({
          owner: owner,
          repo: repo,
          path: file.from,
          ref: sha,
        });
        if (!isFile(blobBeforeRename.data)) {
          continue;
        }
        const fileContentsBeforeRename = Buffer.from(
          blobBeforeRename.data.content,
          'base64'
        ).toString('utf8');

        const linesBeforeRename = fileContentsBeforeRename.split('\n');
        for (let i = 0; i < linesBeforeRename.length; i++) {
          const startMatch = linesBeforeRename[i].match(START_TAG_REGEX);
          if (startMatch) {
            ret.deleted += 1;
            ret.changes.push({
              type: 'del',
              regionTag: startMatch[1],
              owner: owner,
              repo: repo,
              file: file.from,
              sha: sha,
              line: i + 1,
            });
          }
        }
        const blobAfterRename = await octokit.repos.getContent({
          owner: headOwner,
          repo: headRepo,
          path: file.to,
          ref: headSha,
        });
        if (!isFile(blobAfterRename.data)) {
          continue;
        }
        const fileContentsAfterRename = Buffer.from(
          blobAfterRename.data.content,
          'base64'
        ).toString('utf8');

        const linesAfterRename = fileContentsAfterRename.split('\n');
        for (let i = 0; i < linesAfterRename.length; i++) {
          const startMatch = linesAfterRename[i].match(START_TAG_REGEX);
          if (startMatch) {
            ret.added += 1;
            ret.changes.push({
              type: 'add',
              regionTag: startMatch[1],
              owner: headOwner,
              repo: headRepo,
              file: file.to,
              sha: headSha,
              line: i + 1,
            });
          }
        }
      } catch (err) {
        // See: https://github.com/googleapis/repo-automation-bots/issues/2246
        // TODO: Migrate to Git Data API.
        err.message =
          'Skipping the diff entry because it failed to read the' +
          ` file: ${err.message}`;
        logger.error(err);
        continue;
      }
    } else {
      for (const chunk of file.chunks) {
        for (const change of chunk.changes) {
          if (change.type === 'normal') {
            continue;
          }
          // We only track add/deletion of start tags.
          const startMatch = change.content.match(START_TAG_REGEX);
          if (startMatch) {
            if (change.type === 'add') {
              ret.added += 1;
            }
            if (change.type === 'del') {
              ret.deleted += 1;
            }
            ret.changes.push({
              type: change.type === 'del' ? 'del' : 'add',
              regionTag: startMatch[1],
              owner: change.type === 'del' ? owner : headOwner,
              repo: change.type === 'del' ? repo : headRepo,
              file: change.type === 'del' ? file.from : file.to,
              sha: change.type === 'del' ? sha : headSha,
              line: change.ln,
            });
          }
        }
      }
    }
  }
  return ret;
}

/**
 * Parses a single file and checks unmatched region tags.
 */
export function parseRegionTags(
  contents: string,
  filename: string,
  owner: string,
  repo: string,
  sha: string
): ParseResult {
  const result: ParseResult = {
    result: true,
    violations: [],
    tagsFound: false,
    startTags: [],
  };
  const tags: Array<[number, string]> = [];

  let lineno = 0;
  contents.split(/\r?\n/).forEach(line => {
    lineno++;
    // Check the start tag
    const startMatch = line.match(START_TAG_REGEX);
    if (startMatch) {
      // We found the region tag.
      result.tagsFound = true;
      if (!result.startTags.includes(startMatch[1])) {
        result.startTags.push(startMatch[1]);
      }
      // startMatch[1] should hold the name of the region tag.
      // If we already have the same tag, it's an error.
      let alreadyStarted = false;
      for (const tag of tags) {
        if (tag[1] === startMatch[1]) {
          alreadyStarted = true;
          result.result = false;
          result.violations.push({
            violationType: 'TAG_ALREADY_STARTED',
            location: {
              type: 'unknown',
              regionTag: startMatch[1],
              owner: owner,
              repo: repo,
              file: filename,
              sha: sha,
              line: lineno,
            },
            devsite_urls: [],
          });
        }
      }
      if (!alreadyStarted) {
        // add to the temporary list
        tags.push([lineno, startMatch[1]]);
      }
    }
    const endMatch = line.match(END_TAG_REGEX);
    if (endMatch) {
      // endMatch[1] should hold the name of the region tag.
      // If we don't have the same tag in the temporary list, it's an error.
      let startTagIndex = -1;
      for (let i = 0; i < tags.length; i++) {
        // We preserve the index of the matched tag for removing it later.
        if (tags[i][1] === endMatch[1]) {
          startTagIndex = i;
        }
      }
      if (startTagIndex === -1) {
        // No matching start tag.
        result.result = false;
        result.violations.push({
          violationType: 'NO_MATCHING_START_TAG',
          location: {
            type: 'unknown',
            regionTag: endMatch[1],
            owner: owner,
            repo: repo,
            file: filename,
            sha: sha,
            line: lineno,
          },
          devsite_urls: [],
        });
      } else {
        // Remove the matched start tag
        tags.splice(startTagIndex, 1);
      }
    }
  });
  // After the loop, the temporary list must be empty.
  for (const tag of tags) {
    result.result = false;
    result.violations.push({
      violationType: 'NO_MATCHING_END_TAG',
      location: {
        type: 'unknown',
        regionTag: tag[1],
        owner: owner,
        repo: repo,
        file: filename,
        sha: sha,
        line: tag[0],
      },
      devsite_urls: [],
    });
  }
  return result;
}
