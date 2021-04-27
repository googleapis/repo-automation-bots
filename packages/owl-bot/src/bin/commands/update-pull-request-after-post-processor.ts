// Copyright 2021 Google LLC
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

// To Run: node ./build/src/bin/owl-bot.js copy-code-and-create-pull-request <args>

import yargs = require('yargs');
import {core} from '../../core';
import {octokitFrom, OctokitParams} from '../../octokit-util';
import {githubRepoFromOwnerSlashName} from '../../github-repo';

interface Args extends OctokitParams {
  repo: string;
  pr: number;
}

export const updatePullRequestAfterPostProcessorCommand: yargs.CommandModule<
  {},
  Args
> = {
  command: 'update-pull-request-after-post-processor',
  describe:
    'Updates a pull request after the post processor ran.  May close it or promote it from DRAFT.',
  builder(yargs) {
    return yargs
      .option('pem-path', {
        describe: 'provide path to private key for requesting JWT',
        type: 'string',
        demand: true,
      })
      .option('app-id', {
        describe: 'GitHub AppID',
        type: 'number',
        demand: true,
      })
      .option('installation', {
        describe: 'installation ID for GitHub app',
        type: 'number',
        demand: true,
      })
      .option('repo', {
        describe:
          'repository for the pull request.  Example: googleapis/nodejs-speech',
        type: 'string',
        demand: true,
      })
      .option('pr', {
        describe: 'The pull request id',
        type: 'number',
        demand: true,
      });
  },
  async handler(argv) {
    const repo = githubRepoFromOwnerSlashName(argv['repo']);
    const octokit = await octokitFrom(argv);
    await core.updatePullRequestAfterPostProcessor(
      repo.owner,
      repo.repo,
      argv['pr'],
      octokit
    );
  },
};
