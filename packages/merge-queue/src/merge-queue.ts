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
import {Probot} from 'probot';
/* eslint-disable-next-line node/no-extraneous-import */
import {Octokit} from '@octokit/rest';
/* eslint-disable-next-line node/no-extraneous-import */
import {RequestError} from '@octokit/types';
import {
  addOrUpdateIssueComment,
  getContextLogger,
  getAuthenticatedOctokit,
  GCFBootstrapper,
  GCFLogger,
} from 'gcf-utils';
import {Datastore, Key} from '@google-cloud/datastore';
import {DatastoreLock} from '@google-automations/datastore-lock';
import {syncLabels} from '@google-automations/label-utils';

import {
  ADD_LABEL,
  ADDED_LABEL,
  REMOVED_LABEL,
  MERGE_QUEUE_LABELS,
} from './labels';

const MERGE_QUEUE_CALLBACK = 'merge-queue-callback';

export interface CallbackCorePayload {
  task_type: string;
  pr_number: number;
  merge_effort_started_at?: string;
}

export interface CallbackPayload extends CallbackCorePayload {
  repository: {
    name: string;
    full_name: string;
    owner: {
      login: string;
      name: string;
    };
  };
  organization: {
    login: string;
  };
  installation: {
    id: number;
  };
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

function createTaskBody(
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

// Solely for avoid using `any` type.
interface Label {
  name: string;
}

export interface Queue {
  repoFullName: string; // e.g. "googleapis/repo-automation-bots"
  pullRequests: number[];
}

function createQueueKey(datastore: Datastore, repoFullName: string): Key {
  const hash = crypto.createHash('sha1');
  hash.update(repoFullName);
  return datastore.key(['MergeQueue:Queue', hash.digest('hex')]);
}

// return a random number between -5 to 5
function jitter(): number {
  return Math.floor(Math.random() * 11) - 5;
}

/**
 * Determine how many hours old an issue is
 * @param date Date to compare
 */
function hoursOld(date: string): number {
  return (Date.now() - new Date(date).getTime()) / 1000 / 60 / 60;
}

export function createAppFn(bootstrap: GCFBootstrapper) {
  const datastore = new Datastore();
  return (app: Probot) => {
    app.on(['pull_request.labeled'], async context => {
      let octokit: Octokit;
      if (context.payload.installation?.id) {
        octokit = await getAuthenticatedOctokit(
          context.payload.installation.id
        );
      } else {
        throw new Error(
          'Installation ID not provided in pull_request.labeled event.' +
            ' We cannot authenticate Octokit.'
        );
      }
      const logger = getContextLogger(context);
      const repoFullName = context.payload.repository.full_name;

      // Only proceeds if ADD_LABEL is added.
      if (context.payload.pull_request.labels === undefined) {
        return;
      }
      // Exits when there's no ADD_LABEL
      const labelFound = context.payload.pull_request.labels.some(
        (label: Label) => {
          return label.name === ADD_LABEL;
        }
      );
      if (!labelFound) {
        return;
      }

      const lock = new DatastoreLock('merge-queue', repoFullName);
      const queueKey = createQueueKey(datastore, repoFullName);
      let queueEntity: Queue;
      try {
        await lock.acquire();
      } catch (e) {
        const err = e as Error;
        logger.error(`Failed to acquire a lock: ${err.message}`);
        throw err;
      }
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
        if (
          !queueEntity.pullRequests.includes(
            context.payload.pull_request.number
          )
        ) {
          queueEntity.pullRequests.push(context.payload.pull_request.number);
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
      } finally {
        await lock.release();
      }

      // Change the label
      try {
        await octokit.issues.removeLabel(context.issue({name: ADD_LABEL}));
      } catch (e) {
        const err = e as RequestError;
        // Ignoring 404 errors.
        if (err.status !== 404) {
          throw err;
        }
      }
      await octokit.issues.addLabels(context.issue({labels: [ADDED_LABEL]}));

      // Then enqueue another task.
      await enqueueTask(
        bootstrap,
        repoFullName,
        context.payload.installation?.id,
        context.payload.pull_request.number,
        logger
      );
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    app.on('schedule.repository' as any, async context => {
      let octokit: Octokit;
      const installationId = context.payload.installation?.id;
      if (installationId) {
        octokit = await getAuthenticatedOctokit(installationId);
      } else {
        throw new Error(
          'Installation ID not provided in schedule.repository event.' +
            ' We cannot authenticate Octokit.'
        );
      }
      const logger = getContextLogger(context);
      const owner = context.payload.organization.login;
      const repo = context.payload.repository.name;
      if (context.payload.syncLabels === true) {
        await syncLabels(octokit, owner, repo, MERGE_QUEUE_LABELS);
        return;
      }
      if (context.payload.task_type === MERGE_QUEUE_CALLBACK) {
        const payload = context.payload as CallbackPayload;
        const repoFullName = payload.repository.full_name;
        const queueKey = createQueueKey(datastore, repoFullName);
        const prNumber = payload.pr_number;
        let mergeEffortStartedAt = payload.merge_effort_started_at;

        logger.info(
          `task received for owner: ${owner}, repo: ${repo}, prNumber: ${prNumber}`
        );

        const queueEntity: Queue = (await datastore.get(queueKey))[0];
        if (queueEntity === undefined) {
          throw new Error(
            `Failed to get queueEntity for ${repoFullName}, prNumber: ${prNumber}`
          );
        }

        if (queueEntity.pullRequests.length === 0) {
          return;
        }

        if (!queueEntity.pullRequests.includes(prNumber)) {
          logger.info(
            `${repoFullName}, prNumber: ${prNumber} is not in the queue.`
          );
          return;
        }

        if (queueEntity.pullRequests[0] !== prNumber) {
          // This pull request is not at the top of the queue.
          const currentPosition = queueEntity.pullRequests.indexOf(prNumber);
          await addOrUpdateIssueComment(
            octokit,
            owner,
            repo,
            prNumber,
            installationId,
            `This pr is at ${currentPosition + 1} / ` +
              `${queueEntity.pullRequests.length} in the queue.`
          );
          // Then enqueue another task.
          await enqueueTask(
            bootstrap,
            repoFullName,
            installationId,
            prNumber,
            logger
          );
          return;
        }

        // This pull request is at the top of the queue.
        if (mergeEffortStartedAt === undefined) {
          await addOrUpdateIssueComment(
            octokit,
            owner,
            repo,
            prNumber,
            installationId,
            "This pr is at top of the queue, I'm on it."
          );
        }
        const response = await octokit.pulls.get({
          owner: owner,
          repo: repo,
          pull_number: prNumber,
        });
        const pr = response.data;
        if (mergeEffortStartedAt === undefined) {
          // preserve the time we started the effort
          mergeEffortStartedAt = pr.updated_at;
        }

        logger.info(
          `mergeable: ${pr.mergeable}, mergeable_state: ${pr.mergeable_state}, merged: ${pr.merged}  for owner: ${owner}, repo: ${repo}, prNumber: ${prNumber}`
        );

        if (pr.merged === true) {
          await removePRFromQueue(
            datastore,
            queueKey,
            repoFullName,
            prNumber,
            logger
          );
          return;
        }

        // `dirty` means there's merge conflict
        if (pr.mergeable_state.toLowerCase() === 'dirty') {
          await updatePRForRemoval(
            octokit,
            owner,
            repo,
            prNumber,
            installationId,
            'The PR seems to have merge conflicts. Removing from the queue.'
          );
          await removePRFromQueue(
            datastore,
            queueKey,
            repoFullName,
            prNumber,
            logger
          );
          return;
        }

        // If the PR is mergeable, let's merge.
        // TODO: Make the OK state configurable.
        // `unstable` means there's a failing test which is not mandatory.
        if (
          pr.mergeable &&
          (pr.mergeable_state.toLowerCase() === 'clean' ||
            pr.mergeable_state.toLowerCase() === 'unstable')
        ) {
          const mergeResult = await octokit.pulls.merge({
            owner: owner,
            repo: repo,
            pull_number: prNumber,
            commit_title: `${pr.title} (#${prNumber})`,
            commit_message: pr.body || '',
            merge_method: 'squash',
          });
          logger.info(
            `Merge result: ${mergeResult.data.merged}, repo: ${repoFullName}, prNumber: ${prNumber}`
          );
        }

        // We need to update the branch.
        if (pr.mergeable_state.toLowerCase() === 'behind') {
          const updateResult = await octokit.pulls.updateBranch({
            owner: owner,
            repo: repo,
            pull_number: prNumber,
          });
          logger.info(`Updated with the message: ${updateResult.data.message}`);
        }

        // Timeout. TODO: configurable timeout.
        if (mergeEffortStartedAt && hoursOld(mergeEffortStartedAt) > 1) {
          await updatePRForRemoval(
            octokit,
            owner,
            repo,
            prNumber,
            installationId,
            'The PR has not become mergeable after 1 hour, removing from the queue.'
          );
          await removePRFromQueue(
            datastore,
            queueKey,
            repoFullName,
            prNumber,
            logger
          );
          return;
        }

        // Then enqueue another task.
        await enqueueTask(
          bootstrap,
          repoFullName,
          installationId,
          prNumber,
          logger,
          mergeEffortStartedAt
        );
        return;
      }
    });
  };
}

async function updatePRForRemoval(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  installationId: number,
  reason: string
) {
  // Change the label
  try {
    await octokit.issues.removeLabel({
      owner: owner,
      repo: repo,
      issue_number: prNumber,
      name: ADDED_LABEL,
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
    issue_number: prNumber,
    labels: [REMOVED_LABEL],
  });
  await addOrUpdateIssueComment(
    octokit,
    owner,
    repo,
    prNumber,
    installationId,
    reason
  );
}

async function enqueueTask(
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

async function removePRFromQueue(
  datastore: Datastore,
  queueKey: Key,
  repoFullName: string,
  prNumber: number,
  logger: GCFLogger
) {
  const lock = new DatastoreLock('merge-queue', repoFullName);
  let queueEntity: Queue;
  try {
    await lock.acquire();
  } catch (e) {
    const err = e as Error;
    logger.error(`Failed to acquire a lock: ${err.message}`);
    throw err;
  }

  const transaction = datastore.transaction();
  try {
    await transaction.run();
    queueEntity = (await transaction.get(queueKey))[0];
    const pos = queueEntity.pullRequests.indexOf(prNumber);
    if (pos !== -1) {
      queueEntity.pullRequests.splice(pos, 1);
    }
    transaction.save({
      key: queueKey,
      data: queueEntity,
    });
    await transaction.commit();
  } catch (e) {
    const err = e as Error;
    logger.error(`Failed to update data in datastore: ${err.message}`);
    await transaction.rollback();
    throw err;
  } finally {
    await lock.release();
  }
}
