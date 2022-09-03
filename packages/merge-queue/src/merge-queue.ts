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

/* eslint-disable-next-line node/no-extraneous-import */
import {Probot} from 'probot';
/* eslint-disable-next-line node/no-extraneous-import */
import {Octokit} from '@octokit/rest';
import {
  addOrUpdateIssueComment,
  getContextLogger,
  getAuthenticatedOctokit,
  GCFBootstrapper,
} from 'gcf-utils';
import {Datastore} from '@google-cloud/datastore';
import {syncLabels} from '@google-automations/label-utils';

import {CallbackPayload, Queue} from './types';

import {
  addPRToQueue,
  changeLabel,
  enqueueTask,
  getQueue,
  removePRFromQueue,
  updatePRForRemoval,
  MERGE_QUEUE_CALLBACK,
} from './utils';

import {ADD_LABEL, ADDED_LABEL, MERGE_QUEUE_LABELS} from './labels';

// Solely for avoid using `any` type.
interface Label {
  name: string;
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
      const installationId = context.payload.installation?.id;
      const repoFullName = context.payload.repository.full_name;
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const prNumber = context.payload.pull_request.number;

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

      await addPRToQueue(datastore, repoFullName, prNumber, logger);

      // Change the label
      await changeLabel(octokit, owner, repo, prNumber, ADD_LABEL, ADDED_LABEL);

      // Then enqueue another task.
      await enqueueTask(
        bootstrap,
        repoFullName,
        installationId,
        prNumber,
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
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      if (context.payload.syncLabels === true) {
        await syncLabels(octokit, owner, repo, MERGE_QUEUE_LABELS);
        return;
      }
      if (context.payload.task_type === MERGE_QUEUE_CALLBACK) {
        const payload = context.payload as CallbackPayload;
        const repoFullName = payload.repository.full_name;
        const prNumber = payload.pr_number;
        let mergeEffortStartedAt = payload.merge_effort_started_at;

        logger.info(
          `task received for owner: ${owner}, repo: ${repo}, prNumber: ${prNumber}`
        );

        const q: Queue | undefined = await getQueue(datastore, repoFullName);
        if (q === undefined) {
          throw new Error(
            `Failed to get queueEntity for ${repoFullName}, prNumber: ${prNumber}`
          );
        }

        if (q.pullRequests.length === 0) {
          return;
        }

        if (!q.pullRequests.includes(prNumber)) {
          logger.info(
            `${repoFullName}, prNumber: ${prNumber} is not in the queue.`
          );
          return;
        }

        if (q.pullRequests[0] !== prNumber) {
          // This pull request is not at the top of the queue.
          const currentPosition = q.pullRequests.indexOf(prNumber);
          await addOrUpdateIssueComment(
            octokit,
            owner,
            repo,
            prNumber,
            installationId,
            `This pr is at ${currentPosition + 1} / ` +
            `${q.pullRequests.length} in the queue.`
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
          await removePRFromQueue(datastore, repoFullName, prNumber, logger);
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
          await removePRFromQueue(datastore, repoFullName, prNumber, logger);
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

        // If the branch is behind, we need to update the branch.
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
          await removePRFromQueue(datastore, repoFullName, prNumber, logger);
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
