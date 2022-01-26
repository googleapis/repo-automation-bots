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

import admin from 'firebase-admin';
import yargs = require('yargs');
import {scanGoogleapisGenAndCreatePullRequests} from '../../scan-googleapis-gen-and-create-pull-requests';
import {FirestoreConfigsStore, FirestoreCopyStateStore} from '../../database';
import {OctokitParams, octokitFactoryFrom} from '../../octokit-util';

interface Args extends OctokitParams {
  'source-repo': string;
  'firestore-project': string;
  'clone-depth': number;
  'search-depth': number;
  'track-builds-in-firestore': boolean;
}

export const scanGoogleapisGenAndCreatePullRequestsCommand: yargs.CommandModule<
  {},
  Args
> = {
  command: 'scan-googleapis-gen-and-create-pull-requests',
  describe:
    'Searches through googleapis-gen commit history, and copies code to dest repos.',
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
      .option('source-repo', {
        describe:
          'The source repository.  Example: googleapis/googleapis-gen.  Can also be a local path to a repo directory.',
        type: 'string',
        default: 'googleapis/googleapis-gen',
      })
      .option('firestore-project', {
        describe: 'project used for firestore database',
        type: 'string',
        default: 'repo-automation-bots-metrics',
      })
      .option('clone-depth', {
        describe:
          'The depth to clone googleapis-gen, and therefore an upper bound on the number of commits to examine.',
        type: 'number',
        default: 100,
      })
      .option('search-depth', {
        describe:
          'When searching pull request and issue histories to see if a pull' +
          ' request for the commit was already created, search this deep',
        type: 'number',
        default: 1000,
      })
      .option('track-builds-in-firestore', {
        describe:
          'Instead of searching through pull requests and issues, look in' +
          ' firestore, where pull requests and issues will also be recorded.',
        type: 'boolean',
        default: false,
      });
  },
  async handler(argv) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: argv['firestore-project'],
    });
    const db = admin.firestore();
    const configsStore = new FirestoreConfigsStore(db!);
    const copyStateStore = argv['track-builds-in-firestore']
      ? new FirestoreCopyStateStore(db!)
      : undefined;
    await scanGoogleapisGenAndCreatePullRequests(
      argv['source-repo'],
      octokitFactoryFrom(argv),
      configsStore,
      argv['search-depth'],
      argv['clone-depth'],
      copyStateStore
    );
  },
};
