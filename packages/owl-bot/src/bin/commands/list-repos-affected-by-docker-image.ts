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

// Run like this:
// node ./build/src/bin/owl-bot.js list-repos --docker-image foo

// import {
//   listReposAffectedByDockerImages,
// } from '../../core';
import yargs = require('yargs');

interface Args {
  'docker-image': string;
  'table-project-id': string;
  'table-name': string;
}

export const listReposCommand: yargs.CommandModule<{}, Args> = {
  command: 'list-repos',
  describe:
    'List repos that need to be regenerated because they use the specified docker image as their post processor.',
  builder(yargs) {
    return yargs
      .option('docker-image', {
        describe:
          'The full path of the docker image that changed.  ex: gcr.io/repo-automation-bots/nodejs-post-processor',
        type: 'string',
        demand: true,
      })
      .option('table-project-id', {
        describe: 'The GCP project containing the table of yaml files.',
        type: 'string',
        default: 'repo-automation-bots-metrics',
      })
      .option('table-name', {
        describe: 'Name of the yaml files table',
        type: 'string',
        default: 'owl-bot-yamls',
      });
  },
  async handler(argv) {
    // TODO: handle the things.
  },
};
