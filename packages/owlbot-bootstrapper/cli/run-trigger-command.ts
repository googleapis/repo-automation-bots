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
import {runTrigger} from './run-trigger';
import {CloudBuildClient} from '@google-cloud/cloudbuild';
export interface CliArgs {
  projectId: string;
  triggerId: string;
  apiId: string;
  repoToClone?: string;
  language: string;
  installationId: string;
  container?: string;
  languageContainer?: string;
  monoRepoDir?: string;
  serviceConfigPath?: string;
  interContainerVarsPath?: string;
  skipIssueOnFailure: boolean;
  sourceCl: number;
}

export interface MonoRepo {
  owner: string;
  repo: string;
}

const languageContainers = [
  {
    language: 'nodejs',
    languageContainerInArtifactRegistry:
      'us-docker.pkg.dev/owlbot-bootstrap-prod/owlbot-bootstrapper-images/node-bootstrapper:latest',
    repoToClone: 'git@github.com/googleapis/google-cloud-node.git',
  },
];

export function getLanguageSpecificValues(language: string) {
  for (const languageContainer of languageContainers) {
    if (languageContainer.language === language) {
      return languageContainer;
    }
  }
  throw new Error('No language-specific container specified');
}

export function parseRepoNameAndOrg(repoToClone: string | undefined): MonoRepo {
  // find the repo name from git@github.com/googleapis/google-cloud-node.git
  const repoName = repoToClone?.match(/git@github.com[/|:](.*?)\/(.*?).git/);
  if (!repoName) {
    throw new Error(
      "Repo to clone arg is malformed; should be in form of ssh address,' git@github.com:googleapis/google-cloud-node.git'"
    );
  }

  return {owner: repoName[1], repo: repoName[2]};
}

export const runTriggerCommand: yargs.CommandModule<{}, CliArgs> = {
  command: 'run-trigger',
  describe: 'Kicks off the build trigger for owlbot-bootstrapper',
  builder(yargs) {
    return yargs
      .option('projectId', {
        describe: 'project ID which contains the build file',
        type: 'string',
        default: 'owlbot-bootstrap-prod',
      })
      .option('triggerId', {
        describe: 'trigger of build to run',
        type: 'string',
        default: 'owlbot-bootstrapper-trigger',
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
        default: '25330619',
      })
      .option('container', {
        describe: 'common container image',
        type: 'string',
        demand: false,
      })
      .option('languageContainer', {
        describe: 'language-specific container image',
        type: 'string',
        demand: false,
      })
      .option('monoRepoDir', {
        describe: 'path to the directory in which the mono repo will be cloned',
        type: 'string',
        demand: false,
      })
      .option('serviceConfigPath', {
        describe: 'path to save the service config file',
        type: 'string',
        demand: false,
      })
      .option('interContainerVarsPath', {
        describe: 'path to save the inter container variables',
        type: 'string',
        demand: false,
      })
      .option('skipIssueOnFailure', {
        describe: 'does not create issues if failure',
        type: 'boolean',
        default: false,
      })
      .option('sourceCl', {
        describe: 'source CL for tracking',
        type: 'number',
        demand: true,
      });
  },
  async handler(argv) {
    const cb = new CloudBuildClient({
      projectId: argv.projectId,
      fallback: 'rest',
    });
    let languageValues;
    if (!argv.languageContainer) {
      languageValues = getLanguageSpecificValues(argv.language);
    }
    const monoRepo = parseRepoNameAndOrg(
      argv.repoToClone ?? languageValues?.repoToClone
    );
    await runTrigger(argv, cb, monoRepo, languageValues);
  },
};
