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

import yargs = require('yargs');
import tmp from 'tmp';
import path = require('path');
import {copyDirs, loadOwlBotYaml} from '../../copy-code';
import {getCommonStem, unpackTarBalls} from '../../bazel-bin';

interface Args {
  'source-dir': string;
  dest: string | undefined;
  'config-file': string;
}

export const copyBazelBin: yargs.CommandModule<{}, Args> = {
  command: 'copy-bazel-bin',
  describe: 'copies source code from bazel output into a local repo',
  builder(yargs) {
    return yargs
      .option('source-dir', {
        describe:
          'The source directory.  Example: ~/my-repos/googleapis/bazel-bin',
        type: 'string',
        demand: true,
        default: '',
      })
      .option('dest', {
        describe:
          'The directory containing a local repo.  Example: nodejs/vision.' +
          '  Defaults to the current working directory.',
        type: 'string',
        demand: false,
      })
      .option('config-file', {
        describe: 'Path in the directory to the .OwlBot.yaml config.',
        type: 'string',
        default: '.github/.OwlBot.yaml',
      });
  },
  async handler(argv) {
    const destDir = argv.dest ?? process.cwd();
    const tempDir = tmp.dirSync().name;
    const yaml = await loadOwlBotYaml(path.join(destDir, argv['config-file']));
    const sourceRegexps = (yaml['deep-copy-regex'] ?? []).map(x => x.source);
    const regexpStem = getCommonStem(sourceRegexps);
    unpackTarBalls(argv['source-dir'], tempDir, regexpStem);
    copyDirs(tempDir, destDir, yaml);
  },
};
