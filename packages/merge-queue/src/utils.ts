// Copyright 2022 Google LLC
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

import crypto from 'crypto';

/* eslint-disable-next-line node/no-extraneous-import */
import {Octokit} from '@octokit/rest';
/* eslint-disable-next-line node/no-extraneous-import */
import {RequestError} from '@octokit/types';
import {Datastore, Key} from '@google-cloud/datastore';
import {addOrUpdateIssueComment, GCFBootstrapper, GCFLogger} from 'gcf-utils';

import {ADDED_LABEL, REMOVED_LABEL} from './labels';

import {CallbackCorePayload, CallbackPayload, Queue} from './types';

export const MERGE_QUEUE_CALLBACK = 'merge-queue-callback';

export function createQueueKey(
  datastore: Datastore,
  repoFullName: string
): Key {
  const hash = crypto.createHash('sha1');
  hash.update(repoFullName);
  return datastore.key(['MergeQueue:Queue', hash.digest('hex')]);
}

function buildRepositoryDetails(repoFullName: string) {
  const [orgName, repoName] = repoFullName.split('/');
  return {
    repository: {
      name: repoName,
      full_name: repoFullName,
      owner: {
        login: orgName,
        name: orgName,
      },
    },
    organization: {
      login: orgName,
    },
  };
}

export function createTaskBody(
  body: CallbackCorePayload,
  installationId: number,
  repoFullName: string
): CallbackPayload {
  return {
    ...body,
    ...buildRepositoryDetails(repoFullName),
    installation: {id: installationId},
  };
}

export async function addPRToQueue(
  datastore: Datastore,
  repoFullName: string,
  prNumber: number,
  logger: GCFLogger
): Promise<Queue> {
  const queueKey = createQueueKey(datastore, repoFullName);
  let queueEntity: Queue;

  const transaction = datastore.transaction();
  try {
    await transaction.run();
    queueEntity = (await transaction.get(queueKey))[0];
    if (queueEntity === undefined) {
      queueEntity = {
        repoFullName: repoFullName,
        pullRequests: [],
      };
    }
    if (!queueEntity.pullRequests.includes(prNumber)) {
      queueEntity.pullRequests.push(prNumber);
      transaction.save({
        key: queueKey,
        data: queueEntity,
      });
    }
    await transaction.commit();
  } catch (e) {
    const err = e as Error;
    logger.error(`Failed to fetch data from datastore: ${err.message}`);
    await transaction.rollback();
    throw err;
  }
  return queueEntity;
}

export async function changeLabel(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  from: string,
  to: string
) {
  try {
    await octokit.issues.removeLabel({
      owner: owner,
      repo: repo,
      issue_number: issueNumber,
      name: from,
    });
  } catch (e) {
    const err = e as RequestError;
    // Ignoring 404 errors.
    if (err.status !== 404) {
      throw err;
    }
  }
  await octokit.issues.addLabels({
    owner: owner,
    repo: repo,
    issue_number: issueNumber,
    labels: [to],
  });
}

export async function getQueue(
  datastore: Datastore,
  repoFullName: string
): Promise<Queue | undefined> {
  const key = createQueueKey(datastore, repoFullName);
  return (await datastore.get(key))[0];
}

export async function removePRFromQueue(
  datastore: Datastore,
  repoFullName: string,
  prNumber: number,
  logger: GCFLogger
) {
  let q: Queue;
  const queueKey = createQueueKey(datastore, repoFullName);
  const transaction = datastore.transaction();
  try {
    await transaction.run();
    q = (await transaction.get(queueKey))[0];
    const pos = q.pullRequests.indexOf(prNumber);
    if (pos !== -1) {
      q.pullRequests.splice(pos, 1);
    }
    transaction.save({
      key: queueKey,
      data: q,
    });
    await transaction.commit();
  } catch (e) {
    const err = e as Error;
    logger.error(`Failed to update data in datastore: ${err.message}`);
    await transaction.rollback();
    throw err;
  }
}

export async function updatePRForRemoval(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  installationId: number,
  reason: string
) {
  // Change the label
  await changeLabel(octokit, owner, repo, prNumber, ADDED_LABEL, REMOVED_LABEL);
  await addOrUpdateIssueComment(
    octokit,
    owner,
    repo,
    prNumber,
    installationId,
    reason
  );
}

// return a random number between -5 to 5
function jitter(): number {
  return Math.floor(Math.random() * 11) - 5;
}

export async function enqueueTask(
  bootstrap: GCFBootstrapper,
  repoFullName: string,
  installationId: number,
  prNumber: number,
  logger: GCFLogger,
  mergeEffortStartedAt: string | undefined = undefined
) {
  const core: CallbackCorePayload = {
    task_type: MERGE_QUEUE_CALLBACK,
    pr_number: prNumber,
  };
  if (mergeEffortStartedAt) {
    core.merge_effort_started_at = mergeEffortStartedAt;
  }
  const body = createTaskBody(core, installationId, repoFullName);
  try {
    await bootstrap.enqueueTask(
      {id: '', body: JSON.stringify(body), name: 'schedule.repository'},
      logger,
      /* delayInSeconds */ 60 + jitter()
    );
  } catch (e) {
    const err = e as Error;
    logger.error(`failed to enqueue a task: ${err.message}`);
    throw err;
  }
}
