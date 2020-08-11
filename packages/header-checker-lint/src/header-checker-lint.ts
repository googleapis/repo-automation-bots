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
import {Application, Octokit} from 'probot';
import {detectLicenseHeader} from './header-parser';
import * as minimatch from 'minimatch';
<<<<<<< HEAD
import {logger} from 'gcf-utils';
=======
import {LicenseType} from './types';
>>>>>>> 3aa27f7 (feat: build headers to suggest)

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | undefined;

interface ConfigurationOptions {
  allowedCopyrightHolders: string[];
  allowedLicenses: LicenseType[];
  ignoreFiles: string[];
  sourceFileExtensions: string[];
  suggestChanges: boolean;
}

const WELL_KNOWN_CONFIGURATION_FILE = 'header-checker-lint.yml';
const DEFAULT_CONFIGURATION: ConfigurationOptions = {
  allowedCopyrightHolders: ['Google LLC'],
  allowedLicenses: ['Apache-2.0', 'MIT', 'BSD-3'],
  ignoreFiles: [],
  sourceFileExtensions: ['ts', 'js', 'java'],
  suggestChanges: false,
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

  allowedLicense(license: LicenseType | undefined): boolean {
    if (!license) {
      return false;
    }
    return this.options.allowedLicenses.includes(license);
  }

  allowedCopyrightHolder(copyrightHolder: string): boolean {
    return this.options.allowedCopyrightHolders.includes(copyrightHolder);
  }
}

export = (app: Application) => {
  app.on('pull_request', async context => {
    let remoteConfiguration = DEFAULT_CONFIGURATION;
    try {
      const candidateConfiguration = await context.config<ConfigurationOptions>(
        WELL_KNOWN_CONFIGURATION_FILE
      );
      if (candidateConfiguration) {
        remoteConfiguration = candidateConfiguration;
      }
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

    // TODO: handle pagination
    let filesResponse: Octokit.Response<Octokit.PullsListFilesResponse>;
    try {
      filesResponse = await context.github.pulls.listFiles(listFilesParams);
    } catch (err) {
      logger.error(err);
      return;
    }
    const files: Octokit.PullsListFilesResponseItem[] = filesResponse.data;

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

      const blob = await context.github.git.getBlob(
        context.repo({
          file_sha: file.sha,
        })
      );

      const fileContents = Buffer.from(blob.data.content, 'base64').toString(
        'utf8'
      );

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
        if (!configuration.allowedCopyrightHolder(detectedLicense.copyright)) {
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

    const checkParams: Octokit.ChecksCreateParams = context.repo({
      name: 'header-check',
      conclusion: 'success' as Conclusion,
      head_sha: pullRequestCommitSha,
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
    await context.github.checks.create(checkParams);
  });
};
