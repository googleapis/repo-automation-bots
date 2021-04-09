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
import {RepoConfig} from '../../types';
import {readFileSync} from 'fs';

interface Args {
  file: string;
  'github-token': string;
  repo: string;
}

export const localSync: yargs.CommandModule<{}, Args> = {
  command: 'local-sync',
  describe: 'sync repository settings from a local configuration file',
  builder(yargs) {
    return yargs
      .option('file', {
        describe: 'path to configuration file',
        type: 'string',
        demand: true,
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
        describe: 'target repository in the form of owner/repo',
        type: 'string',
        demand: true,
      });
  },
  async handler(argv) {
    const octokit = new Octokit({
      auth: argv['github-token'],
    });

    const content = readFileSync(argv.file).toString('utf-8');
    const config = yaml.load(content) as RepoConfig;

    const runner = new SyncRepoSettings(octokit, logger);
    await runner.syncRepoSettings({
      repo: argv.repo,
      config,
    });
  },
};
