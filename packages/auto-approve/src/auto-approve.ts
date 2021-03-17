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
import {Probot, Context, ProbotOctokit} from 'probot';
import {logger} from 'gcf-utils';
import {ValidPr, checkPRAgainstConfig} from './check-pr';
import {getChangedFiles, getBlobFromPRFiles} from './get-PR-info';
import {validateYaml, validateSchema, checkCodeOwners} from './check-config.js';

interface Configuration {
  rules: ValidPr[];
}
const CONFIGURATION_FILE_PATH = 'auto-approve.yml';

/**
 * Takes in the auto-approve.yml file and (if it exists) the CODEOWNERS file
 * and checks both files to ensure they match schema, format, and appropriate CODEOWNERS
 *
 * @param owner owner of the repo of the incoming PR
 * @param repo string, the name of the repo of the incoming PR
 * @param codeOwnersFile string, the CODEOWNERS file in .github/CODEOWNERS for the repo of the incoming PR
 * @param octokit the octokit instance
 * @param headSha the sha upon which to check whether the config and the CODEOWNERS file are configured correctly
 * @returns true if the status check passed, false otherwise
 */
export async function logicForConfigCheck(
  owner: string,
  repo: string,
  config: string,
  codeOwnersFile: string | undefined,
  octokit: InstanceType<typeof ProbotOctokit>,
  headSha: string
): Promise<Boolean> {
  // Check if the YAML is formatted correctly
  const isYamlValid = validateYaml(config);

  // Check if config has correct schema
  const isSchemaValid = await validateSchema(config);

  // Check if codeowners includes @github-automation for auto-approve.yml file
  const isCodeOwnersCorrect = await checkCodeOwners(
    octokit,
    owner,
    repo,
    codeOwnersFile
  );

  // If all files are correct, then submit a passing check for the config
  if (
    isYamlValid === true &&
    isSchemaValid === true &&
    isCodeOwnersCorrect === true
  ) {
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
      `${
        typeof isCodeOwnersCorrect === 'string' ? isCodeOwnersCorrect : ''
      }\n` +
      `${typeof isYamlValid === 'string' ? isYamlValid : ''}\n` +
      `${
        typeof isSchemaValid === 'object'
          ? JSON.stringify(isSchemaValid, null, 2)
          : ''
      }`;

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
    ['pull_request.opened', 'pull_request.reopened', 'pull_request.edited'],
    async (context: Context) => {
      const pr = context.payload;
      const owner = pr.pull_request.head.repo.owner.login;
      const repo = pr.pull_request.head.repo.name;
      const prNumber = pr.number;
      let config: Configuration | null;

      // Get auto-approve.yml file if it exists
      // Reading the config requires access to code permissions, which are not
      // always available for private repositories.
      try {
        config = await context.config<Configuration>(CONFIGURATION_FILE_PATH);
      } catch (err) {
        err.message = `Error reading configuration: ${err.message}`;
        logger.error(err);
        config = null;
      }

      const PRFiles = await getChangedFiles(
        context.octokit,
        owner,
        repo,
        prNumber
      );

      // If there's no config, check to see if the PR is creating the auto-approve.yml file
      if (!config) {
        const prConfig = await getBlobFromPRFiles(
          context.octokit,
          owner,
          repo,
          PRFiles,
          `.github/${CONFIGURATION_FILE_PATH}`
        );

        if (prConfig) {
          // Attempt to get the CODEOWNERS file if it exists
          const codeOwnersFile = await getBlobFromPRFiles(
            context.octokit,
            owner,
            repo,
            PRFiles,
            '.github/CODEOWNERS'
          );

          // Decide whether to add a passing or failing status checks
          await logicForConfigCheck(
            owner,
            repo,
            prConfig,
            codeOwnersFile,
            context.octokit,
            context.payload.pull_request.head.sha
          );
        } else {
          // If config isn't in the PR or the repo, ignore the PR
          logger.info(
            `Neither repo nor PR contains an auto-approve.yml file, skipping for ${owner}/${repo}/${prNumber}`
          );
        }
      } else {
        // If there is a config, first confirm that it matches the guidelines
        // Then, check to see whether the incoming PR matches the config

        // If config is not valid, this function will submit a failing check, and will not merge the PR
        const isConfigValid = await logicForConfigCheck(
          owner,
          repo,
          config.toString(),
          undefined,
          context.octokit,
          context.payload.pull_request.head.sha
        );

        // Check to see whether the incoming PR matches the incoming PR
        const isPRValid = await checkPRAgainstConfig(
          config,
          context.payload,
          context.octokit
        );

        // If both PR and config are valid, pull in approving-mechanism to tag and approve PR
        if (isPRValid && isConfigValid) {
          await context.octokit.pulls.submitReview({
            owner,
            repo,
            pull_number: prNumber,
            review_id: prNumber,
            event: 'APPROVE',
          });
          await context.octokit.issues.addLabels({
            owner,
            repo,
            issue_number: prNumber,
            labels: ['automerge: exact'],
          });
          logger.info(`Auto-approved and tagged ${owner}/${repo}/${prNumber}`);
        } else if (isConfigValid && !isPRValid) {
          // If config is valid but PR isn't, log that it is not valid, but don't comment on PR since that would be noisy
          logger.info(
            `PR does not match criteria for auto-approving, not merging for ${owner}/${repo}/${prNumber}`
          );
        }
      }
    }
  );
}
