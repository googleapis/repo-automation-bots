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

import {resolve} from 'path';
import * as fs from 'fs';
import assert from 'assert';
import {describe, it} from 'mocha';

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('region-tag-parser', () => {
  const diff = fs.readFileSync(resolve(fixturesPath, 'diff.txt'), 'utf8');
  describe('parses a diff', () => {
    it('returns a correct result', () => {
      const result = parseRegionTagsInPullRequest(
        diff,
        'owner',
        'repo',
        'sha',
        'headOwner',
        'headRepo',
        'headSha'
      );
      assert(result.added === 3);
      assert(result.deleted === 3);
      assert(result.changes[0].owner === 'owner');
      assert(result.changes[0].repo === 'repo');
      assert(result.changes[0].sha === 'sha');
      assert(result.changes[1].owner === 'headOwner');
      assert(result.changes[1].repo === 'headRepo');
      assert(result.changes[1].sha === 'headSha');
    });
  });
});
