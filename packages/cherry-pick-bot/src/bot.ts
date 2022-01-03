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

// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
import {logger} from 'gcf-utils';
import {getConfig} from '@google-automations/bot-config-utils';
import {parseCherryPickComment, cherryPickCommit} from './cherry-pick';

const CONFIGURATION_FILE_PATH = 'cherry-pick-bot.yml';

// See https://docs.github.com/en/graphql/reference/enums#commentauthorassociation
const ALLOWED_COMMENTER_ASSOCIATIONS = new Set([
  'COLLABORATOR', // Author has been invited to collaborate on the repository.
  'OWNER', // Author is the owner of the repository.
  'MEMBER', // Author is a member of the organization that owns the repository.
]);

interface Configuration {
  enabled?: boolean;
}

export = (app: Probot) => {
  app.on(['issue_comment.created', 'issue_comment.edited'], async context => {
    const {owner, repo} = context.repo();
    const remoteConfig = await getConfig<Configuration>(
      context.octokit,
      owner,
      repo,
      CONFIGURATION_FILE_PATH
    );
    if (!remoteConfig) {
      logger.debug(`cherry-pick-bot not configured for ${owner}/${repo}`);
      return;
    }

    if (
      !ALLOWED_COMMENTER_ASSOCIATIONS.has(
        context.payload.comment.author_association
      )
    ) {
      logger.debug(
        `comment author (${context.payload.comment.author_association}) is not authorized to cherry-pick`
      );
      return;
    }

    const targetBranch = parseCherryPickComment(context.payload.comment.body);
    if (!targetBranch) {
      logger.debug('comment did not match cherry-pick comment');
      return;
    }

    logger.info(
      `${context.payload.comment.user.login} requested cherry-pick to branch ${targetBranch}`
    );
    const pullRequest = (
      await context.octokit.pulls.get(
        context.repo({
          pull_number: context.payload.issue.number,
        })
      )
    ).data;

    if (!pullRequest.merge_commit_sha) {
      logger.warn(
        `pull request ${pullRequest.number} is not merged, skipping.`
      );
      return;
    }

    await cherryPickCommit(
      context.octokit,
      owner,
      repo,
      pullRequest.merge_commit_sha,
      targetBranch
    );
  });
};
