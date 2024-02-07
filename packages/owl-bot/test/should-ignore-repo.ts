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

import {describe, it} from 'mocha';
import * as assert from 'assert';
import {shouldIgnoreRepo} from '../src/should-ignore-repo';

describe('shouldIgnoreRepo', () => {
  it('ignores googleapis', () => {
    assert.ok(shouldIgnoreRepo('googleapis/googleapis'));
  });
  it('ignores googleapis-gen', () => {
    assert.ok(shouldIgnoreRepo('googleapis/googleapis-gen'));
  });
  it('ignores PHP sharded repo', () => {
    assert.ok(shouldIgnoreRepo('googleapis/google-cloud-php-asset'));
  });
  it('ignores non-cloud PHP sharded repo', () => {
    assert.ok(shouldIgnoreRepo('googleapis/php-shopping-merchant-reports'));
  });
  it("doesn't ignore PHP root repo", () => {
    assert.ok(!shouldIgnoreRepo('googleapis/google-cloud-php'));
  });
  it("doesn't ignore some other repos", () => {
    assert.ok(!shouldIgnoreRepo('googleapis/google-cloud-dotnet'));
    assert.ok(!shouldIgnoreRepo('googleapis/nodejs-asset'));
    assert.ok(!shouldIgnoreRepo('SurferJeffAtGoogle/googleapis'));
    assert.ok(!shouldIgnoreRepo('googleapis-gen/googleapis'));
  });
});
