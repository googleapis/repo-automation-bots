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
import {
  ChecksCreateParams,
  PullsListFilesResponse,
  PullsListFilesResponseItem,
  Response,
} from '@octokit/rest';

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | undefined;

type LicenseType = 'Apache-2.0' | 'MIT' | undefined;

interface LicenseHeader {
  copyright?: string;
  type?: LicenseType;
  year?: number;
}

const SOURCE_FILE_TYPES = ['ts', 'js', 'java'];

function isSourceFile(file: string): boolean {
  const extension = file.substring(file.lastIndexOf('.') + 1);
  return SOURCE_FILE_TYPES.includes(extension);
}

const COPYRIGHT_REGEX = new RegExp('Copyright (\\d{4}) (.*)$');
const ALLOWED_COPYRIGHT_HOLDERS = ['Google LLC'];
const APACHE2_REGEX = new RegExp(
  'Licensed under the Apache License, Version 2.0'
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

    let lintError = false;
    const failureMessages: string[] = [];

    // If we found any new files, verify they all have a valid header
    for (let i = 0; files[i] !== undefined; i++) {
      const file = files[i];

      if (!isSourceFile(file.filename)) {
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

      if (!detectedLicense.type) {
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

      if (!ALLOWED_COPYRIGHT_HOLDERS.includes(detectedLicense.copyright)) {
        lintError = true;
        failureMessages.push(
          `\`${file.filename}\` has an invalid copyright holder: \`${detectedLicense.copyright}\``
        );
      }

      if (file.status === 'added') {
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
