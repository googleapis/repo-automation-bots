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

import {owlBotYamlFromText} from '../../config-files';
import {promisify} from 'util';
import {readFile} from 'fs';
import * as fs from 'fs';
import yargs = require('yargs');
import {collectConfigs} from '../../configs-store';

const readFileAsync = promisify(readFile);

interface Args {
  config: string;
  'ignore-regexp': string[];
}

export const validate: yargs.CommandModule<{}, Args> = {
  command: 'validate <config>|<directory>',
  describe: 'validates a config or all the configs in a directory',
  builder(yargs) {
    return yargs
      .option('config', {
        describe: 'path to .OwlBot.yaml or directory',
        type: 'string',
        demand: true,
      })
      .option('ignore-regexp', {
        describe:
          'regular expression of paths to ignore while scanning the ' +
          'directory.  Example: .*/templates/.*',
        type: 'array',
        demand: false,
        default: [],
      });
  },
  async handler(argv) {
    const stat = fs.statSync(argv.config);
    if (stat.isFile()) {
      // Validate one config.
      try {
        const yamlText = await readFileAsync(argv.config, 'utf8');
        owlBotYamlFromText(yamlText);
        console.info(`${argv.config} is valid`);
      } catch (e) {
        console.error(e);
        const error = e instanceof Error ? e : Error(String(e));
        yargs.exit(-1, error);
      }
    } else if (stat.isDirectory()) {
      // Validate all the configs in the directory.
      const configs = collectConfigs(argv.config);

      // Tell the user all the valid configs.
      for (const config of configs.yamls) {
        console.log(`${config.path} is valid`);
      }

      // Ignore the bad configs the user asked us to ignore.
      const ignores = argv['ignore-regexp'].map(pattern => new RegExp(pattern));
      const badConfigs = configs.badConfigs.filter(
        config =>
          !ignores.some(regexp => {
            const matched = regexp.exec(config.path);
            if (matched) {
              console.log('ignored error in', config.path);
            }
            return matched;
          })
      );

      // Report the bad configs.
      for (const config of badConfigs) {
        for (const error of config.errorMessages) {
          console.error(`${config.path}: ${error}`);
        }
      }
      if (badConfigs.length > 0) {
        const errorMessage = `${badConfigs.length} invalid config(s).`;
        console.error(errorMessage);
        yargs.exit(-1, new Error(errorMessage));
      }
    } else {
      const errorMessage = `${argv.config} isn't a file or a directory.`;
      console.error(errorMessage);
      yargs.exit(-2, new Error(errorMessage));
    }
  },
};
