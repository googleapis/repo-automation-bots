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

import {ConfigsStore} from '../../configs-store';
import yargs = require('yargs');
import {triggerOneBuildForUpdatingLock} from '../../handlers';

interface Args {
  'docker-image': string;
  'docker-digest': string;
  repo: string;
  project: string | undefined;
  'owl-bot-cli': string | undefined;
  trigger: string;
}

export const openPR: yargs.CommandModule<{}, Args> = {
  command: 'open-pr',
  describe:
    'Triggers a cloud build with the new .OwlBot.lock.yaml.  Opens a new pull request if the generated code changed.',
  builder(yargs) {
    return yargs
      .option('docker-image', {
        describe:
          'The full path of the docker image that changed.  ex: gcr.io/repo-automation-bots/nodejs-post-processor',
        type: 'string',
        demand: true,
      })
      .option('docker-digest', {
        describe:
          'the docker digest sha.  ex: sha256:bef6add3ddeb96210db83d07560a13b735c532d6f3adaf76dec3d725f6b76f05',
        type: 'string',
        demand: true,
      })
      .option('repo', {
        describe: 'repository to run against, e.g., googleapis/foo',
        type: 'string',
        demand: true,
      })
      .option('trigger', {
        describe: 'cloud build trigger id to invoke',
        type: 'string',
        demand: true,
      })
      .option('project', {
        describe: 'google cloud project id in which to create the cloud build',
        type: 'string',
        demand: false,
      })
      .option('owl-bot-cli', {
        describe: 'docker image for the owl-bot cli',
        type: 'string',
        demand: false,
      });
  },
  async handler(argv) {
    const fakeConfigStore = {
      findBuildIdForUpdatingLock: () => undefined,
      recordBuildIdForUpdatingLock: () => {},
    } as unknown as ConfigsStore;
    const project = argv.project || process.env.PROJECT_ID;
    if (!project) {
      throw Error(
        'gcloud project id must be provided via project arg or environment variable PROJECT_ID'
      );
    }
    await triggerOneBuildForUpdatingLock(
      fakeConfigStore,
      argv.repo,
      {
        docker: {
          image: argv['docker-image'],
          digest: argv['docker-digest'],
        },
      },
      project,
      argv.trigger,
      undefined,
      argv['owl-bot-cli']
    );
  },
};
