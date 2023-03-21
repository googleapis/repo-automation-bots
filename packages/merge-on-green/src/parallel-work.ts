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

import AggregateError from 'aggregate-error';

const DEFAULT_GROUP_SIZE = 4;

interface AsyncGroupsOptions {
  groupSize?: number;
  throwOnError?: boolean;
}
type SingleItemHandler<TItem, TResult> = (item: TItem) => Promise<TResult>;
/**
 * Helper that executes a single item handler for each item in parallel
 * groups.
 * @param {TItem[]} items The list of items to handle.
 * @param {SingleItemHandler<TItem, TResult>} asyncHandler The single item async
 *   handler
 * @param {number} options.groupSize The number of parallel executions. Defaults to 4.
 * @param {boolean} options.throwOnError Whether to throw an AggregateError if any items fail
 * @returns A list of settled promise results (either failure or success).
 * @throws {AggregateError} if any items fails which contains all the thrown Errors.
 */
export async function forAllInAsyncGroups<TItem, TResult>(
  items: TItem[],
  asyncHandler: SingleItemHandler<TItem, TResult>,
  options: AsyncGroupsOptions = {}
): Promise<PromiseSettledResult<TResult>[]> {
  const groupSize = options?.groupSize ?? DEFAULT_GROUP_SIZE;
  const throwOnError = options?.throwOnError ?? false;
  let results: PromiseSettledResult<TResult>[] = [];
  for (let i = 0; i < items.length; i += groupSize) {
    const group = items.slice(i, i + groupSize);
    const partial = await Promise.allSettled(group.map(pr => asyncHandler(pr)));
    results = results.concat(...partial);
  }

  if (throwOnError) {
    const errors: Error[] = [];
    for (const result of results) {
      if (result.status === 'rejected') {
        errors.push(result.reason);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors);
    }
  }

  return results;
}
