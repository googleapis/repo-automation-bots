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

// To Run: node ./build/src/bin/owl-bot.js write-lock ...

import {OwlBotLock} from '../../config-files';
import {promisify} from 'util';
import {writeFile} from 'fs';
import yargs = require('yargs');
import {dump} from 'js-yaml';
import {fetchConfig} from '../../docker-api';
import {adornOwlBotLockText} from '../../write-lock';

const writeFileAsync = promisify(writeFile);

interface Args {
  'lock-file-path': string;
  image: string;
}

export const writeLock: yargs.CommandModule<{}, Args> = {
  command: 'write-lock',
  describe: 'Writes a lock file',
  builder(yargs) {
    return yargs
      .option('lock-file-path', {
        describe: 'path to .OwlBot.lock.yaml',
        type: 'string',
        demand: true,
      })
      .option('image', {
        describe: `docker image path including digest. example:
        gcr.io/repo-automation-bots/owlbot-nodejs@sha256:a39587bcc3223`,
        type: 'string',
        demand: true,
      });
  },
  async handler(argv) {
    const [image, digest] = argv['image'].split('@');
    const config: OwlBotLock = {docker: {image, digest}};
    let text = dump(config);
    let timestamp = '';
    try {
      timestamp = (await fetchConfig(image, digest)).created;
    } catch (e) {
      // Failing to fetch the timestamp is not fatal.
      console.error(e);
    }
    text = adornOwlBotLockText(text, timestamp);
    await writeFileAsync(argv['lock-file-path'], text);
  },
};
