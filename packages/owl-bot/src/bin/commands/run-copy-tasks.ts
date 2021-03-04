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

// To Run: node ./build/src/bin/owl-bot.js run-copy-tasks <args>

import admin from 'firebase-admin';
import yargs = require('yargs');
import {runCopyAlgorithm} from '../../copy-code';
import {octokitFrom, OctokitParams} from '../../octokit-util';
import {FirestoreConfigsStore} from '../../database';

export interface Args extends OctokitParams {
  'source-repo': string;
  project: string;
  'git-path': string;
}

export const runCopyTasks: yargs.CommandModule<{}, Args> = {
  command: 'run-copy-tasks',
  describe: 'walk googleapis-gen and create PRs for outstanding copy tasks',
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
      .option('project', {
        describe: 'GCP project configs are stored in',
        demand: true,
        type: 'string',
      })
      .option('git-path', {
        describe: 'where on disk is source-repo checked out?',
        type: 'string',
        default: './',
      })
      .option('source-repo', {
        describe: 'The source repository.  Example: googleapis/googleapis-gen',
        type: 'string',
        demand: true,
      });
  },
  async handler(argv) {
    // Octokit instance used to interact with googleapis org:
    const octokit = await octokitFrom(argv);
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: argv.project,
    });
    // Firestore database used to lookup configs:
    const db = admin.firestore();
    const configStore = new FirestoreConfigsStore(db!);
    await runCopyAlgorithm(
      argv['source-repo'],
      argv['git-path'],
      configStore,
      octokit
    );
  },
};
