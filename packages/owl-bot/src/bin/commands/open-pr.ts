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
import {createOnePullRequestForUpdatingLock} from '../../handlers';
import yargs = require('yargs');
import {octokitFrom} from '../../octokit-util';

interface Args {
  'pem-path': string;
  'app-id': number;
  installation: number;
  'docker-image': string;
  'docker-digest': string;
  repo: string;
}

export const openPR: yargs.CommandModule<{}, Args> = {
  command: 'open-pr',
  describe: 'Open a pull request with an updated .OwlBot.lock.yaml',
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
      .option('docker-image', {
        describe:
          'The full path of the docker image that changed.  ex: gcr.io/repo-automation-bots/nodejs-post-processor',
        type: 'string',
        demand: true,
      })
      .option('docker-digest', {
        describe: 'the docker digest sha',
        type: 'string',
        demand: true,
      })
      .option('repo', {
        describe: 'repository to run against, e.g., googleapis/foo',
        type: 'string',
        demand: true,
      });
  },
  async handler(argv) {
    const fakeConfigStore = ({
      findPullRequestForUpdatingLock: () => undefined,
      recordPullRequestForUpdatingLock: () => {},
    } as unknown) as ConfigsStore;
    const octokit = await octokitFrom(argv);
    await createOnePullRequestForUpdatingLock(
      fakeConfigStore,
      octokit,
      argv.repo,
      {
        docker: {
          image: argv['docker-image'],
          digest: argv['docker-digest'],
        },
      }
    );
  },
};
