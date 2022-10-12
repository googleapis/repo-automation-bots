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
import {postProcess} from '../post-process';
import {CliArgs} from '../interfaces';

export const postProcessCommand: yargs.CommandModule<{}, CliArgs> = {
  command: 'post-process',
  describe: 'Run post-process steps for owlbot-bootstrapper',
  builder(yargs) {
    return yargs
      .option('projectId', {
        describe: 'project ID which contains the build file',
        type: 'string',
        demand: true,
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
        demand: true,
      })
      .option('buildId', {
        describe: 'build id of given build',
        type: 'string',
      })
      .option('monoRepoPath', {
        describe: 'path in which to save the mono repo',
        type: 'string',
        demand: true,
      })
      .option('serviceConfigPath', {
        describe: 'path in which to save the service config file',
        type: 'string',
        demand: true,
      })
      .option('interContainerVarsPath', {
        describe: 'path in which to save the inter container variables',
        type: 'string',
        demand: true,
      });
  },
  async handler(argv: CliArgs) {
    postProcess(argv);
  },
};
