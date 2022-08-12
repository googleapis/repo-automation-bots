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
import {Helper} from './helper';

const COMMON_CONTAINER_PREFIX =
  'gcr.io/owlbot-bootstrap-prod/owlbot-bootstrapper';

export async function runTrigger(
  argv: CliArgs,
  cb: CloudBuildClient,
  helper: Helper
) {
  let languageValues;
  let commonContainer;
  if (!argv.languageContainer) {
    languageValues = await helper.getLanguageSpecificValues();
    commonContainer = await helper.getFullLatestContainerName(
      COMMON_CONTAINER_PREFIX
    );
  }
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
        _CONTAINER: argv.container ?? commonContainer ?? '',
        _LANGUAGE_CONTAINER:
          argv.languageContainer ?? languageValues?.languageContainer ?? '',
        _PROJECT_ID: argv.projectId,
      },
    },
  });

  await resp.promise();
}
