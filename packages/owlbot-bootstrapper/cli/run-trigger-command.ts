// Copyright 2022 Google LLC
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

import yargs from 'yargs';
import {runTrigger} from './run-trigger';
import {CloudBuildClient} from '@google-cloud/cloudbuild';
import {Helper} from './helper';
export interface CliArgs {
  projectId: string;
  triggerId: string;
  apiId: string;
  repoToClone?: string;
  language: string;
  installationId: string;
  container?: string;
  languageContainer?: string;
}

export const runTriggerCommand: yargs.CommandModule<{}, CliArgs> = {
  command: 'run-trigger',
  describe: 'Kicks off the build trigger for owlbot-bootstrapper',
  builder(yargs) {
    return yargs
      .option('projectId', {
        describe: 'project ID which contains the build file',
        type: 'string',
        default: 'owlbot-bootstrap-prod',
      })
      .option('triggerId', {
        describe: 'trigger of build to run',
        type: 'string',
        default: 'owlbot-bootstrapper-trigger',
      })
      .option('apiId', {
        describe: 'api ID to generate a library for',
        type: 'string',
        demand: true,
      })
      .option('repoToClone', {
        describe: 'monorepo to clone',
        type: 'string',
        demand: false,
      })
      .option('language', {
        describe: 'language for which to generate a library',
        type: 'string',
        demand: true,
      })
      .option('installationId', {
        describe: 'Github app installation ID',
        type: 'string',
        default: '25330619',
      })
      .option('container', {
        describe: 'common container image',
        type: 'string',
        demand: false,
      })
      .option('languageContainer', {
        describe: 'language-specific container image',
        type: 'string',
        demand: false,
      });
  },
  async handler(argv) {
    const cb = new CloudBuildClient();
    const helper = new Helper(argv);
    await runTrigger(argv, cb, helper);
  },
};
