#!/usr/bin/env node

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

// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import {Endpoints} from '@octokit/types';

import fs from 'fs';
import yargs from 'yargs';

import {
  loadSelectors,
  Selectors,
  ObjectSelector,
  RepoDescriptorConvertor,
} from './object-selector';

const DEFAULT_DUMP_FILE = 'repositories-dump.json';

export type Repository =
  Endpoints['GET /repos/{owner}/{repo}']['response']['data'];

export interface Args {
  [x: string]: unknown;
  file?: string;
  yamlFiles?: (string | number)[];
  'github-token'?: string;
}

export async function dumpCommand(argv: Args) {
  const octokit = new Octokit();
  const repos = new Array<Repository>();
  for (const org of ['googleapis', 'GoogleCloudPlatform']) {
    const repositoriesPaginated = octokit.paginate.iterator(
      octokit.rest.repos.listForOrg,
      {org: org}
    );
    for await (const response of repositoriesPaginated) {
      for (const repo of response.data) {
        repos.push(repo as Repository);
      }
    }
  }
  fs.writeFileSync(argv!.file as string, JSON.stringify(repos));
  console.log(`Repository dump file created at ${argv!.file}`);
}

export async function testYamlCommand(argv: Args) {
  const listOfSelectors = new Array<Selectors>();
  console.log('-'.repeat(76));
  console.log(`Using selector yaml files: ${argv!.yamlFiles}`);
  for (const yamlFile of argv!.yamlFiles!) {
    listOfSelectors.push(loadSelectors(yamlFile as string));
  }
  const repoSelector = new ObjectSelector<Repository>(
    listOfSelectors,
    RepoDescriptorConvertor
  );
  console.log(`Using dump file: ${argv!.file}`);
  const repos = JSON.parse(fs.readFileSync(argv!.file!, 'utf8'));
  const selected = repoSelector.select(repos);
  if (selected.length === 0) {
    console.log('No repositories found.');
  } else {
    console.log('The following repos are hit!');
    console.log('-'.repeat(76));
  }
  for (const repo of selected) {
    console.log(repo.full_name);
  }
  console.log('-'.repeat(76));
}

export function parser(): yargs.Argv {
  return yargs
    .command(
      'dump',
      'dump the repositories from our orgs',
      y => {
        return y
          .option('file', {
            describe: 'output repositories json file',
            type: 'string',
            alias: 'f',
            default: DEFAULT_DUMP_FILE,
          })
          .option('github-token', {
            describe:
              'GitHub access token. Can also be set via the `GITHUB_TOKEN` environment variable.',
            type: 'string',
            coerce: arg => {
              return arg || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
            },
            required: true,
          });
      },
      dumpCommand
    )
    .command(
      'test-yaml',
      'select repositories with the selectors in the given yaml files',
      y => {
        return y
          .option('file', {
            describe: 'output repositories json file',
            type: 'string',
            default: DEFAULT_DUMP_FILE,
            alias: 'f',
          })
          .option('yamlFiles', {
            describe: 'yaml file names for testing',
            type: 'array',
            alias: 'y',
            required: true,
          });
      },
      testYamlCommand
    )
    .help('h');
}

// Only run the command if we're running this file directly
if (require.main === module) {
  parser().parse(process.argv.slice(2));
}
