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

import {google} from '@google-cloud/cloudbuild/build/protos/protos';
import {core} from './core';

const twentyFourHours =
  60 * // seconds
  60 * // minutes
  24; // hours.

const seventyTwoHours = 3 * twentyFourHours;

/**
 * Scans all the cloud builds for the past 24 hours, and retries builds
 * that never succeeded.
 *
 * @param maxTries try building each trigger at most this many times
 */

export async function scanAndRetryFailedLockUpdates(
  projectId: string,
  triggerId: string,
  maxTries: number,
  logger = console
): Promise<void> {
  const cb = core.getCloudBuildInstance();
  const builds = cb.listBuildsAsync({projectId, pageSize: 100});
  const rebuilds = await filterBuildsToRetry(
    triggerId,
    maxTries,
    builds,
    logger
  );
  logger.info(`${rebuilds.length} to rebuild`);
  for (const build of rebuilds) {
    logger.info(`Triggering rebuild for ${build.name}`);
    logger.debug(build);
    // This Cloud Run job will run once per hour, so we don't have to worry
    // about throttling retries.
    await cb.retryBuild({
      name: build.name,
      projectId: build.projectId,
      id: build.id,
    });
  }
}

/**
 * Scans all the cloud builds for the past 24 hours looking for failures for
 * the given build trigger.  Returns a list of builds that should be retried
 * because they never succeeded.
 *
 * @param maxTries try building each trigger at most this many times
 */
export async function filterBuildsToRetry(
  triggerId: string,
  maxTries: number,
  builds: AsyncIterable<google.devtools.cloudbuild.v1.IBuild>,
  logger = console
): Promise<google.devtools.cloudbuild.v1.IBuild[]> {
  // An original build and its retry build will share the same substitution
  // values.  So group them by substition values.
  // Map each failure to the number of times it failed.
  const countsMap: Map<
    string,
    {
      build: google.devtools.cloudbuild.v1.IBuild;
      successCount: number;
      failureCount: number;
    }
  > = new Map();
  let newestCreateTime: google.protobuf.ITimestamp | null = null;
  for await (const build of builds) {
    logger.debug(`${build.createTime?.seconds} ${build.name}`);
    if (!newestCreateTime) {
      newestCreateTime = build.createTime!;
    }
    const secondsElapsedSinceCreateTime =
      Number(newestCreateTime.seconds) - Number(build.createTime!.seconds);
    if (secondsElapsedSinceCreateTime > seventyTwoHours) {
      logger.info('Finished scanning recent builds.');
      break;
    }
    if (build.buildTriggerId !== triggerId) {
      continue; // Not a lock update build.
    }
    const failed =
      build.status === 'FAILURE' ||
      build.status === 'INTERNAL_ERROR' ||
      build.status === 'TIMEOUT'
        ? 1
        : 0;
    const succeeded = failed ? 0 : 1;
    const key = JSON.stringify(
      Object.entries(build.substitutions ?? {}).sort()
    );
    const counts = countsMap.get(key);
    if (counts) {
      counts.failureCount += failed;
      counts.successCount += succeeded;
    } else if (secondsElapsedSinceCreateTime > twentyFourHours) {
      // A build that happened more than 24 hours ago is not one we should
      // retry.
    } else {
      countsMap.set(key, {
        build,
        failureCount: failed,
        successCount: succeeded,
      });
    }
  }
  return [...countsMap.values()]
    .filter(
      counts =>
        counts.failureCount > 0 &&
        counts.successCount === 0 &&
        counts.failureCount < maxTries
    )
    .map(counts => counts.build);
}
