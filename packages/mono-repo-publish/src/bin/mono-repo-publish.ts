#!/usr/bin/env node

// Copyright 2022 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import * as yargs from 'yargs';
import * as core from '../main';

interface Args {
  'pr-url': string;
  'dry-run': boolean;
}

const publishCommand: yargs.CommandModule<{}, Args> = {
  command: '$0',
  describe: 'publish packages affected by a pull request',
  builder(yargs) {
    return yargs
      .option('pr-url', {
        describe:
          'the URL of the GH PR for submodules you wish to publish, e.g., https://github.com/googleapis/release-please/pull/707',
        type: 'string',
        demand: true,
      })
      .option('dry-run', {
        describe: 'whether or not to publish in dry run',
        type: 'boolean',
        default: false,
      });
  },
  async handler(argv) {
    const appIdPath = process.env.APP_ID_PATH;
    const privateKeyPath = process.env.GITHUB_PRIVATE_KEY_PATH;
    const installationIdPath = process.env.INSTALLATION_ID_PATH;

    if (!appIdPath || !privateKeyPath || !installationIdPath) {
      throw Error(
        'Need to set all of APP_ID_PATH, GITHUB_PRIVATE_KEY_PATH, INSTALLATION_ID_PATH'
      );
    }
    const pr = core.parseURL(argv['pr-url']);
    const octokit = core.getOctokitInstance(
      appIdPath,
      privateKeyPath,
      installationIdPath
    );
    if (!pr) {
      throw Error(`Could not find PR from ${argv.prUrl}`);
    }
    const files = await core.getsPRFiles(pr, octokit);
    const submodules = core.listChangedSubmodules(files);
    const errors = core.publishSubmodules(submodules, argv['dry-run']);
    if (errors.length) {
      throw Error('some publications failed, see logs');
    }
  },
};

// Get testing repo that touches submodules that we would want to publish
// Once we have the list, actually calling npm publish on those modules
export const parser = yargs.command(publishCommand);

// Only run parser if executed with node bin, this allows
// for the parser to be easily tested:
if (require.main === module) {
  (async () => {
    await parser.parseAsync();
  })();
}
