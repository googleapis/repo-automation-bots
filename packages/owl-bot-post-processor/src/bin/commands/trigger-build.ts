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
import * as yargs from 'yargs';
import {BuildArgs, triggerBuild} from '../../helpers';

export const triggerBuildCommand: yargs.CommandModule<{}, BuildArgs> = {
  command: 'trigger-build',
  describe: 'trigger a build on Cloud Build to post-process a PR',
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
        type: 'string',
        demand: true,
      })
      .option('repo', {
        describe: 'repository to run against, e.g., googleapis/foo',
        type: 'string',
        demand: true,
      })
      .option('pr', {
        describe: 'PR to post-process',
        type: 'string',
        demand: true,
      })
      .option('project', {
        describe: 'gcloud project',
        type: 'string',
      })
      .option('trigger', {
        describe: 'Cloud Build trigger to run',
        type: 'string',
        default: '637fc67f-fec0-4b62-a5f1-df81a6808c17',
      });
  },
  async handler(argv) {
    await triggerBuild(argv);
  },
};
