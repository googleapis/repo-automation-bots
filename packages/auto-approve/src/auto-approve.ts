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

// This file handles the logic to manage incoming pull-requests

// eslint-disable-next-line node/no-extraneous-import
import {Probot, Context} from 'probot';
import {
  GCFLogger,
  getAuthenticatedOctokit,
  getContextLogger,
  logger as defaultLogger,
} from 'gcf-utils';
import {checkPRAgainstConfig} from './check-pr';
import {checkPRAgainstConfigV2} from './check-pr-v2';
import {
  getChangedFiles,
  getBlobFromPRFiles,
  getReviewsCompleted,
  cleanReviews,
} from './get-pr-info';
import {checkAutoApproveConfig, isConfigV2} from './check-config.js';
import {v1 as SecretManagerV1} from '@google-cloud/secret-manager';
import {Octokit} from '@octokit/rest';
import {PullRequestEvent} from '@octokit/webhooks-types/schema';
import {
  AutoApproveNotConfigured,
  Configuration,
  ConfigurationV2,
} from './interfaces';

const APPROVER = 'yoshi-approver';

const CONFIGURATION_FILE_PATH = 'auto-approve.yml';

export async function authenticateWithSecret(
  projectId: String,
  secretName: String
): Promise<Octokit> {
  const secretsClient = new SecretManagerV1.SecretManagerServiceClient({
    fallback: 'rest',
  });
  const name = `projects/${projectId}/secrets/${secretName}/versions/latest`;
  const [version] = await secretsClient.accessSecretVersion({
    name,
  });

  const payload = version?.payload?.data?.toString() || '';
  if (payload === '') {
    throw new Error('did not retrieve a payload from SecretManager.');
  }

  return new Octokit({auth: payload});
}

/**
 * Grabs an etag for a PR, and retries adding a label if etag is different
 *
 * @param numAttemptsRemaining the amount of retries for adding a label
 * @param owner string, of the repo of the incoming PR
 * @param repo string, the name of the repo of the incoming PR
 * @param prNumber number, the number of the PR
 * @param octokit the octokit instance
 */
export async function retryAddLabel(
  numAttemptsRemaining: number,
  owner: string,
  repo: string,
  prNumber: number,
  octokit: Octokit,
  logger: GCFLogger = defaultLogger
): Promise<void> {
  const etag = (
    await octokit.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number: prNumber,
    })
  ).headers.etag;

  try {
    await octokit.issues.addLabels({
      owner,
      repo,
      issue_number: prNumber,
      labels: ['automerge: exact'],
      // The comparison with the stored ETag for if-none-match uses the
      // weak comparison algorithm, meaning two files are considered identical
      // if the content is equivalent, not identical.
      // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-None-Match
      headers: {'if-none-match': `'${etag}'`},
    });
  } catch (err) {
    if (
      (err as {message: string; status: number}).status === 412 &&
      numAttemptsRemaining > 0
    ) {
      numAttemptsRemaining--;
      await retryAddLabel(numAttemptsRemaining, owner, repo, prNumber, octokit);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } else if ((err as any).status === 412) {
      logger.error('Etag keeps changing; cannot add label successfully');
      throw err;
    } else {
      throw err;
    }
  }
}

/**
 * Takes in the auto-approve.yml file
 * and checks it matches schema, format; then,
 * submits a passing or failing status check on Github
 *
 * @param owner owner of the repo of the incoming PR
 * @param repo string, the name of the repo of the incoming PR
 * @param octokit the octokit instance
 * @param headSha the sha upon which to check whether the config is correct
 * @returns true if the status check passed, false otherwise
 */
