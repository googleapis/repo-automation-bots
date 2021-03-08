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
import {logger} from 'gcf-utils';

interface ConfigurationOptions {
  trustedContributors?: string[];
}

const WELL_KNOWN_CONFIGURATION_FILE = 'trusted-contribution.yml';
const DEFAULT_TRUSTED_CONTRIBUTORS = [
  'renovate-bot',
  'dependabot[bot]',
  'release-please[bot]',
  'gcf-merge-on-green[bot]',
  'yoshi-code-bot',
  'gcf-owl-bot[bot]',
];

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
      const PR_AUTHOR = context.payload.pull_request.user.login;
      let remoteConfiguration: ConfigurationOptions | null;
      try {
        remoteConfiguration = await context.config<ConfigurationOptions>(
          WELL_KNOWN_CONFIGURATION_FILE
        );
      } catch (err) {
        err.message = `Error reading configuration: ${err.message}`;
        logger.error(err);
      }
      remoteConfiguration = remoteConfiguration! || {};
      // TODO: add additional verification that only dependency version changes occurred.
      if (isTrustedContribution(remoteConfiguration, PR_AUTHOR)) {
        const issuesAddLabelsParams = context.repo({
          issue_number: context.payload.pull_request.number,
          labels: ['kokoro:force-run'],
        });
        await context.octokit.issues.addLabels(issuesAddLabelsParams);
      }
    }
  );
};
