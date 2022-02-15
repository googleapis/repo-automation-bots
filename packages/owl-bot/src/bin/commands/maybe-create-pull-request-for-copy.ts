// Copyright 2022 Google LLC
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

// Invoked by update-copy-branch.yaml

import yargs = require('yargs');
import {octokitFactoryFrom, OctokitParams} from '../../octokit-util';
import {
  createPullRequestForCopyBranch,
  deleteCopyBranch,
  shouldCreatePullRequestForCopyBranch,
} from '../../maybe-create-pull-request-for-copy';
import * as fs from 'fs';
import {Force} from '../../create-pr';

interface Args extends OctokitParams {
  force: boolean;
  'default-branch-path': string;
}

export const maybeCreatePullRequestForCopyCommand: yargs.CommandModule<
  {},
  Args
> = {
  command: 'maybe-create-pull-request-for-copy',
  describe: `Inspects the current working directory.  Expects all changes to
     have been added with git -A.  If the current status of the staged 
     directory differs with the last ancestor in common with the main branch,
     then it creates a pull request.  Otherwise, it deletes the branch from
     github.`,
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
      .option('force', {
        describe:
          'forces owl bot to create a pull request even when there are no unstaged changes',
        type: 'boolean',
        demand: false,
        default: false,
      })
      .option('default-branch-path', {
        describe: 'path to text file containing the name of the default branch',
        type: 'string',
        demand: true,
      });
  },
  async handler(argv) {
    const factory = octokitFactoryFrom(argv);
    if (argv.force) {
      await createPullRequestForCopyBranch(factory, Force.Yes);
    } else {
      const mainBranch = fs
        .readFileSync(argv['default-branch-path'], {encoding: 'utf-8'})
        .trim();
      if (shouldCreatePullRequestForCopyBranch(mainBranch)) {
        await createPullRequestForCopyBranch(factory);
      } else {
        await deleteCopyBranch(factory);
      }
    }
  },
};
