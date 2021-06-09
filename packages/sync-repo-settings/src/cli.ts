#!/usr/bin/env node

// Copyright 2021 Google LLC
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

import yargs = require('yargs');
import {logger} from 'gcf-utils';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {getConfig} from '@google-automations/bot-config-utils';
import * as yaml from 'js-yaml';
import {readFileSync} from 'fs';

import {RepoConfig} from './types';
import {SyncRepoSettings} from './sync-repo-settings';
import {CONFIG_FILE_NAME} from './config';
import schema from './schema.json';

interface Args {
  file?: string;
  branch?: string;
  'github-token': string;
  repo: string;
}

const sync: yargs.CommandModule<{}, Args> = {
  command: '$0',
  describe: 'sync repository settings from a remote configuration',
  builder(yargs) {
    return yargs
      .option('file', {
        describe: 'path to configuration file',
        type: 'string',
      })
      .option('branch', {
        describe: 'branch to fetch sync-repo-settings.yaml from',
        type: 'string',
      })
      .option('github-token', {
        describe:
          'GitHub access token. Can also be set via the `GITHUB_TOKEN` environment variable.',
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
    const [owner, repo] = argv.repo.split('/');
    const octokit = new Octokit({
      auth: argv['github-token'],
    });

    let config: RepoConfig | null;
    if (argv.file) {
      // load from local file
      const content = readFileSync(argv.file).toString('utf-8');
      config = yaml.load(content) as RepoConfig;
    } else {
      // load from repo
      config = await getConfig<RepoConfig>(
        octokit,
        owner,
        repo,
        CONFIG_FILE_NAME,
        {fallbackToOrgConfig: false, schema: schema}
      );
    }

    await new SyncRepoSettings(octokit, logger).syncRepoSettings({
      repo: argv.repo,
      config: config || undefined,
    });
  },
};

export function parser(): yargs.Argv {
  return yargs.command(sync).showHelpOnFail(false).strictCommands();
}

// Only run the command if we're running this file directly
if (require.main === module) {
  parser().parse(process.argv);
}
