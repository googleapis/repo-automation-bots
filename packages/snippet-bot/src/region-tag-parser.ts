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

import parseDiff from 'parse-diff';

/**
 * The result for unmatched region tag checks.
 */
export interface ParseResult {
  result: boolean;
  messages: string[];
  tagsFound: boolean;
}

type ChangeTypes = 'add' | 'del';

/**
 * A single region tag change in a pull request.
 */
export interface Change {
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
  changes: Change[];
  added: number;
  deleted: number;
}

export const START_TAG_REGEX = /\[START ([^\]]*)\]/;
const END_TAG_REGEX = /\[END ([^\]]*)\]/;

/**
 * Detects region tag changes in a pull request and return the summary.
 */
export function parseRegionTagsInPullRequest(
  diff: string,
  owner: string,
  repo: string,
  sha: string,
  headOwner: string,
  headRepo: string,
  headSha: string
): ChangesInPullRequest {
  const changes: Change[] = [];
  const ret = {
    changes: changes,
    added: 0,
    deleted: 0,
  };

  const diffResult = parseDiff(diff);
  for (const file of diffResult) {
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
  return ret;
}

/**
 * Parses a single file and checks unmatched region tags.
 */
export function parseRegionTags(
  contents: string,
  filename: string
): ParseResult {
  const result: ParseResult = {result: true, messages: [], tagsFound: false};
  const tags: Array<[number, string]> = [];

  let lineno = 0;
  contents.split(/\r?\n/).forEach(line => {
    lineno++;
    // Check the start tag
    const startMatch = line.match(START_TAG_REGEX);
    if (startMatch) {
      // We found the region tag.
      result.tagsFound = true;
      // startMatch[1] should hold the name of the region tag.
      // If we already have the same tag, it's an error.
      let alreadyStarted = false;
      for (const tag of tags) {
        if (tag[1] === startMatch[1]) {
          alreadyStarted = true;
          result.result = false;
          result.messages.push(
            `${filename}:${lineno}, tag \`${startMatch[1]}\` has already started`
          );
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
        result.messages.push(
          `${filename}:${lineno}, tag \`${endMatch[1]}\` doesn't have a matching start tag`
        );
      } else {
        // Remove the matched start tag
        tags.splice(startTagIndex, 1);
      }
    }
  });
  // After the loop, the temporary list must be empty.
  for (const tag of tags) {
    result.result = false;
    result.messages.push(
      `${filename}:${tag[0]}, tag \`${tag[1]}\` doesn't have a matching end tag`
    );
  }
  return result;
}
