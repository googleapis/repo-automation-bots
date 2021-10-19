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

// Invoked by update-branch.yaml to store the results of running the
// post processor in cloud storage.
//

import {Storage} from '@google-cloud/storage';
import {cwd} from 'process';
import yargs = require('yargs');
import {commitAndStorePostProcessorUpdate} from '../../commit-post-processor-update';

interface Args {
  bucket: string;
  path: string;
}

export const storePostProcessorUpdateCommand: yargs.CommandModule<{}, Args> = {
  command: 'store-post-processor-update',
  describe:
    'Runs either `git commit -m "Updates from OwlBot"` or ' +
    '`git commit --amend --no-edit`\n' +
    'depending on the squash flag in .OwlBot.yaml.\n\n' +
    'Then, stores the result in Google Cloud Storage.',
  builder(yargs) {
    return yargs
      .option('bucket', {
        describe:
          'The storage bucket where the results of the post processor will be stored.',
        type: 'string',
        demand: true,
      })
      .option('path', {
        describe:
          'The path into the storage bucket where the results of the post processor will be stored.',
        type: 'string',
        demand: true,
      });
  },
  async handler(argv) {
    await commitAndStorePostProcessorUpdate(
      cwd(),
      new Storage(),
      argv.bucket,
      argv.path
    );
  },
};
