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

import yargs = require('yargs');
import {logger} from 'gcf-utils';
import {Octokit} from '@octokit/rest';
import {SyncRepoSettings} from '../../sync-repo-settings';
import * as yaml from 'js-yaml';

interface Args {
  branch?: string;
  'github-token': string;
  repo: string;
}

export const sync: yargs.CommandModule<{}, Args> = {
  command: 'create-pull-request',
  describe:
    'create a new release branch and send pull request to add release configuration',
  builder(yargs) {
    return yargs
      .option('branch', {
        describe: 'name of new branch to create',
        type: 'string',
      })
      .option('github-token', {
        describe: 'GitHub access token',
        type: 'string',
        coerce: arg => {
          return arg || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
        },
        demand: true,
      })
      .option('repo', {
        describe: 'target repository',
        type: 'string',
        demand: true,
      });
  },
  async handler(argv) {
    const [owner, repo] = argv.repo.split('/');
    const octokit = new Octokit({
      auth: argv["github-token"]
    });

    const response = (await octokit.repos.getContent({
      owner,
      repo,
      path: ".github/sync-repo-settings",
    })).data;
    console.log(response);
    // const config = yaml.load(response);

    const runner = new SyncRepoSettings(octokit, logger);
    // await runner.syncRepoSettings({
    //   repo: argv.repo,
    //   config,
    // });
  },
};
