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

// This file is kicked off by a manual CLI invocation, either by an event or by a human.
// It kicks off a trigger in cloud build.

import {CloudBuildClient} from '@google-cloud/cloudbuild';
import {CliArgs} from './run-trigger-command';

const COMMON_CONTAINER =
  'us-docker.pkg.dev/owlbot-bootstrap-prod/owlbot-bootstrapper-images/owlbot-bootstrapper:latest';
const DIRECTORY_PATH = '/workspace';
const MONO_REPO_PATH = DIRECTORY_PATH;
const SERVICE_CONFIG_PATH = `${DIRECTORY_PATH}/serviceConfig.yaml`;
const INTER_CONTAINER_VARS_PATH = `${DIRECTORY_PATH}/interContainerVars.json`;

export async function runTrigger(
  argv: CliArgs,
  cb: CloudBuildClient,
  languageValues?: {
    repoToClone: string;
    language: string;
    languageContainerInArtifactRegistry: string;
  }
) {
  const [resp] = await cb.runBuildTrigger({
    projectId: argv.projectId,
    triggerId: argv.triggerId,
    source: {
      projectId: argv.projectId,
      branchName: 'main',
      substitutions: {
        _API_ID: argv.apiId,
        _REPO_TO_CLONE: argv.repoToClone ?? languageValues?.repoToClone ?? '',
        _LANGUAGE: argv.language,
        _INSTALLATION_ID: argv.installationId,
        _CONTAINER: argv.container ?? COMMON_CONTAINER ?? '',
        _LANGUAGE_CONTAINER:
          argv.languageContainer ??
          languageValues?.languageContainerInArtifactRegistry ??
          '',
        _PROJECT_ID: argv.projectId,
        _MONO_REPO_PATH: argv.monoRepoPath ?? MONO_REPO_PATH,
        _SERVICE_CONFIG_PATH: argv.serviceConfigPath ?? SERVICE_CONFIG_PATH,
        _INTER_CONTAINER_VARS_PATH:
          argv.interContainerVarsPath ?? INTER_CONTAINER_VARS_PATH,
      },
    },
  });

  await resp.promise();
}
