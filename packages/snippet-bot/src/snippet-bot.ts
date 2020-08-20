// Copyright 2020 Google LLC
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

/* eslint-disable node/no-extraneous-import */

import {Application, Octokit} from 'probot';
import {parseRegionTags} from './region-tag-parser';
import {logger} from 'gcf-utils';
import * as minimatch from 'minimatch';

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | undefined;

interface ConfigurationOptions {
  ignoreFiles: string[];
}

const DEFAULT_CONFIGURATION: ConfigurationOptions = {
  ignoreFiles: [],
};

const CONFIGURATION_FILE_PATH = 'snippet-bot.yml';

class Configuration {
  private options: ConfigurationOptions;
  private minimatches: minimatch.IMinimatch[];

  constructor(options: ConfigurationOptions) {
    this.options = options;
    this.minimatches = options.ignoreFiles.map(pattern => {
      return new minimatch.Minimatch(pattern);
    });
  }

  ignoredFile(filename: string): boolean {
    return this.minimatches.some(mm => {
      return mm.match(filename);
    });
  }
}

export = (app: Application) => {
  app.on('pull_request', async context => {
    const repoUrl = context.payload.repository.full_name;
    let configOptions!: ConfigurationOptions | null;
    try {
      configOptions = await context.config<ConfigurationOptions>(
        CONFIGURATION_FILE_PATH
      );
    } catch (err) {
      err.message = `Error reading configuration: ${err.message}`;
      logger.error(err);
      // Now this bot is only enabled if it finds the configuration file.
      // Exiting.
      return;
    }

    if (configOptions === null) {
      logger.info(`snippet-bot is not configured for ${repoUrl}.`);
      return;
    }
    const configuration = new Configuration({
      ...DEFAULT_CONFIGURATION,
      ...configOptions,
    });
    logger.info({config: configuration});

    // List pull request files for the given PR
    // https://developer.github.com/v3/pulls/#list-pull-requests-files
    const listFilesParams = context.repo({
      pull_number: context.payload.pull_request.number,
      per_page: 100,
    });
    const pullRequestCommitSha = context.payload.pull_request.head.sha;
    logger.info({sha: pullRequestCommitSha});
    // TODO: handle pagination
    let filesResponse: Octokit.Response<Octokit.PullsListFilesResponse>;
    try {
      filesResponse = await context.github.pulls.listFiles(listFilesParams);
    } catch (err) {
      logger.error('---------------------');
      logger.error(err);
      return;
    }
    const files: Octokit.PullsListFilesResponseItem[] = filesResponse.data;

    let mismatchedTags = false;
    let tagsFound = false;
    const failureMessages: string[] = [];

    // If we found any new files, verify they all have matching region tags.
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

      const blob = await context.github.git.getBlob(
        context.repo({
          file_sha: file.sha,
        })
      );

      const fileContents = Buffer.from(blob.data.content, 'base64').toString(
        'utf8'
      );

      logger.info({fileContents: fileContents});
      const parseResult = parseRegionTags(fileContents, file.filename);
      if (!parseResult.result) {
        mismatchedTags = true;
        failureMessages.push(parseResult.messages.join('\n'));
      }
      if (parseResult.tagsFound) {
        tagsFound = true;
      }
    }

    const checkParams: Octokit.ChecksCreateParams = context.repo({
      name: 'Mismatched region tag',
      conclusion: 'success' as Conclusion,
      head_sha: pullRequestCommitSha,
    });

    if (mismatchedTags) {
      checkParams.conclusion = 'failure';
      checkParams.output = {
        title: 'Mismatched region tag detected.',
        summary: 'Some new files have mismatched region tag',
        text: failureMessages.join('\n'),
      };
    }

    // post the status of commit linting to the PR, using:
    // https://developer.github.com/v3/checks/
    if (tagsFound) {
      await context.github.checks.create(checkParams);
    }
  });
};
