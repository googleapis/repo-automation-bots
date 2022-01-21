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
 * Context:
 *   We ran the post processor for a PR that updated .Owlbot.lock.yaml
 *   and it failed.
 *
 * Strategy:
 *   Retry twice more.
 *   If the two retries fail too, then open a pull request with the changes
 *   to .Owlbot.lock.yaml without trying to run the post processor.
 *   The post processor will automatically run on the pull request and
 *   the repository owner will see the error.
 *
 * @param triggerId the build trigger id for updating lock branches.
 * @param forceTriggerId the build trigger id for force-updating lock branches.
 * @param maxTries The maximum number of times to try.
 */
export async function scanAndRetryFailedLockUpdates(
  projectId: string,
  triggerId: string,
  forceTriggerId: string | undefined,
  maxTries: number,
  logger = console
): Promise<void> {
  const cb = core.getCloudBuildInstance();
  const builds = cb.listBuildsAsync({projectId, pageSize: 100});
  const rebuilds = await filterBuildsToRetry(
    triggerId,
    forceTriggerId,
    maxTries,
    builds,
    logger
  );
  // Retry builds that failed once or twice.
  logger.info(`${rebuilds.retries.length} to rebuild`);
  for (const build of rebuilds.retries) {
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
  // Open pull requests for builds that failed 3 times.
  for (const build of rebuilds.forceRetries) {
    logger.info(`Triggering force build for ${build.name}`);
    logger.debug(build);
    await cb.runBuildTrigger({
      projectId: build.projectId,
      triggerId: forceTriggerId,
      source: {
        projectId: build.source?.repoSource?.projectId,
        branchName: build.source?.repoSource?.branchName,
        substitutions: build.substitutions,
      },
    });
  }
}

/** Return value from filterBuildsToRetry() */
export interface Rebuilds {
  retries: google.devtools.cloudbuild.v1.IBuild[];
  forceRetries: google.devtools.cloudbuild.v1.IBuild[];
}

/**
 * Scans all the cloud builds for the past 24 hours looking for failures for
 * the given build trigger.  Returns a list of builds that should be retried
 * because they never succeeded.
 *
 * @param triggerId the build trigger id for updating lock branches.
 * @param forceTriggerId the build trigger id for force-updating lock branches.
 * @param maxTries try building each trigger at most this many times
 */
export async function filterBuildsToRetry(
  triggerId: string,
  forceTriggerId: string | undefined,
  maxTries: number,
  builds: AsyncIterable<google.devtools.cloudbuild.v1.IBuild>,
  logger = console
): Promise<Rebuilds> {
  // An original build and its retry build will share the same substitution
  // values.  So group them by substition values.
  // Map each failure to the number of times it failed.
  const keyFrom = (triggerId: string, substitutions: Record<string, string>) =>
    JSON.stringify([triggerId, ...Object.entries(substitutions).sort()]);
  const countsMap: Map<
    string,
    {
      index: number;
      build: google.devtools.cloudbuild.v1.IBuild;
      successCount: number;
      failureCount: number;
    }
  > = new Map();
  let newestCreateTime: google.protobuf.ITimestamp | null = null;
  const triggerIds = [triggerId, forceTriggerId].filter(Boolean);
  let nextIndex = 0;
  // Collect the number of failures and successes for each build.
  for await (const build of builds) {
    const index = nextIndex;
    nextIndex += 1;
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
    if (!triggerIds.includes(build.buildTriggerId ?? '')) {
      continue; // Not a lock update build.
    }
    // Record the success or failure in the map.
    const failureCount =
      build.status === 'FAILURE' ||
      build.status === 'INTERNAL_ERROR' ||
      build.status === 'TIMEOUT'
        ? 1
        : 0;
    const successCount = failureCount ? 0 : 1;
    const key = keyFrom(build.buildTriggerId ?? '', build.substitutions ?? {});
    const counts = countsMap.get(key);
    if (counts) {
      counts.failureCount += failureCount;
      counts.successCount += successCount;
    } else if (secondsElapsedSinceCreateTime > twentyFourHours) {
      // A build that happened more than 24 hours ago is not one we should
      // retry.
    } else {
      countsMap.set(key, {index, build, failureCount, successCount});
    }
  }
  // Compile the result.
  const rebuilds: Rebuilds = {forceRetries: [], retries: []};
  const countsList = [...countsMap.values()].sort(
    (a, b) => cmp(a.index, b.index) // Sort so order is deterministic.
  );
  for (const counts of countsList) {
    if (counts.failureCount > 0 && counts.successCount === 0) {
      if (counts.failureCount < maxTries) {
        // We haven't yet exhausted regular retries, so retry it.
        rebuilds.retries.push(counts.build);
      } else if (
        forceTriggerId &&
        !countsMap.has(
          keyFrom(forceTriggerId, counts.build.substitutions ?? {})
        )
      ) {
        // All the regular retries failed.  Force one.
        rebuilds.forceRetries.push(counts.build);
      }
    }
  }
  return rebuilds;
}

// I can't believe this function isn't somewhere in the standard library.
function cmp(a: number, b: number) {
  if (a < b) {
    return -1;
  } else {
    return b < a ? 1 : 0;
  }
}
