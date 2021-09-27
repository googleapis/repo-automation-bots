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

// Runs periodically to retry failed update-lock-branch cloud builds..

import yargs = require('yargs');
import {scanAndRetryFailedLockUpdates} from '../../scan-and-retry-failed-lock-updates';
import {serve} from '../../serve';

type Args = {
  'trigger-id': string;
  'max-tries': number;
  'project-id': string;
  port: number;
};

export const scanAndRetryFailedLockUpdatesCommand: yargs.CommandModule<
  {},
  Args
> = {
  command: 'scan-and-retry-failed-lock-updates',
  describe:
    'Scans recent cloud builds that were lock updates.  Retries failures.',
  builder(yargs) {
    return yargs
      .option('trigger-id', {
        describe: 'The cloud build trigger id for which to scan builds.',
        type: 'string',
        demand: false,
        default: '7f3c737e-9641-48c8-adae-eccb5b0d7ad5',
      })
      .option('project-id', {
        describe: 'The Google Cloud project id.',
        type: 'string',
        demand: false,
        default: 'repo-automation-bots',
      })
      .option('max-tries', {
        describe: 'The maximum to try each build.',
        type: 'number',
        demand: false,
        default: 3,
      })
      .option('port', {
        describe:
          'run a webserver listening to this port.  Requests to /rebuild ' +
          'trigger actually scanning the configs.',
        type: 'number',
        demand: false,
        default: 0,
      });
  },
  async handler(argv) {
    const invoke = () =>
      scanAndRetryFailedLockUpdates(
        argv['project-id'],
        argv['trigger-id'],
        argv['max-tries']
      );
    if (argv.port) {
      await serve(argv.port, '/rebuild', invoke);
    } else {
      await invoke();
    }
  },
};
