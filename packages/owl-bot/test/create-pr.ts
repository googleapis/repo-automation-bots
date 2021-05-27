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

import {describe, it} from 'mocha';
import * as assert from 'assert';
import {MAX_BODY_LENGTH, MAX_TITLE_LENGTH, resplit} from '../src/create-pr';

describe('resplit', () => {
  it('leaves a short title unchanged', () => {
    const tb = resplit('title', 'body');
    assert.deepStrictEqual(tb, {title: 'title', body: 'body'});
  });

  const loremIpsum =
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.';

  it('resplits a long title', () => {
    const tb = resplit(loremIpsum, 'body');
    assert.strictEqual(tb.title.length, MAX_TITLE_LENGTH);
    assert.ok(tb.title.length < loremIpsum.length);
    assert.deepStrictEqual(tb, {
      body:
        '...r in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.\n\nbody',
      title:
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolo...',
    });
  });

  it('truncates a long body', () => {
    const body = loremIpsum.repeat(64 * 4);
    const tb = resplit(loremIpsum, body);
    assert.strictEqual(tb.title.length, MAX_TITLE_LENGTH);
    assert.strictEqual(tb.body.length, MAX_BODY_LENGTH);
    assert.ok(tb.body.length < body.length);
  });
});
