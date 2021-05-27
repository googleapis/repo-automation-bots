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

import {handlePullRequestLabeled} from '../../owl-bot';
import yargs = require('yargs');
import {octokitFrom} from '../../octokit-util';
import {readFileSync} from 'fs';

interface Args {
  'pem-path': string;
  'app-id': number;
  installation: number;
  org: string;
  project: string;
  'payload-path': string;
  event: string;
  trigger: string;
}

export const testWebhook: yargs.CommandModule<{}, Args> = {
  command: 'test-webhook',
  describe: 'test webhook handler with a given payload',
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
      .option('org', {
        describe: 'organization to scan for configuration files',
        type: 'string',
        demand: true,
      })
      .option('project', {
        describe: 'project with config database',
        type: 'string',
        demand: true,
      })
      .option('payload-path', {
        describe: 'path to payload to test',
        type: 'string',
        demand: true,
      })
      .option('event', {
        describe: 'event to test',
        default: 'pull_request.labeled',
        choices: ['pull_request.labeled'],
      })
      .option('trigger', {
        describe: 'cloud build trigger to run',
        default: 'ff6ace31-d5f9-41ff-a92c-459ed1755e35',
      });
  },
  async handler(argv) {
    const payload = JSON.parse(readFileSync(argv['payload-path'], 'utf8'));
    const privateKey = readFileSync(argv['pem-path'], 'utf8');
    const octokit = await octokitFrom(argv);
    switch (argv.event) {
      case 'pull_request.labeled':
        await handlePullRequestLabeled(
          argv['app-id'],
          privateKey,
          argv.project,
          argv.trigger,
          payload,
          octokit
        );
        break;
    }
  },
};
