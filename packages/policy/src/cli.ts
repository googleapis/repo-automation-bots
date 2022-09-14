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

import * as yargs from 'yargs';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {exportToBigQuery} from './export';
import {getPolicy, GitHubRepo} from './policy';
import {getChanger} from './changer';
import {openIssue} from './issue';

interface Flags {
  repo?: string;
  search?: string;
  export?: boolean;
  autofix?: boolean;
  report?: boolean;
}

const defaultCommand: yargs.CommandModule<{}, Flags> = {
  command: '$0',
  describe: 'Run policy bot against a repository',
  builder(yargs) {
    return yargs
      .option('repo', {
        describe: 'Filter by a given repository',
        type: 'string',
        conflicts: ['search'],
      })
      .option('search', {
        describe:
          'Provide a GitHub repository search filter to limit the repositories used',
        type: 'string',
        conflicts: ['repo'],
      })
      .option('export', {
        describe: 'Export the results to BigQuery.',
        type: 'boolean',
      })
      .option('autofix', {
        describe: 'Where possible, submit a PR to fix any issues',
        type: 'boolean',
      })
      .option('report', {
        describe: 'Create or update a GitHub Issue documenting the gaps',
        type: 'boolean',
      });
  },
  async handler(argv) {
    const auth = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (!auth) {
      throw new Error(
        'The GITHUB_TOKEN or GH_TOKEN env var must be set with a personal access token'
      );
    }

    const octokit = new Octokit({auth});
    const policy = getPolicy(octokit, console);
    const repos: GitHubRepo[] = [];
    if (argv.repo) {
      const repo = await policy.getRepo(argv.repo);
      repos.push(repo);
    } else if (argv.search) {
      const r = await policy.getRepos(argv.search);
      repos.push(...r);
    } else {
      throw new Error('Need to provide either --repo or --search option');
    }
    for (const repo of repos) {
      const res = await policy.checkRepoPolicy(repo);
      console.log(res);
      if (argv.export) {
        await exportToBigQuery(res);
      }
      if (argv.autofix) {
        const changer = getChanger(octokit, repo);
        await changer.submitFixes(res);
      }
      if (argv.report) {
        await openIssue(octokit, res);
      }
    }
  },
};

export const parser = yargs
  .command(defaultCommand)
  .strict(true)
  .scriptName('policy');

if (module === require.main) {
  (async () => {
    await parser.parseAsync();
    process.on('unhandledRejection', console.error);
    process.on('uncaughtException', console.error);
  })();
}
