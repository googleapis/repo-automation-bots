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
import {logger} from 'gcf-utils';
import {ConfigChecker, getConfig} from '@google-automations/bot-config-utils';
import {
  Annotation,
  ConfigurationOptions,
  WELL_KNOWN_CONFIGURATION_FILE,
} from './config';
import schema from './config-schema.json';
import {
  getAuthenticatedOctokit,
  SECRET_NAME_FOR_COMMENT_PERMISSION,
} from './utils';

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
  app.on(['pull_request'], async context => {
    app.log(
      `repo = ${context.payload.repository.name} PR = ${context.payload.pull_request.number} action = ${context.payload.action}`
    );
  });

  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.synchronize',
    ],
    async context => {
      const {owner, repo} = context.repo();
      const configChecker = new ConfigChecker<ConfigurationOptions>(
        schema,
        WELL_KNOWN_CONFIGURATION_FILE
      );
      await configChecker.validateConfigChanges(
        context.octokit,
        owner,
        repo,
        context.payload.pull_request.head.sha,
        context.payload.pull_request.number
      );

      const PR_AUTHOR = context.payload.pull_request.user.login;
      let remoteConfiguration: ConfigurationOptions | null;
      // Since we added a capability of opting out, we quit upon
      // errors when fetching the config.
      try {
        remoteConfiguration = await getConfig<ConfigurationOptions>(
          context.octokit,
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

      if (isTrustedContribution(remoteConfiguration, PR_AUTHOR)) {
        // Only adds owlbot:run if repository appears to be configured for OwlBot:
        let hasOwlBotConfig = false;
        try {
          await context.octokit.rest.repos.getContent({
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
        let octokit: Octokit | null = null;
        for (const annotation of annotations) {
          if (annotation.type === 'label') {
            const issuesAddLabelsParams = context.repo({
              issue_number: context.payload.pull_request.number,
              labels: Array.isArray(annotation.text)
                ? annotation.text
                : [annotation.text],
            });
            await context.octokit.issues.addLabels(issuesAddLabelsParams);
            logger.metric('trusted_contribution.labeled', {
              url: context.payload.pull_request.url,
            });
          } else if (annotation.type === 'comment') {
            // Use personal access token from the secret manager.
            if (octokit === null) {
              octokit = await getAuthenticatedOctokit(
                process.env.PROJECT_ID || '',
                SECRET_NAME_FOR_COMMENT_PERMISSION
              );
            }
            await octokit.issues.createComment({
              issue_number: context.payload.pull_request.number,
              body: String(annotation.text),
              owner: context.repo().owner,
              repo: context.repo().repo,
            });
          }
        }
      }
    }
  );
};
