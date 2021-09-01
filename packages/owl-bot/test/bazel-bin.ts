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
import * as assert from 'assert';
import {getCommonStem, makeTarBallPattern} from '../src/bazel-bin';

describe('makeTarBallPattern', () => {
  it('stripsLeadingSlashes', () => {
    assert.strictEqual(makeTarBallPattern('///sheep'), 'sheep*/**/*.tar.gz');
  });

  it("doesn't append star when ends with slash", () => {
    assert.strictEqual(makeTarBallPattern('a/b/'), 'a/b/**/*.tar.gz');
  });
});

describe('getCommonStem', () => {
  it('real-world', () => {
    const sources = [
      '/google/spanner/(v.*)/.*-java/proto-google-.*/src',
      '/google/spanner/(v.*)/.*-java/grpc-google-.*/src',
      '/google/spanner/(v.*)/.*-java/gapic-google-.*/src',
      '/google/spanner/admin/database/(v.*)/.*-java/proto-google-.*/src',
      '/google/spanner/admin/database/(v.*)/.*-java/grpc-google-.*/src',
      '/google/spanner/admin/database/(v.*)/.*-java/gapic-google-.*/src',
      '/google/spanner/admin/instance/(v.*)/.*-java/proto-google-.*/src',
      '/google/spanner/admin/instance/(v.*)/.*-java/grpc-google-.*/src',
      '/google/spanner/admin/instance/(v.*)/.*-java/gapic-google-.*/src',
    ];
    assert.strictEqual(getCommonStem(sources), '/google/spanner/');
  });

  it('stops at first regexp control character', () => {
    const sources = [
      '/google/spanner/(v.*)/.*-java/proto-google-.*/src',
      '/google/spanner/(v.*)/.*-java/grpc-google-.*/src',
    ];
    assert.strictEqual(getCommonStem(sources), '/google/spanner/');
  });

  it('one string is full stem', () => {
    const sources = [
      '/google/spanner/(v.*)/.*-java/proto-google-.*/src',
      '/google/span',
    ];
    assert.strictEqual(getCommonStem(sources), '/google/span');
    assert.strictEqual(getCommonStem(sources.reverse()), '/google/span');
  });
});
