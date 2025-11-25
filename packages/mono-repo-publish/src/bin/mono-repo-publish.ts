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
import {Octokit} from '@octokit/rest';

interface CommonArgs {
  'pr-url': string;
  'app-id-path'?: string;
  'private-key-path'?: string;
  'installation-id-path'?: string;
  'exclude-files': string[];
}
interface PublishArgs extends CommonArgs {
  'dry-run': boolean;
}
interface PublishCustomArgs extends CommonArgs {
  script: string;
}

function parseCommonArgs<T>(yargs: yargs.Argv<T>): yargs.Argv<T & CommonArgs> {
  const configured = yargs
    .option('pr-url', {
      describe:
        'the URL of the GH PR for submodules you wish to publish, e.g., https://github.com/googleapis/release-please/pull/707',
      type: 'string',
      demand: true,
    })
    .option('app-id-path', {
      describe: 'path to a file containing the GitHub application ID',
      type: 'string',
      default: (() => {
        return process.env.APP_ID_PATH;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    })
    .option('private-key-path', {
      describe: 'path to a file containing the GitHub private key',
      type: 'string',
      default: (() => {
        return process.env.GITHUB_PRIVATE_KEY_PATH;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    })
    .option('installation-id-path', {
      describe: 'path to a file containing the GitHub installation ID',
      type: 'string',
      default: (() => {
        return process.env.INSTALLATION_ID_PATH;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any,
    })
    .option('exclude-files', {
      describe: 'glob of paths to exclude',
      type: 'array',
      default: [],
    });
  return configured as unknown as yargs.Argv<T & CommonArgs>;
}

const publishCommand: yargs.CommandModule<{}, PublishArgs> = {
  command: '$0',
  describe: 'publish packages affected by a pull request',
  builder(yargs) {
    return parseCommonArgs(yargs).option('dry-run', {
      describe: 'whether or not to publish in dry run',
      type: 'boolean',
      default: false,
    });
  },
  async handler(argv) {
    const octokit = buildOctokit(argv);
    const pr = core.parseURL(argv['pr-url']);
    if (!pr) {
      throw Error(`Could not find PR from ${argv.prUrl}`);
    }
    const files = await core.getsPRFiles(pr, octokit);
    const submodules = core.listChangedSubmodules(files, argv['exclude-files']);
    const errors = core.publishSubmodules(submodules, argv['dry-run']);
    if (errors.length) {
      throw Error('some publications failed, see logs');
    }
  },
};

const publishCustomCommand: yargs.CommandModule<{}, PublishCustomArgs> = {
  command: 'custom',
  describe: 'publish packages affected by a pull request with custom script',
  builder(yargs) {
    return parseCommonArgs(yargs).option('script', {
      describe: 'Path to script to run',
      type: 'string',
      demand: true,
    });
  },
  async handler(argv) {
    const octokit = buildOctokit(argv);
    const pr = core.parseURL(argv['pr-url']);
    if (!pr) {
      throw Error(`Could not find PR from ${argv.prUrl}`);
    }
    const files = await core.getsPRFiles(pr, octokit);
    const submodules = core.listChangedSubmodules(files, argv['exclude-files']);
    const errors = core.publishCustom(submodules, argv['script']);
    if (errors.length) {
      for (const error of errors) {
        console.error('----- publication failure -----');
        console.error(error);
        console.error('-----');
      }
      throw Error('some publications failed, see logs');
    }
  },
};

function buildOctokit(argv: CommonArgs): Octokit {
  const appIdPath = argv['app-id-path'];
  const privateKeyPath = argv['private-key-path'];
  const installationIdPath = argv['installation-id-path'];
  if (!appIdPath || !privateKeyPath || !installationIdPath) {
    console.warn(
      'Missing one of APP_ID_PATH, GITHUB_PRIVATE_KEY_PATH, INSTALLATION_ID_PATH. Using unauthenticated client.'
    );
    return new Octokit();
  } else {
    return core.getOctokitInstance(
      appIdPath,
      privateKeyPath,
      installationIdPath
    );
  }
}

// Get testing repo that touches submodules that we would want to publish
// Once we have the list, actually calling npm publish on those modules
export const parser = yargs
  .command(publishCommand)
  .command(publishCustomCommand);

// Only run parser if executed with node bin, this allows
// for the parser to be easily tested:
if (require.main === module) {
  (async () => {
    await parser.parseAsync();
  })();
}
