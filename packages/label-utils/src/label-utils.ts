// Copyright 2021 Google LLC
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

import {createHash} from 'crypto';
import {logger} from 'gcf-utils';
import {DatastoreLock} from '@google-automations/datastore-lock';
/* eslint-disable-next-line node/no-extraneous-import */
import {Octokit} from '@octokit/rest';

// We don't allow users to specify colors.
export interface Label {
  name: string;
  description: string;
}

// Internal interface.
interface LabelWithColor extends Label {
  color: string;
}

// This way, we'll have always the same color for the same label.
export function getLabelColor(name: string): string {
  return createHash('md5').update(name).digest('hex').slice(0, 6);
}

export async function syncLabels(
  octokit: Octokit,
  owner: string,
  repo: string,
  labels: Array<Label>
): Promise<void> {
  const l = new DatastoreLock('label-sync', `${owner}/${repo}`);
  const lockResult = await l.acquire();
  if (!lockResult) {
    logger.error(`Failed to acquire the lock for ${owner}/${repo}`);
    return;
  }
  try {
    return syncLabelsImpl(octokit, owner, repo, labels);
  } finally {
    await l.release();
  }
}

async function syncLabelsImpl(
  octokit: Octokit,
  owner: string,
  repo: string,
  labels: Array<Label>
): Promise<void> {
  const newLabels: Array<LabelWithColor> = [];
  for (const l of labels) {
    newLabels.push({
      name: l.name.toLowerCase(),
      description: l.description,
      color: getLabelColor(l.name.toLowerCase()),
    });
  }
  const oldLabels = await octokit.paginate(octokit.issues.listLabelsForRepo, {
    owner,
    repo,
    per_page: 100,
  });
  for (const l of newLabels) {
    const match = oldLabels.find(x => x.name.toLowerCase() === l.name);
    if (match) {
      if (match.color !== l.color || match.description !== l.description) {
        logger.info(
          `Updating ${match.name} from #${match.color} to #${l.color} and ` +
            `'${match.description}' to '${l.description}'.`
        );
        await octokit.issues
          .updateLabel({
            owner: owner,
            repo: repo,
            name: l.name,
            current_name: l.name,
            description: l.description,
            color: l.color,
          })
          .catch(e => {
            e.message =
              `Error updating label ${l.name} in ${owner}/${repo}` +
              `\n\n${e.message}`;
            logger.error(e);
          });
      }
    } else {
      logger.info(`Creating label '${l.name}'.`);
      await octokit.issues
        .createLabel({
          owner: owner,
          repo: repo,
          name: l.name,
          current_name: l.name,
          description: l.description,
          color: l.color,
        })
        .catch(e => {
          // ignores conflicts
          if (
            !Array.isArray(e.errors) ||
            e.errors[0].code !== 'already_exists'
          ) {
            e.message =
              `Error creating label ${l.name} in ${owner}/${repo}` +
              `\n\n${e.message}`;
            logger.error(e);
          }
        });
    }
  }
  return;
}
