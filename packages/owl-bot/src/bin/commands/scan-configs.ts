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

import admin from 'firebase-admin';
import {FirestoreConfigsStore} from '../../database';
import {scanGithubForConfigs} from '../../handlers';
import yargs = require('yargs');
import {octokitFactoryFrom} from '../../octokit-util';
import * as http from 'http';

interface Args {
  'pem-path': string;
  'app-id': number;
  installation: number;
  org: string;
  project: string;
  port: number;
}

/**
 * Runs a webserver that scans the configs whenever the url /scan-configs is requested.
 */
function serve(port: number, callback: () => Promise<void>) {
  const server = http.createServer(async (req, res) => {
    // Require the url /scan-configs because health checks and the like may
    // arrive at / or other urls, and we don't want to kick off a 20-minute,
    // github-quota-consuming scan for every such request.
    if ('/scan-configs' === req.url) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.write('Working...\n');
      try {
        await callback();
        res.end('Done.');
      } catch (e) {
        console.error(e);
        res.end('Error.  See logs.');
      }
    } else {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/plain');
      res.end("You're probably looking for /scan-configs.");
    }
  });
  console.log('Listening on port ' + port);
  server.listen(port);
}

export const scanConfigs: yargs.CommandModule<{}, Args> = {
  command: 'scan-configs',
  describe:
    'Scan GitHub org for .github/.OwlBot.yaml and .github/.OwlBot.lock.yaml',
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
      .option('port', {
        describe:
          'run a webserver listening to this port.  Requests to /scan-configs ' +
          'trigger actually scanning the configs.',
        type: 'number',
        demand: false,
        default: 0,
      })
      .env('SCAN_CONFIGS');
  },
  async handler(argv) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: argv.project,
    });
    const db = admin.firestore();
    const configStore = new FirestoreConfigsStore(db!);
    const invoke = () => {
      return scanGithubForConfigs(
        configStore,
        octokitFactoryFrom(argv),
        argv.org,
        argv.installation
      );
    };
    if (argv.port) {
      serve(argv.port, invoke);
    } else {
      await invoke();
    }
  },
};
