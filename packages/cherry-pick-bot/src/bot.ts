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
// eslint-disable-next-line node/no-extraneous-import
import {RequestError} from '@octokit/request-error';
import {logger} from 'gcf-utils';
import {getConfig} from '@google-automations/bot-config-utils';
import {parseCherryPickComment, cherryPickAsPullRequest} from './cherry-pick';
import {branchRequiresReviews} from './branch-protection';

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

    if (remoteConfig.enabled === false) {
      logger.debug(`ignoring explicitly disabled repository ${owner}/${repo}`);
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

    let pullRequest: {sha: string | null; number: number; baseRef: string};
    try {
      const {data: pullData} = await context.octokit.pulls.get(
        context.repo({
          pull_number: context.payload.issue.number,
        })
      );
      pullRequest = {
        sha: pullData.merge_commit_sha,
        number: pullData.number,
        baseRef: pullData.base.ref,
      };
    } catch (e) {
      if (e instanceof RequestError && e.status === 404) {
        logger.warn('requested cherry-pick on issue instead of pull request');
        return;
      }
      throw e;
    }

    if (!pullRequest.sha) {
      logger.warn(
        `pull request ${pullRequest.number} is not merged, skipping.`
      );
      return;
    }

    const baseBranch = pullRequest.baseRef;
    // If target branch requires review, ensure that the merged PR's branch also
    // required review
    if (
      await branchRequiresReviews(context.octokit, owner, repo, targetBranch)
    ) {
      logger.info(
        `${targetBranch} branch requires review, checking ${baseBranch}`
      );
      if (
        !(await branchRequiresReviews(context.octokit, owner, repo, baseBranch))
      ) {
        logger.warn(`${baseBranch} does not require review, skipping.`);
        return;
      }
    }

    await cherryPickAsPullRequest(
      context.octokit,
      owner,
      repo,
      [pullRequest.sha],
      targetBranch
    );
  });

  app.on('pull_request.closed', async context => {
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

    if (remoteConfig.enabled === false) {
      logger.debug(`ignoring explicitly disabled repository ${owner}/${repo}`);
      return;
    }

    if (!context.payload.pull_request.merge_commit_sha) {
      logger.warn(
        `pull request ${context.payload.pull_request.number} is not merged, skipping.`
      );
      return;
    }

    const {data: comments} = await context.octokit.issues.listComments({
      owner,
      repo,
      issue_number: context.payload.pull_request.number,
    });

    // Collect cherry-pick comment target branches
    const targetBranches = new Set<string>();
    for (const comment of comments) {
      const targetBranch = parseCherryPickComment(comment.body || '');
      if (!targetBranch) {
        logger.debug('comment did not match cherry-pick comment');
        return;
      }

      logger.info(
        `${comment.user?.login} requested cherry-pick to branch ${targetBranch}`
      );
      if (!ALLOWED_COMMENTER_ASSOCIATIONS.has(comment.author_association)) {
        logger.debug(
          `comment author (${comment.author_association}) is not authorized to cherry-pick`
        );
        continue;
      }

      targetBranches.add(targetBranch);
    }

    // Open cherry-pick commit PRs for each target
    for (const targetBranch of targetBranches.values()) {
      // If target branch requires review, ensure that the merged PR's branch also
      // required review
      if (
        await branchRequiresReviews(context.octokit, owner, repo, targetBranch)
      ) {
        const baseBranch = context.payload.pull_request.base.ref;
        logger.info(
          `${targetBranch} branch requires review, checking ${baseBranch}`
        );
        if (
          !(await branchRequiresReviews(
            context.octokit,
            owner,
            repo,
            baseBranch
          ))
        ) {
          logger.warn(`${baseBranch} does not require review, skipping.`);
          continue;
        }
      }

      await cherryPickAsPullRequest(
        context.octokit,
        owner,
        repo,
        [context.payload.pull_request.merge_commit_sha],
        targetBranch
      );
    }
  });
};
