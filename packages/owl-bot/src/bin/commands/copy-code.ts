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

// To Run: node ./build/src/bin/owl-bot.js copy-code <args>

import tmp from 'tmp';
import yargs = require('yargs');
import path = require('path');
import {copyCode, loadOwlBotYaml} from '../../copy-code';

interface Args {
  'source-repo': string;
  'source-repo-commit-hash': string;
  dest: string | undefined;
  'config-file': string;
  token?: string;
}

export const copyCodeCommand: yargs.CommandModule<{}, Args> = {
  command: 'copy-code',
  describe: 'copies code from source to repo into a local repo',
  builder(yargs) {
    return yargs
      .option('source-repo', {
        describe: 'The source repository.  Example: googleapis/googleapis-gen',
        type: 'string',
        demand: false,
        default: 'googleapis/googleapis-gen',
      })
      .option('source-repo-commit-hash', {
        describe:
          'The commit hash of the source repo from which to copy files.',
        type: 'string',
        demand: false,
        default: '',
      })
      .option('dest', {
        describe:
          'The directory containing a local repo.  Example: nodejs/vision.',
        type: 'string',
        demand: false,
      })
      .option('config-file', {
        describe: 'Path in the directory to the .OwlBot.yaml config.',
        type: 'string',
        default: '.github/.OwlBot.yaml',
      })
      .option('token', {
        describe: 'Token for cloning private googleapis-gen repo',
        type: 'string',
      });
  },
  async handler(argv) {
    const destDir = argv.dest ?? process.cwd();
    await copyCode(
      argv['source-repo'],
      argv['source-repo-commit-hash'],
      destDir,
      tmp.dirSync().name,
      await loadOwlBotYaml(path.join(destDir, argv['config-file'])),
      console,
      argv.token
    );
  },
};
