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

// To Run: node ./build/src/bin/owl-bot.js validate ~/.OwlBot.yaml

import {owlBotYamlFrom} from '../../config-files';
import {promisify} from 'util';
import {readFile} from 'fs';
import yargs = require('yargs');
import * as yaml from 'js-yaml';

const readFileAsync = promisify(readFile);

interface Args {
  config: string;
}

export const validate: yargs.CommandModule<{}, Args> = {
  command: 'validate <config>',
  describe: 'validate .OwlBot.yaml',
  builder(yargs) {
    return yargs.option('config', {
      describe: 'path to .OwlBot.yaml',
      type: 'string',
      demand: true,
    });
  },
  async handler(argv) {
    try {
      const lockContent = await readFileAsync(argv.config, 'utf8');
      owlBotYamlFrom(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yaml.load(lockContent) as Record<string, any>
      );
      console.info(`${argv.config} is valid`);
    } catch (e) {
      console.info(e);
    }
  },
};
