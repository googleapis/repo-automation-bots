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
import assert from 'assert';
import {forAllInAsyncGroups} from '../src/parallel-work';
import AggregateError from 'aggregate-error';

describe('forAllInAsyncGroups', () => {
  const handler = async function (x: number): Promise<number> {
    if (x % 2 === 0) {
      return x;
    } else {
      throw new Error(`odd number: ${x}`);
    }
  };
  const input: number[] = [];
  for (let i = 0; i < 10; i++) {
    input.push(i);
  }

  it('runs all work items', async () => {
    const results = await forAllInAsyncGroups(input, handler);
    assert.strictEqual(results.length, 10);
    const successes = results.filter(result => result.status === 'fulfilled');
    assert.strictEqual(successes.length, 5);
    const failures = results.filter(result => result.status === 'rejected');
    assert.strictEqual(failures.length, 5);
    for (const failure of failures) {
      assert.ok(
        failure.status === 'rejected' && failure.reason instanceof Error
      );
    }
  });

  it('throws if throwOnError is specified', async () => {
    await assert.rejects(
      async () => {
        await forAllInAsyncGroups(input, handler, {throwOnError: true});
      },
      err => {
        return err instanceof AggregateError;
      }
    );
  });

  it('succeeds when throwOnError is specified', async () => {
    const results = await forAllInAsyncGroups(
      input.map(x => x * 2),
      handler,
      {throwOnError: true}
    );
    assert.strictEqual(results.length, 10);
    const successes = results.filter(result => result.status === 'fulfilled');
    assert.strictEqual(successes.length, 10);
  });
});
