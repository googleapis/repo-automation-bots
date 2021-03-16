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

import meow from 'meow';
import {Octokit} from '@octokit/rest';
import {exportToBigQuery} from './export';
import {getPolicy, GitHubRepo} from './policy';

interface Flags {
  repo?: string;
  search?: string;
  export?: boolean;
}

const cli = meow(
  `
	Usage
	  $ policy

	Options
    --repo        Filter by a given repository
    --search      Provide a GitHub repository search filter to limit the repositories used
    --export      Export the results to BigQuery.

	Examples
    $ policy [--repo][--search QUERY]

`,
  {
    flags: {
      repo: {type: 'string'},
      search: {type: 'string'},
    },
  }
);

export async function main(cli: meow.Result<{}>) {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const flags = cli.flags as Flags;
  if (!token) {
    throw new Error(
      'The GITHUB_TOKEN or GH_TOKEN env var must be set with a personal access token'
    );
  }
  const repos: GitHubRepo[] = [];
  const octokit = new Octokit({
    auth: token,
  });
  const policy = getPolicy(octokit, console);
  if (flags.repo) {
    const repo = await policy.getRepo(flags.repo);
    repos.push(repo);
  } else if (flags.search) {
    const r = await policy.getRepos(flags.search);
    repos.push(...r);
  } else {
    cli.showHelp();
    return;
  }
  for (const repo of repos) {
    const res = await policy.checkRepoPolicy(repo);
    console.log(res);
    if (flags.export) {
      await exportToBigQuery(res);
    }
  }
}

if (module === require.main) {
  main(cli);
}
