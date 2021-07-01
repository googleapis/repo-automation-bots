// Copyright 2020 Google LLC
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
//

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable node/no-extraneous-import */

import {parseRegionTagsInPullRequest} from '../src/region-tag-parser';

import {Octokit} from '@octokit/rest';
import {resolve} from 'path';
import * as fs from 'fs';
import assert from 'assert';
import {describe, it} from 'mocha';
import nock from 'nock';

const fixturesPath = resolve(__dirname, '../../test/fixtures');

nock.disableNetConnect();

function createFileResponse(fileName: string) {
  const contents = fs.readFileSync(resolve(fixturesPath, fileName));
  const base64Contents = contents.toString('base64');
  return {
    sha: '',
    node_id: '',
    size: base64Contents.length,
    url: '',
    content: base64Contents,
    encoding: 'base64',
  };
}

describe('region-tag-parser', () => {
  const octokit = new Octokit({auth: '123'});
  describe('parses a diff', () => {
    it('returns a correct result', async () => {
      const diff = fs.readFileSync(resolve(fixturesPath, 'diff.txt'), 'utf8');
      const requests = nock('https://example.com')
        .get('/diff.txt')
        .reply(200, diff);
      const result = await parseRegionTagsInPullRequest(
        octokit,
        'https://example.com/diff.txt',
        'owner',
        'repo',
        'sha',
        'headOwner',
        'headRepo',
        'headSha'
      );
      assert.strictEqual(3, result.added);
      assert.strictEqual(3, result.deleted);
      assert.strictEqual('owner', result.changes[0].owner);
      assert.strictEqual('repo', result.changes[0].repo);
      assert.strictEqual('sha', result.changes[0].sha);
      assert.strictEqual('headOwner', result.changes[1].owner);
      assert.strictEqual('headRepo', result.changes[1].repo);
      assert.strictEqual('headSha', result.changes[1].sha);

      requests.done();
    });
    it('returns a correct result for the case of renaming', async () => {
      const diff = fs.readFileSync(
        resolve(fixturesPath, 'diff-rename.txt'),
        'utf8'
      );
      const scopes = [
        nock('https://example.com').get('/diff.txt').reply(200, diff),
        nock('https://api.github.com')
          .get(
            '/repos/owner/repo/contents/storage%2Fs3-sdk%2Fsrc%2Fmain%2Fjava%2FListGcsBuckets.java?ref=sha'
          )
          .reply(200, createFileResponse('beforeFile.txt'))
          .get(
            '/repos/headOwner/headRepo/contents/storage%2Fs3-sdk%2Fsrc%2Fmain%2Fjava%2Fstorage%2Fs3sdk%2FListGcsBuckets.java?ref=headSha'
          )
          .reply(200, createFileResponse('afterFile.txt')),
      ];

      const result = await parseRegionTagsInPullRequest(
        octokit,
        'https://example.com/diff.txt',
        'owner',
        'repo',
        'sha',
        'headOwner',
        'headRepo',
        'headSha'
      );
      for (const scope of scopes) {
        scope.done();
      }
      assert.strictEqual(result.changes.length, 3);
      assert.strictEqual(result.changes[0].type, 'del');
      assert.strictEqual(
        result.changes[0].regionTag,
        'storage_s3_sdk_list_buckets'
      );
      assert.strictEqual(result.changes[0].owner, 'owner');
      assert.strictEqual(result.changes[0].repo, 'repo');
      assert.strictEqual(
        result.changes[0].file,
        'storage/s3-sdk/src/main/java/ListGcsBuckets.java'
      );
      assert.strictEqual(result.changes[0].sha, 'sha');
      assert.strictEqual(result.changes[0].line, 2);
      assert.strictEqual(result.changes[1].regionTag, 'region_tag_2');
      assert.strictEqual(result.changes[1].line, 6);
      assert.strictEqual(result.changes[2].type, 'add');
      assert.strictEqual(
        result.changes[2].regionTag,
        'storage_s3_sdk_list_buckets'
      );
      assert.strictEqual(result.changes[2].owner, 'headOwner');
      assert.strictEqual(result.changes[2].repo, 'headRepo');
      assert.strictEqual(
        result.changes[2].file,
        'storage/s3-sdk/src/main/java/storage/s3sdk/ListGcsBuckets.java'
      );
      assert.strictEqual(result.changes[2].sha, 'headSha');
      assert.strictEqual(result.changes[2].line, 2);
      assert.strictEqual(result.added, 1);
      assert.strictEqual(result.deleted, 2);
      assert.strictEqual(result.files.length, 1);
      assert.strictEqual(
        result.files[0],
        'storage/s3-sdk/src/main/java/storage/s3sdk/ListGcsBuckets.java'
      );
    });
  });
});
