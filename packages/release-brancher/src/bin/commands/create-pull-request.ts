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
import {Runner} from '../../release-brancher';

interface Args {
  'branch-name': string;
  'target-tag': string;
  'release-type'?: string;
  'github-token': string;
  repo: string;
}

export const createPullRequestCommand: yargs.CommandModule<{}, Args> = {
  command: 'create-pull-request',
  describe:
    'create a new release branch and send pull request to add release configuration',
  builder(yargs) {
    return yargs
      .option('branch-name', {
        describe: 'name of new branch to create',
        type: 'string',
        demand: true,
      })
      .option('target-tag', {
        describe: 'target tag',
        type: 'string',
        demand: true,
      })
      .option('release-type', {
        describe: 'release-please releaseType',
        type: 'string',
      })
      .option('github-token', {
        describe: 'GitHub access token',
        type: 'string',
        coerce: arg => {
          return arg || process.env.GITHUB_TOKEN;
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
    const runner = new Runner({
      releaseType: argv['release-type'],
      upstreamRepo: repo,
      upstreamOwner: owner,
      branchName: argv['branch-name'],
      targetTag: argv['target-tag'],
      gitHubToken: argv['github-token'],
    });
    await runner.createBranch();
    await runner.createPullRequest();
  },
};
