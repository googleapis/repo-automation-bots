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
import {encodeId, decodeId} from '../src/database';
import * as assert from 'assert';

describe('encodeId', () => {
  it('encodes and decodes special characters', () => {
    const chars = '%/+?&=';
    const encoded = encodeId(chars);
    assert.strictEqual(encoded, '%25%2F%2B?&=');
    assert.strictEqual(decodeId(encoded), chars);
  });

  it('encodes and decodes utf-8', () => {
    const chars = 'こんにちは世界 ';
    const encoded = encodeId(chars);
    assert.strictEqual(encoded, chars);
    assert.strictEqual(decodeId(encoded), chars);
  });

  it('encodes repeated special chars', () => {
    const chars = '/%+/%+/%+';
    const encoded = encodeId(chars);
    assert.strictEqual(encoded, '%2F%25%2B%2F%25%2B%2F%25%2B');
    assert.strictEqual(decodeId(encoded), chars);
  });
});
