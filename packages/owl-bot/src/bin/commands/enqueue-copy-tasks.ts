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
import {
  getAuthenticatedOctokit,
  getGitHubShortLivedAccessToken,
  getFilesModifiedBySha,
  commitsIterator,
} from '../../core';
import {FirestoreConfigsStore} from '../../database';
import {promisify} from 'util';
import {readFile} from 'fs';
import yargs = require('yargs');
import {logger} from 'gcf-utils';

const readFileAsync = promisify(readFile);

interface Args {
  'pem-path': string;
  'app-id': number;
  installation: number;
  'source-repo': string;
  'git-path': string;
  project: string;
  'firestore-project': string;
  queue: string;
}

export const enqueueCopyTasks: yargs.CommandModule<{}, Args> = {
  command: 'enqueue-copy-tasks',
  describe:
    'look at most recent commits to repo and enqueue copy tasks for those repos',
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
        describe: 'repository to monitor for changes',
        type: 'string',
        default: 'googleapis/googleapis-gen',
      })
      .option('git-path', {
        describe: 'where on disk is source-repo checked out?',
        type: 'string',
        default: './',
      })
      .option('project', {
        describe: 'gcloud project',
        type: 'string',
        default: 'repo-automation-bots',
      })
      .option('firestore-project', {
        describe: 'project used for firestore database',
        type: 'string',
        default: 'repo-automation-bots-metrics',
      })
      .option('queue', {
        describe: 'pubsub queue to publish PR update jobs to',
        type: 'string',
        default: 'projects/repo-automation-bots/topics/owlbot-prs',
      });
  },
  async handler(argv) {
    const privateKey = await readFileAsync(argv['pem-path'], 'utf8');
    const token = await getGitHubShortLivedAccessToken(
      privateKey,
      argv['app-id'],
      argv.installation
    );
    const octokit = await getAuthenticatedOctokit(token.token);
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: argv['firestore-project'],
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const db = admin.firestore();
    const configStore = new FirestoreConfigsStore(db!);

    let sha: string | undefined = undefined;
    for await (const s of commitsIterator(argv['source-repo'], octokit)) {
      sha = s;
    }
    if (!sha) throw Error(`no commits found for ${argv['source-repo']}`);
    const files = await getFilesModifiedBySha(argv['git-path'], sha);
    logger.info(`found ${files.length} files changed`);
    const repos = await configStore.findReposAffectedByFileChanges(files);
    for (const repo of repos) {
      logger.info(`perform copy operations for ${repo}`);
    }
  },
};
