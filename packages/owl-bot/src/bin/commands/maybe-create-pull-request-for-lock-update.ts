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

// To Run: node ./build/src/bin/owl-bot.js copy-code-and-create-pull-request <args>

import yargs = require('yargs');
import {octokitFactoryFrom, OctokitParams} from '../../octokit-util';
import {maybeCreatePullRequestForLockUpdate} from '../../update-lock';

type Args = OctokitParams;

export const maybeCreatePullRequestForLockUpdateCommand: yargs.CommandModule<
  {},
  Args
> = {
  command: 'maybe-create-pull-request-for-lock-update',
  describe: `Inspects the current working directory.  If there are unstaged changes,
     creates a pull request.`,
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
      });
  },
  async handler(argv) {
    await maybeCreatePullRequestForLockUpdate(octokitFactoryFrom(argv));
  },
};
