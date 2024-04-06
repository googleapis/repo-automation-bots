// Copyright 2019 Google LLC
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

// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {getAuthenticatedOctokit, getContextLogger} from 'gcf-utils';
import {ConfigChecker, getConfig} from '@google-automations/bot-config-utils';
import {
  Annotation,
  ConfigurationOptions,
  WELL_KNOWN_CONFIGURATION_FILE,
} from './config';
import schema from './config-schema.json';
import {
  getAuthenticatedOctokit as getOctokitFromSecretName,
  SECRET_NAME_FOR_COMMENT_PERMISSION,
} from './utils';
import {isContributor, buildComment} from './comments';
import {addOrUpdateIssueComment} from '@google-automations/issue-utils';

const DEFAULT_TRUSTED_CONTRIBUTORS = [
  'renovate-bot',
  'dependabot[bot]',
  'release-please[bot]',
  'gcf-merge-on-green[bot]',
  'yoshi-code-bot',
  'gcf-owl-bot[bot]',
  'google-cloud-policy-bot[bot]',
];
const DEFAULT_LABELS = ['kokoro:force-run'];
const KOKORO_RUN_LABELS = [...DEFAULT_LABELS, 'kokoro:run'];
const OWLBOT_LABEL = 'owlbot:run';
const OWLBOT_CONFIG_PATH = '.github/.OwlBot.lock.yaml';

function isTrustedContribution(
  config: ConfigurationOptions,
  author: string
): boolean {
  const trustedContributors =
    config.trustedContributors || DEFAULT_TRUSTED_CONTRIBUTORS;
  return trustedContributors.includes(author);
}

export = (app: Probot) => {
  // Track estimate of how often a kokoro:run or kokoro:force-run label is being added manually:
  app.on(['pull_request.labeled'], async context => {
    const logger = getContextLogger(context);
    const hasKokoroLabel = context.payload.pull_request.labels.some(label => {
      return KOKORO_RUN_LABELS.includes(label.name);
    });
    if (
      !(
        context.payload.pull_request.head.repo &&
        context.payload.pull_request.base.repo
      )
    ) {
      logger.info('head or base null', context.payload.pull_request.url);
      return;
    }
    const head = context.payload.pull_request.head.repo.full_name;
    const base = context.payload.pull_request.base.repo.full_name;

    // If a label is added for external contributions, this is to be expected
    // and not an issue with kokoro:
    if (hasKokoroLabel && head === base) {
      logger.metric('trusted_contribution.run_label_added', {
        login: context.payload.sender.login,
        pull_request_url: context.payload.pull_request.url,
      });
    }
  });

  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.synchronize',
    ],
    async context => {
      let octokit: Octokit;
      const installationId = context.payload.installation?.id;
      if (installationId) {
        octokit = await getAuthenticatedOctokit(installationId);
      } else {
        throw new Error(
          'Installation ID not provided in pull_request event.' +
            ' We cannot authenticate Octokit.'
        );
      }
      const logger = getContextLogger(context);
      const {owner, repo} = context.repo();
      const configChecker = new ConfigChecker<ConfigurationOptions>(
        schema,
        WELL_KNOWN_CONFIGURATION_FILE
      );
      await configChecker.validateConfigChanges(
        octokit,
        owner,
        repo,
        context.payload.pull_request.head.sha,
        context.payload.pull_request.number
      );

      const prAuthor = context.payload.pull_request.user.login;
      const prNumber = context.payload.pull_request.number;
      let remoteConfiguration: ConfigurationOptions | null;
      // Since we added a capability of opting out, we quit upon
      // errors when fetching the config.
      try {
        remoteConfiguration = await getConfig<ConfigurationOptions>(
          octokit,
          owner,
          repo,
          WELL_KNOWN_CONFIGURATION_FILE,
          {schema: schema}
        );
      } catch (e) {
        const err = e as Error;
        err.message = `Error reading configuration: ${err.message}`;
        logger.error(err);
        return;
      }
      remoteConfiguration = remoteConfiguration || {};

      // quit if disabled.
      if (remoteConfiguration.disabled) {
        return;
      }

      if (isTrustedContribution(remoteConfiguration, prAuthor)) {
        // Synchronize event is interesting, because it can suggest that someone manually
        // clicked the synchronize button, or had to push at an existing branch:
        if (
          context.payload.action === 'synchronize' &&
          context.payload.pull_request.head.repo &&
          context.payload.pull_request.base.repo
        ) {
          logger.metric('trusted_contribution.synchronize', {
            login: context.payload.sender.login,
            pull_request_url: context.payload.pull_request.url,
          });
        }

        // Only adds owlbot:run if repository appears to be configured for OwlBot:
        let hasOwlBotConfig = false;
        try {
          await octokit.rest.repos.getContent({
            owner,
            repo,
            path: OWLBOT_CONFIG_PATH,
          });
          hasOwlBotConfig = true;
        } catch (_err) {
          const err = _err as {code: number};
          if (err.code !== 404) {
            throw err;
          }
        }
        const defaultAnnotations: Array<Annotation> = [
          {type: 'label', text: [...DEFAULT_LABELS]},
        ];
        if (
          hasOwlBotConfig &&
          !defaultAnnotations[0].text.includes(OWLBOT_LABEL)
        ) {
          (defaultAnnotations[0].text as Array<string>).push(OWLBOT_LABEL);
        }

        const annotations =
          remoteConfiguration.annotations || defaultAnnotations;
        let octokitForComment: Octokit | null = null;
        for (const annotation of annotations) {
          if (annotation.type === 'label') {
            const issuesAddLabelsParams = context.repo({
              issue_number: prNumber,
              labels: Array.isArray(annotation.text)
                ? annotation.text
                : [annotation.text],
            });
            await octokit.issues.addLabels(issuesAddLabelsParams);
            logger.metric('trusted_contribution.labeled', {
              url: context.payload.pull_request.url,
            });
          } else if (annotation.type === 'comment') {
            // Use personal access token from the secret manager.
            if (octokitForComment === null) {
              octokitForComment = await getOctokitFromSecretName(
                process.env.PROJECT_ID || '',
                SECRET_NAME_FOR_COMMENT_PERMISSION
              );
            }
            await octokitForComment.issues.createComment({
              issue_number: prNumber,
              body: String(annotation.text),
              owner: context.repo().owner,
              repo: context.repo().repo,
            });
          }
        }
      } else if (
        remoteConfiguration.commentInstructions &&
        !isContributor(context.payload.pull_request.author_association)
      ) {
        // Comment on the issue that the maintainers may need to comment with /gcbrun or add a label
        const comment = buildComment(remoteConfiguration);
        if (comment) {
          await addOrUpdateIssueComment(
            octokit,
            owner,
            repo,
            prNumber,
            installationId,
            comment
          );
        }
      }
    }
  );
};
