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
import {Octokit} from '@octokit/rest';
import {SyncRepoSettings} from './sync-repo-settings';
import * as yaml from 'js-yaml';
import {RepoConfig} from './types';
import {readFileSync} from 'fs';

interface Args {
  file?: string;
  branch?: string;
  "github-token": string;
  repo: string;
}

async function getFileContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string | undefined,
  path: string
): Promise<string> {
  const args = branch
    ? {
        owner,
        repo,
        path,
        ref: branch,
      }
    : {
        owner,
        repo,
        path,
      };
  const response = (await octokit.repos.getContent(args)).data as {
    content: string;
  };
  return Buffer.from(response.content, 'base64').toString('utf8');
}

const remoteSync: yargs.CommandModule<{}, Args> = {
  command: 'remote-sync',
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
    const [owner, repo] = argv.repo.split('/');
    const octokit = new Octokit({
      auth: argv['github-token'],
    });

    let config: RepoConfig;
    if (argv.file) {
      // load from local file
      const content = readFileSync(argv.file).toString('utf-8');
      config = yaml.load(content) as RepoConfig;
    } else {
      // load from repo
      const content = await getFileContent(
        octokit,
        owner,
        repo,
        argv.branch,
        '.github/sync-repo-settings.yaml'
      );
      config = yaml.load(content) as RepoConfig;
    }

    const runner = new SyncRepoSettings(octokit, logger);
    await runner.syncRepoSettings({
      repo: argv.repo,
      config,
    });
  },
};

yargs(process.argv.slice(2)).command(remoteSync).strictCommands().parse();
