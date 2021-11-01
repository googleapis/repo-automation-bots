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
import {filterBuildsToRetry} from '../src/scan-and-retry-failed-lock-updates';
import {google} from '@google-cloud/cloudbuild/build/protos/protos';

async function* asyncIteratorFrom<T>(array: T[]): AsyncIterable<T> {
  for (const t of array) {
    yield t;
  }
}

describe('filterBuildsToRetry', () => {
  it('rebuilds one failure', async () => {
    const builds: google.devtools.cloudbuild.v1.IBuild[] = [
      {
        name: 'iFailed',
        createTime: {seconds: 1632347329, nanos: 10},
        buildTriggerId: 'a2',
        status: 'FAILURE',
        substitutions: {_CONTAINER: 'gcr.io/x/owlbot-nodes'},
      },
    ];
    const rebuilds = await filterBuildsToRetry(
      'a2',
      3,
      asyncIteratorFrom(builds)
    );
    assert.deepStrictEqual(builds, rebuilds);
  });

  it('ignores mismatched trigger id', async () => {
    const builds: google.devtools.cloudbuild.v1.IBuild[] = [
      {
        name: 'iFailed',
        createTime: {seconds: 1632347329, nanos: 10},
        buildTriggerId: 'a3',
        status: 'FAILURE',
        substitutions: {_CONTAINER: 'gcr.io/x/owlbot-nodes'},
      },
    ];
    const rebuilds = await filterBuildsToRetry(
      'a2',
      3,
      asyncIteratorFrom(builds)
    );
    assert.deepStrictEqual([], rebuilds);
  });

  it('ignores successful build', async () => {
    const builds: google.devtools.cloudbuild.v1.IBuild[] = [
      {
        name: 'iSucceeded',
        createTime: {seconds: 1632347329, nanos: 10},
        buildTriggerId: 'a2',
        status: 'SUCCESS',
        substitutions: {_CONTAINER: 'gcr.io/x/owlbot-nodes'},
      },
      {
        name: 'iFailed',
        createTime: {seconds: 1632347029, nanos: 9},
        buildTriggerId: 'a2',
        status: 'FAILURE',
        substitutions: {_CONTAINER: 'gcr.io/x/owlbot-nodes'},
      },
    ];
    const rebuilds = await filterBuildsToRetry(
      'a2',
      3,
      asyncIteratorFrom(builds)
    );
    assert.deepStrictEqual([], rebuilds);
  });

  it('ignores two-day old failure', async () => {
    const builds: google.devtools.cloudbuild.v1.IBuild[] = [
      {
        name: 'iFailed',
        createTime: {seconds: 1632347329, nanos: 10},
        buildTriggerId: 'a2',
        status: 'FAILURE',
        substitutions: {_CONTAINER: 'gcr.io/x/owlbot-nodes'},
      },
      {
        name: 'iFailedTwoDaysAgo',
        createTime: {seconds: 1632174529, nanos: 12},
        buildTriggerId: 'a2',
        status: 'FAILURE',
        substitutions: {_CONTAINER: 'gcr.io/y/owlbot-nodes'},
      },
    ];
    const rebuilds = await filterBuildsToRetry(
      'a2',
      3,
      asyncIteratorFrom(builds)
    );
    assert.deepStrictEqual([builds[0]], rebuilds);
  });

  it('ignores build that exceeds max-failures', async () => {
    const builds: google.devtools.cloudbuild.v1.IBuild[] = [
      {
        name: 'iFailedAgain',
        createTime: {seconds: 1632347329, nanos: 10},
        buildTriggerId: 'a2',
        status: 'FAILURE',
        substitutions: {_A: 'b', _C: 'd'},
      },
      {
        name: 'iFailed',
        createTime: {seconds: 1632347029, nanos: 10},
        buildTriggerId: 'a2',
        status: 'FAILURE',
        substitutions: {_C: 'd', _A: 'b'},
      },
    ];
    const rebuilds = await filterBuildsToRetry(
      'a2',
      2,
      asyncIteratorFrom(builds)
    );
    assert.deepStrictEqual([], rebuilds);
  });

  it('ignores build that exceeds max-failures over 48 hours', async () => {
    const builds: google.devtools.cloudbuild.v1.IBuild[] = [
      {
        name: 'iFailedAgain',
        createTime: {seconds: 1632347329, nanos: 10},
        buildTriggerId: 'a2',
        status: 'FAILURE',
        substitutions: {_A: 'b', _C: 'd'},
      },
      {
        name: 'iFailed',
        createTime: {seconds: 1632260628, nanos: 10},
        buildTriggerId: 'a2',
        status: 'FAILURE',
        substitutions: {_C: 'd', _A: 'b'},
      },
    ];
    const rebuilds = await filterBuildsToRetry(
      'a2',
      2,
      asyncIteratorFrom(builds)
    );
    assert.deepStrictEqual([], rebuilds);
  });
});
