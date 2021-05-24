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

import yargs = require('yargs');
import {
  getServerlessSchedulerProxyUrl,
  parseCronEntries,
  createOrUpdateCron,
} from './cron-utils';

interface Args {
  'scheduler-service-account': string;
  'function-region': string;
  'function-name': string;
  region: string;
  project: string;
}
const deployCommand: yargs.CommandModule<{}, Args> = {
  command: 'deploy',
  describe: 'Deploy cron(s) to Cloud Scheduler',
  builder(yargs) {
    return yargs
      .option('scheduler-service-account', {
        describe: 'service account identifier for scheduler service',
        type: 'string',
        demand: true,
      })
      .option('function-region', {
        describe: 'region of target function',
        type: 'string',
        demand: true,
      })
      .option('region', {
        describe: 'region of target function',
        type: 'string',
        demand: true,
      })
      .option('function-name', {
        describe: 'name of the function',
        type: 'string',
        demand: true,
      })
      .option('project', {
        describe: 'project to deploy to',
        type: 'string',
        default: 'repo-automation-bots',
      });
  },
  async handler(argv) {
    const proxyUrl = await getServerlessSchedulerProxyUrl(
      argv['project'],
      argv['region']
    );
    if (!proxyUrl) {
      console.log('error fetching scheduler proxy url');
      return;
    }
    const cronEntries = parseCronEntries('./cron.yaml');
    console.log(cronEntries);
    await Promise.all(
      cronEntries.map(cronEntry => {
        return createOrUpdateCron(
          cronEntry,
          argv['project'],
          argv['region'],
          argv['function-region'],
          argv['function-name'],
          proxyUrl,
          argv['scheduler-service-account']
        );
      })
    );
  },
};

export function parser(): yargs.Argv {
  return yargs.command(deployCommand).showHelpOnFail(false).strictCommands();
}

// Only run the command if we're running this file directly
if (require.main === module) {
  parser().parse(process.argv.slice(2));
}
