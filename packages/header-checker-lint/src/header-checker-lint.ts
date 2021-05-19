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
import {LicenseType, detectLicenseHeader} from './header-parser';
import {ConfigurationOptions, WELL_KNOWN_CONFIGURATION_FILE} from './config';
import * as minimatch from 'minimatch';
import {logger} from 'gcf-utils';
import {getConfig, ConfigChecker} from '@google-automations/bot-config-utils';
import schema from './config-schema.json';

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | undefined;

const DEFAULT_CONFIGURATION: ConfigurationOptions = {
  allowedCopyrightHolders: ['Google LLC'],
  allowedLicenses: ['Apache-2.0', 'MIT', 'BSD-3'],
  ignoreFiles: [],
  sourceFileExtensions: ['ts', 'js', 'java'],
};

class Configuration {
  private options: ConfigurationOptions;
  private minimatches: minimatch.IMinimatch[];

  constructor(options: ConfigurationOptions) {
    this.options = options;
    this.minimatches = options.ignoreFiles.map(pattern => {
      return new minimatch.Minimatch(pattern);
    });
  }

  isSourceFile(file: string): boolean {
    const extension = file.substring(file.lastIndexOf('.') + 1);
    return this.options.sourceFileExtensions.includes(extension);
  }

  ignoredFile(filename: string): boolean {
    return this.minimatches.some(mm => {
      return mm.match(filename);
    });
  }

  allowedLicense(license: LicenseType): boolean {
    return this.options.allowedLicenses.includes(license);
  }

  allowedCopyrightHolder(copyrightHolder: string): boolean {
    return this.options.allowedCopyrightHolders.includes(copyrightHolder);
  }
}

export = (app: Probot) => {
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.edited',
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
      let remoteConfiguration: ConfigurationOptions | null;
      try {
        remoteConfiguration = await getConfig<ConfigurationOptions>(
          context.octokit,
          owner,
          repo,
          WELL_KNOWN_CONFIGURATION_FILE
        );
      } catch (err) {
        logger.error('Error parsing configuration: ' + err);
        return;
      }
      const configuration = new Configuration({
        ...DEFAULT_CONFIGURATION,
        ...remoteConfiguration,
      });

      // List pull request files for the given PR
      // https://developer.github.com/v3/pulls/#list-pull-requests-files
      const listFilesParams = context.repo({
        pull_number: context.payload.pull_request.number,
        per_page: 100,
      });
      const pullRequestCommitSha = context.payload.pull_request.head.sha;

      try {
        const files = await context.octokit.paginate(
          context.octokit.pulls.listFiles,
          listFilesParams
        );

        let lintError = false;
        const failureMessages: string[] = [];

        // If we found any new files, verify they all have a valid header
        for (let i = 0; files[i] !== undefined; i++) {
          const file = files[i];

          if (configuration.ignoredFile(file.filename)) {
            logger.info('ignoring file from configuration: ' + file.filename);
            continue;
          }

          if (file.status === 'removed') {
            logger.info('ignoring deleted file: ' + file.filename);
            continue;
          }

          if (!configuration.isSourceFile(file.filename)) {
            logger.info('ignoring non-source file: ' + file.filename);
            continue;
          }

          const blob = await context.octokit.git.getBlob(
            context.repo({
              file_sha: file.sha,
            })
          );

          const fileContents = Buffer.from(
            blob.data.content,
            'base64'
          ).toString('utf8');

          const detectedLicense = detectLicenseHeader(fileContents);

          if (!configuration.allowedLicense(detectedLicense.type)) {
            lintError = true;
            failureMessages.push(
              `\`${file.filename}\` is missing a valid license header.`
            );
            continue;
          }

          if (!detectedLicense.copyright) {
            lintError = true;
            failureMessages.push(
              `\`${file.filename}\` is missing a valid copyright line.`
            );
            continue;
          }

          if (file.status === 'added') {
            // TODO: fix the licenses in all existing codebases so that we don't
            // get bitten by this rule in every PR.
            if (
              !configuration.allowedCopyrightHolder(detectedLicense.copyright)
            ) {
              lintError = true;
              failureMessages.push(
                `\`${file.filename}\` has an invalid copyright holder: \`${detectedLicense.copyright}\``
              );
            }

            // for new files, ensure the license year is the current year for new
            // files
            const currentYear = new Date().getFullYear();
            if (detectedLicense.year !== currentYear) {
              lintError = true;
              failureMessages.push(
                `\`${file.filename}\` should have a copyright year of ${currentYear}`
              );
            }
          }
        }

        const checkParams = context.repo({
          name: 'header-check',
          conclusion: 'success' as Conclusion,
          head_sha: pullRequestCommitSha,
          output: {
            title: 'Headercheck',
            summary: 'Header check successful',
            text: 'Header check successful',
          },
        });

        if (lintError) {
          checkParams.conclusion = 'failure';
          checkParams.output = {
            title: 'Invalid or missing license headers detected.',
            summary: 'Some new files are missing headers',
            text: failureMessages.join('\n'),
          };
        }

        // post the status of commit linting to the PR, using:
        // https://developer.github.com/v3/checks/
        await context.octokit.checks.create(checkParams);
      } catch (err) {
        logger.error(err);
        return;
      }
    }
  );
};