export async function evaluateAndSubmitCheckForConfig(
  owner: string,
  repo: string,
  config: string | Configuration | ConfigurationV2 | undefined,
  octokit: Octokit,
  headSha: string
): Promise<Boolean | undefined> {
  // Check if the YAML is formatted correctly if it's in a PR
  // This will throw an error if auto-approve does not exist, causing the function to stop
  // executing, and prevent an auto-approve check from appearin

  let isAutoApproveCorrect;
  try {
    isAutoApproveCorrect = await checkAutoApproveConfig(
      octokit,
      owner,
      repo,
      config
    );
  } catch (err) {
    if ((err as AutoApproveNotConfigured).code === 'NOT_CONFIGURED') {
      // This means auto-approve is not configured on the repo. Do not
      // submit a status check, just return undefined so we do not
      // log a submitted status check
      return undefined;
    } else {
      throw err;
    }
  }

  // If all files are correct, then submit a passing check for the config
  if (isAutoApproveCorrect === '') {
    await octokit.checks.create({
      owner,
      repo,
      head_sha: headSha,
      name: 'Auto-approve.yml check',
      conclusion: 'success',
      output: {
        title: 'Auto-approve.yml check',
        summary: 'Successful auto-approve.yml config check',
        text: '',
      },
    });

    return true;
  } else {
    // If any of the files are not correct, submit a failing check
    // logging the appropriate error messages
    const errorMessage =
      'See the following errors in your auto-approve.yml config:\n' +
      `${isAutoApproveCorrect ? JSON.stringify(isAutoApproveCorrect) : ''}\n`;

    await octokit.checks.create({
      owner,
      repo,
      head_sha: headSha,
      name: 'Auto-approve.yml check',
      conclusion: 'failure',
      output: {
        title: 'Auto-approve.yml check',
        summary: 'auto-approve.yml config check failed',
        text: errorMessage,
      },
    });

    return false;
  }
}

/**
 * Main. handles incoming pull requests, ultimately either (i) creates a status check, (ii) approves a PR, (iii) logs a non-action
 */
