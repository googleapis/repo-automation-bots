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
import yargs = require('yargs');
import {scanGoogleapisGenAndCreatePullRequests} from '../../scan-googleapis-gen-and-create-pull-requests';
import {FirestoreConfigsStore, FirestoreCopyStateStore} from '../../database';
import {OctokitParams, octokitFactoryFrom} from '../../octokit-util';
import {WithNestedCommitDelimiters} from '../../create-pr';

interface Args extends OctokitParams {
  'source-repo': string;
  'firestore-project': string;
  'clone-depth': number;
  'combine-pulls-threshold': number;
  'use-nested-commit-delimiters'?: boolean;
  'max-yaml-count-per-pull-request': number;
  'draft-pull-requests': boolean;
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
      .option('combine-pulls-threshold', {
        describe:
          'Normally, if a single commit to googleapis-gen affects multiple ' +
          'apis in a mono repo like google-cloud-ruby, then Owl Bot will ' +
          'open one pull request for each API.\n\n' +
          'When the number of affected APIs excceeds this threshold, ' +
          'Owl Bot will open one combined pull request ' +
          'with changes to all the APIs.',
        type: 'number',
        default: 3,
      })
      .option('use-nested-commit-delimiters', {
        describe:
          'Whether to use BEGIN_NESTED_COMMIT delimiters when separating multiple commit messages',
        type: 'boolean',
        default: true,
        demand: false,
      })
      .option('max-yaml-count-per-pull-request', {
        describe:
          'maximum number of yamls (APIs) to combine in a single pull request',
        type: 'number',
        default: 20,
        demand: false,
      })
      .option('draft-pull-requests', {
        describe: 'When creating pull requests, make them drafts.',
        type: 'boolean',
        default: true,
        demand: false,
      });
  },
  async handler(argv) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: argv['firestore-project'],
    });
    const db = admin.firestore();
    const configsStore = new FirestoreConfigsStore(db!);
    const copyStateStore = new FirestoreCopyStateStore(db!);
    await scanGoogleapisGenAndCreatePullRequests(
      argv['source-repo'],
      octokitFactoryFrom(argv),
      configsStore,
      argv['clone-depth'],
      copyStateStore,
      argv['combine-pulls-threshold'],
      undefined /* logger */,
      argv['use-nested-commit-delimiters']
        ? WithNestedCommitDelimiters.Yes
        : WithNestedCommitDelimiters.No,
      argv['max-yaml-count-per-pull-request'],
      argv['draft-pull-requests']
    );
  },
};
