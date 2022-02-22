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

import yargs = require('yargs');
import {DEFAULT_OWL_BOT_YAML_PATH} from '../../config-files';
import {regeneratePullRequest} from '../../copy-code';
import {githubRepoFromOwnerSlashName} from '../../github-repo';
import {octokitFactoryFromToken} from '../../octokit-util';

interface Args {
  'source-repo': string;
  'source-repo-commit-hash': string;
  'owl-bot-yaml-path': string;
  'dest-repo': string;
  'dest-branch': string;
  'github-token': string;
}

export const copyCodeIntoPullRequestCommand: yargs.CommandModule<{}, Args> = {
  command: 'copy-code-into-pull-request',
  describe:
    'Regenerates a pull request. Uses `git push -f` to overwrite branch.',
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
        demand: true,
      })
      .option('owl-bot-yaml-path', {
        describe:
          'The path in the source repo to .OwlBot.yaml in that triggered the pull request.',
        type: 'string',
        demand: false,
        default: DEFAULT_OWL_BOT_YAML_PATH,
      })
      .option('dest-repo', {
        describe: 'Copy the code into this repo.',
        type: 'string',
        demand: true,
      })
      .option('dest-branch', {
        describe: 'Copy the code into this branch.',
        type: 'string',
        demand: true,
      })
      .option('github-token', {
        describe: 'Short-lived github token.',
        type: 'string',
        demand: true,
      });
  },
  async handler(argv) {
    await regeneratePullRequest(
      argv['source-repo'],
      {
        repo: githubRepoFromOwnerSlashName(argv['dest-repo']),
        yamlPath: argv['owl-bot-yaml-path'],
      },
      argv['dest-branch'],
      octokitFactoryFromToken(argv['github-token'])
    );
  },
};