export function handler(app: Probot) {
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.edited',
      'pull_request.synchronize',
      'pull_request_review.dismissed',
    ],
    async (
      context: Context<'pull_request' | 'pull_request_review.dismissed'>
    ) => {
      const logger = getContextLogger(context);
      const pr = context.payload;
      const owner = pr.repository.owner.login;
      const repoHead = pr.pull_request.head.repo.name;
      const repoHeadOwner = pr.pull_request.head.repo.owner.login;
      const repo = pr.pull_request.base.repo.name;
      const prNumber = pr.pull_request.number;

      // During codefreeze, simply set the RELEASE_FREEZE environment variable.
      // if a PR is from release-please, it will not be merged:
      if (
        process.env.RELEASE_FREEZE === 'true' &&
        pr.pull_request.user.login.includes('release-please')
      ) {
        logger.info(
          'releases are currently frozen, unset the environment variable RELEASE_FREEZE to re-enable.'
        );
        return;
      }
      let octokit: Octokit;
      if (context.payload.installation && context.payload.installation.id) {
        octokit = await getAuthenticatedOctokit(
          context.payload.installation.id
        );
      } else {
        throw new Error(
          `Installation ID not provided in ${context.payload.action} event.` +
            ' We cannot authenticate Octokit.'
        );
      }

      const PRFiles = await getChangedFiles(
        octokit,
        owner,
        repo,
        prNumber,
        logger
      );

      if (!PRFiles) {
        logger.info(
          `Config does not exist in PR or repo, skipping execution for ${owner}/${repo}/${prNumber}`
        );
        return;
      }
      // Check to see if the config is being modified in the PR, before we check
      // if it exists in the repo. If it's being modified, we want to submit
      // a check, and NOT auto-approve; if it isn't, then we want to check
      // the main branch, confirm that the auto-approve.yml file is correct,
      // and then check to see whether the incoming PR matches the config to
      // decide whether we can automerge
      const prConfig = await getBlobFromPRFiles(
        octokit,
        repoHeadOwner,
        repoHead,
        PRFiles,
        `.github/${CONFIGURATION_FILE_PATH}`
      );

      if (prConfig) {
        // Decide whether to add a passing or failing status checks
        // We do not need to save the return value for this function,
        // since we are not going to do anything else with the PR if
        // the PR is modifying auto-approve.yml. If we have entered this
        // code block, it means that the PR has modified the config file,
        // and we do not want to do anything other than submit a check for
        // that config.
        const wasCheckSubmitted = await evaluateAndSubmitCheckForConfig(
          owner,
          repo,
          prConfig,
          octokit,
          context.payload.pull_request.head.sha
        );

        if (wasCheckSubmitted !== undefined) {
          logger.metric('auto_approve.status_check', {
            repo: `${owner}/${repo}`,
            pr: prNumber,
          });
        }
      } else {
        let config: Configuration | ConfigurationV2 | null;
        // Get auto-approve.yml file if it exists
        // Reading the config requires access to code permissions, which are not
        // always available for private repositories.
        try {
          config = await context.config<Configuration | ConfigurationV2>(
            CONFIGURATION_FILE_PATH
          );
        } catch (e) {
          const err = e as Error;
          err.message = `Error reading configuration: ${err.message}`;
          logger.error(err);
          config = null;
        }
        // If there is a config, first confirm that it matches the guidelines
        // Then, check to see whether the incoming PR matches the config
        if (config) {
          // If config is not valid, this function will submit a failing check, and will not merge the PR
          const isConfigValid = await evaluateAndSubmitCheckForConfig(
            owner,
            repo,
            config,
            octokit,
            context.payload.pull_request.head.sha
          );

          // If config isn't valid, skip the rest of the execution;
          if (!isConfigValid) {
            return;
          }

          let isPRValid;
          // If the configuration is V2, use the second version checks
          if (isConfigV2(config)) {
            // Check to see whether the incoming PR matches the incoming PR
            isPRValid = await checkPRAgainstConfigV2(
              config,
              context.payload as PullRequestEvent,
              octokit,
              logger
            );
          } else {
            isPRValid = await checkPRAgainstConfig(
              config,
              context.payload as PullRequestEvent,
              octokit,
              logger
            );
          }

          // If both PR and config are valid, pull in approving-mechanism to tag and approve PR
          if (isPRValid === true && isConfigValid === true) {
            // The value for the secret name is currently hard-coded since we only have one account that
            // has user-based permissions. We should think about operationalizing this
            // in the future (perhaps as an env var in our publish scripts).
            const octokit = await exports.authenticateWithSecret(
              process.env.PROJECT_ID || '',
              APPROVER
            );

            const reviewsOnPr = cleanReviews(
              await getReviewsCompleted(owner, repo, prNumber, octokit)
            );

            const isPRApproved = reviewsOnPr.find(
              x => x.user.login === APPROVER && x.state === 'APPROVED'
            );

            if (!isPRApproved) {
              await octokit.pulls.createReview({
                owner,
                repo,
                pull_number: prNumber,
                event: 'APPROVE',
              });

              logger.metric('auto_approve.approved_tagged', {
                repo: `${owner}/${repo}`,
                pr: prNumber,
                prAuthor: pr.pull_request.user.login,
              });
              logger.info(
                `Auto-approved and tagged ${owner}/${repo}/${prNumber}`
              );
            }

            // Currently, the python-docs-samples team do not want to automerge
            // the PRs. I'm hardcoding their exception since this hasn't otherwise
            // been a feature request, and they are expecting to want to merge in the
            // future.
            if (
              !(
                owner === 'GoogleCloudPlatform' &&
                repo === 'python-docs-samples'
              )
            ) {
              await retryAddLabel(3, owner, repo, prNumber, octokit);
            }
          } else if (isConfigValid && !isPRValid) {
            // If config is valid but PR isn't, log that it is not valid, but don't comment on PR since that would be noisy
            logger.info(
              `PR does not match criteria for auto-approving, not merging for ${owner}/${repo}/${prNumber}`
            );
          }
        } else {
          logger.info(
            `Config does not exist in PR or repo, skipping execution for ${owner}/${repo}/${prNumber}`
          );
        }
      }
    }
  );
}
