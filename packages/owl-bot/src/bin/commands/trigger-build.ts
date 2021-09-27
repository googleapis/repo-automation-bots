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
import {
  createCheck,
  getAuthenticatedOctokit,
  getGitHubShortLivedAccessToken,
  fetchOwlBotLock,
  parseOwlBotLock,
  triggerPostProcessBuild,
} from '../../core';
import {promisify} from 'util';
import {readFile} from 'fs';
import yargs = require('yargs');

const readFileAsync = promisify(readFile);

interface Args {
  'pem-path': string;
  'app-id': number;
  installation: number;
  repo: string;
  pr: number;
  project?: string;
  trigger: string;
}

export const triggerBuildCommand: yargs.CommandModule<{}, Args> = {
  command: 'trigger-build',
  describe: 'trigger a build on Cloud Build to post-process a PR',
  builder(yargs) {
    return yargs
      .option('pem-path', {
        describe: 'provide path to private key for requesting JWT',
        type: 'string',
        demand: true,
      })
      .option('app-id', {
        describe: 'GitHub AppID',
        type: 'number',
        demand: true,
      })
      .option('installation', {
        describe: 'installation ID for GitHub app',
        type: 'number',
        demand: true,
      })
      .option('repo', {
        describe: 'repository to run against, e.g., googleapis/foo',
        type: 'string',
        demand: true,
      })
      .option('pr', {
        describe: 'PR to post-process',
        type: 'number',
        demand: true,
      })
      .option('project', {
        describe: 'gcloud project',
        type: 'string',
      })
      .option('trigger', {
        describe: 'Cloud Build trigger to run',
        type: 'string',
        default: '637fc67f-fec0-4b62-a5f1-df81a6808c17',
      });
  },
  async handler(argv) {
    const privateKey = await readFileAsync(argv['pem-path'], 'utf8');
    const token = await getGitHubShortLivedAccessToken(
      privateKey,
      argv['app-id'],
      argv.installation
    );
    const octokit = await getAuthenticatedOctokit(token.token);
    const lockText = await fetchOwlBotLock(argv.repo, Number(argv.pr), octokit);
    if (lockText === undefined) {
      console.info('no .OwlBot.lock.yaml found');
      return;
    }
    const lock = parseOwlBotLock(lockText);
    const image = `${lock.docker.image}@${lock.docker.digest}`;
    const buildStatus = await triggerPostProcessBuild(
      {
        image,
        project: argv.project,
        privateKey,
        appId: argv['app-id'],
        installation: argv.installation,
        repo: argv.repo,
        pr: Number(argv.pr),
        trigger: argv.trigger,
      },
      octokit
    );
    if (buildStatus) {
      await createCheck(
        {
          privateKey,
          appId: argv['app-id'],
          installation: argv.installation,
          pr: argv.pr,
          repo: argv.repo,
          text: buildStatus.text,
          summary: buildStatus.summary,
          conclusion: buildStatus.conclusion,
          detailsURL: buildStatus.detailsURL,
          title: `🦉 OwlBot - ${buildStatus.summary}`,
        },
        octokit
      );
    }
  },
};
