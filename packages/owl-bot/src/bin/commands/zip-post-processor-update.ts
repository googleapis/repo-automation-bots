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

// Invoked by update-branch.yaml to zip the results of running the
// post processor in cloud storage.
//

import {cwd} from 'process';
import yargs = require('yargs');
import {commitAndZipPostProcessorUpdate} from '../../commit-post-processor-update';

interface Args {
  path: string;
}

export const zipPostProcessorUpdateCommand: yargs.CommandModule<{}, Args> = {
  command: 'zip-post-processor-update',
  describe:
    'Runs either `git commit -m "Updates from OwlBot"` or ' +
    '`git commit --amend --no-edit`\n' +
    'in the current directory depending on the squash flag in .OwlBot.yaml.\n\n' +
    'Then, zips the result.',
  builder(yargs) {
    return yargs.option('path', {
      describe: 'Where to put the zip file',
      type: 'string',
      demand: true,
    });
  },
  async handler(argv) {
    await commitAndZipPostProcessorUpdate(cwd(), argv.path);
  },
};
