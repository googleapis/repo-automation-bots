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
import {Validate} from '../../validate';

interface Args {
  'pem-path': string;
  'app-id': number;
  installation: number;
}

export const validApiShortNames: yargs.CommandModule<{}, Args> = {
  command: 'valid-api-short-names',
  describe:
    'return list of valid API short-names based on service_xyz.yml files in file listing',
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
    const octokit = await octokitFrom(argv);
    const validate = new Validate(octokit);
    const validApiShortNames = await validate.validApiShortNames();
    console.info(JSON.stringify(Array.from(validApiShortNames), null, 2));
  },
};
