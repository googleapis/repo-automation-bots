#!/usr/bin/env node

// Copyright 2022 Google LLC
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

import {cherryPickAsPullRequest} from './cherry-pick';

interface Args {
  commit: string;
  branch: string;
  'github-token': string;
  repo: string;
}

const sync: yargs.CommandModule<{}, Args> = {
  command: '$0',
  describe: 'open a pull request against branch with a cherry-pick commits',
  builder(yargs) {
    return yargs
      .option('commit', {
        describe: 'SHA of commit to cherry-pick',
        type: 'string',
        demand: true,
      })
      .option('branch', {
        describe: 'target branch to open a PR against',
        type: 'string',
        demand: true,
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
    const pullRequest = await cherryPickAsPullRequest(
      octokit,
      owner,
      repo,
      [argv['commit']],
      argv['branch']
    );
    logger.info(
      `opened pull request ${pullRequest.number} - ${pullRequest.html_url}`
    );
  },
};

export function parser(): yargs.Argv {
  return yargs.command(sync).showHelpOnFail(false).strictCommands();
}

// Only run the command if we're running this file directly
if (require.main === module) {
  parser().parse(process.argv);
}
