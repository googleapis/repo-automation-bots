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
import {octokitFrom} from '../../utils/octokit-util';
import {scanRepoAndOpenIssues} from '../../core';

interface Args {
  'pem-path': string;
  'app-id': number;
  installation: number;
  owner: string;
  repo: string;
  branch: string;
}

export const scanRepo: yargs.CommandModule<{}, Args> = {
  command: 'scan-repo',
  describe:
    'scans a repository opening issues for corrupt .repo-metadata.json files',
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
      .option('owner', {
        describe: 'organization to lint .repo-metadata.json for',
        type: 'string',
        demand: true,
      })
      .option('repo', {
        describe: 'repo to lint .repo-metadata.json for',
        type: 'string',
        demand: true,
      })
      .option('branch', {
        describe: 'branch to scan',
        type: 'string',
        default: 'main',
      });
  },
  async handler(argv) {
    const octokit = await octokitFrom(argv);
    await scanRepoAndOpenIssues(octokit, argv.owner, argv.repo, argv.branch);
  },
};
