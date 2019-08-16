/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Application } from 'probot';
import { GitHubAPI } from 'probot/lib/github';
import {
  ChecksCreateParams,
  PullsListFilesResponse,
  PullsListFilesResponseItem,
  Response,
} from '@octokit/rest';
import * as minimatch from 'minimatch';

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | undefined;

type LicenseType = 'Apache-2.0' | 'MIT' | 'BSD-3' | undefined;

interface LicenseHeader {
  copyright?: string;
  type?: LicenseType;
  year?: number;
}

interface ConfigurationOptions {
  allowedCopyrightHolders: string[];
  allowedLicenses: LicenseType[];
  ignoreFiles: string[];
  sourceFileExtensions: string[];
}

const WELL_KNOWN_CONFIGURATION_FILE = '.bots/header-checker-lint.json';
const DEFAULT_CONFIGURATION: ConfigurationOptions = {
  allowedCopyrightHolders: ['Google LLC'],
  allowedLicenses: ['Apache-2.0', 'MIT'],
  ignoreFiles: [],
  sourceFileExtensions: ['ts', 'js', 'java'],
};

class Configuration {
  private options: ConfigurationOptions;
  private minimatches: minimatch.IMinimatch[];

  constructor(options: ConfigurationOptions) {
    this.options = options;
    this.minimatches = options.ignoreFiles.map((pattern) => {
      return new minimatch.Minimatch(pattern);
    });
  }

  static async fromGitHub(
    path: string,
    owner: string,
    repo: string,
    ref: string,
    github: GitHubAPI
  ): Promise<Configuration> {
    try {
      const response = await github.repos.getContents({
        owner,
        repo,
        ref,
        path,
      });
      const fileContents = Buffer.from(
        response.data.content,
        'base64'
      ).toString('utf8');
      return new Configuration({
        ...DEFAULT_CONFIGURATION,
        ...JSON.parse(fileContents),
      });
    } catch (_) {
      return new Configuration(DEFAULT_CONFIGURATION);
    }
  }

  isSourceFile(file: string): boolean {
    const extension = file.substring(file.lastIndexOf('.') + 1);
    return this.options.sourceFileExtensions.includes(extension);
  }

  ignoredFile(filename: string): boolean {
    return this.minimatches.some((mm) => {
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

const COPYRIGHT_REGEX = new RegExp('Copyright (\\d{4}) (.*)$');
const APACHE2_REGEX = new RegExp(
  'Licensed under the Apache License, Version 2.0'
);
const BSD3_REGEX = new RegExp(
  'Redistribution and use in source and binary forms, with or without'
);
const MIT_REGEX = new RegExp('Permission is hereby granted, free of charge,');

// super naive - iterate over lines and use regex
// TODO: look for the header in comments only
function detectLicenseHeader(contents: string): LicenseHeader {
  const license: LicenseHeader = {};
  contents.split('\n').forEach(line => {
    const match = line.match(COPYRIGHT_REGEX);
    if (match) {
      license.year = Number(match[1]);
      license.copyright = match[2];
    }

    if (line.match(APACHE2_REGEX)) {
      license.type = 'Apache-2.0';
    } else if (line.match(MIT_REGEX)) {
      license.type = 'MIT';
    } else if (line.match(BSD3_REGEX)) {
      license.type = 'BSD-3';
    }
  });
  return license;
}

export = (app: Application) => {
  app.on('pull_request', async context => {
    // List pull request files for the given PR
    // https://developer.github.com/v3/pulls/#list-pull-requests-files
    const listFilesParams = context.repo({
      pull_number: context.payload.pull_request.number,
      per_page: 100,
    });
    const pullRequestCommitSha = context.payload.pull_request.head.sha;

    // TODO: handle pagination
    let filesResponse: Response<PullsListFilesResponse>;
    try {
      filesResponse = await context.github.pulls.listFiles(listFilesParams);
    } catch (err) {
      app.log.error('---------------------');
      app.log.error(err);
      return;
    }
    const files: PullsListFilesResponseItem[] = filesResponse.data;
    const configuration = await Configuration.fromGitHub(
      WELL_KNOWN_CONFIGURATION_FILE,
      context.payload.pull_request.head.repo.owner.login,
      context.payload.pull_request.head.repo.name,
      context.payload.pull_request.head.ref,
      context.github
    );

    let lintError = false;
    const failureMessages: string[] = [];

    // If we found any new files, verify they all have a valid header
    for (let i = 0; files[i] !== undefined; i++) {
      const file = files[i];

      if (configuration.ignoredFile(file.filename)) {
        app.log.info('ignoring file from configuration: ' + file.filename);
        continue;
      }

      if (!configuration.isSourceFile(file.filename)) {
        app.log.info('ignoring non-source file: ' + file.filename);
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

    const checkParams: ChecksCreateParams = context.repo({
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
