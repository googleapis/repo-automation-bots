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

// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
import {execSync} from 'child_process';

// Trigger ID in gcp
const TRIGGER_ID = 'owlbot-bootstrapper-trigger';
// Installation ID for owlbot-bootstrapper on googleapis/
const INSTALLATION_ID = '25330619';
const PROJECT_ID = 'owlbot-bootstrapper-prod';
const COMMON_CONTAINER_IMAGE = `gcr.io/${PROJECT_ID}/owlbot-bootstrapper:latest`;

interface LanguageConstants {
  language: string;
  repoToClone?: string;
  containerImage: string;
}

// TODO: This bot will respond when the api index in googleapis/googleapis regenerates, i.e.,
// when a new commit is pushed to googleapis/googleapis. It will then trigger the cli tool (./cli)
// to run the Build file (cloudbuild-owlbot-bootstrapper.yaml), that will run the common container
// then the language-specific containers. For now, I will not wire this up until we have a good indicator
// whether an API wants a library generated.
(app: Probot) => {
  app.on(['pull_request.opened'], async context => {
    // TODO: actually fill out API ID from regeneration of api index
    const apiId = 'google.cloud.not-a-real-api-id.v1';

    await main(languageSpecificConsts, apiId);
  });
};

// Here is where languages will need to fill out constants regarding their repo settings, i.e.,
// repo to clone if mono repo, and language-specific container image name
const languageSpecificConsts = [
  {
    language: 'nodejs',
    repoToClone: 'github.com/googleapis/google-cloud-node.git',
    containerImage: 'gcr.io/myproject/myimage:latest',
  },
];

// TODO: change export to Probot function when it's fully wired up
// For now, we can call this function manually to create libraries when a new API is generated
export async function main(
  languageSpecificConsts: LanguageConstants[],
  apiId: string
) {
  languageSpecificConsts.forEach(language =>
    execSync(
      `node ./build/cli/run-trigger --apiId ${apiId} --projectId ${PROJECT_ID} --isPreProcess true --language ${language.language} --triggerId ${TRIGGER_ID} --installationId ${INSTALLATION_ID} --repoToClone ${language.repoToClone} --languageContainer ${language.containerImage} --container ${COMMON_CONTAINER_IMAGE}`
    )
  );
}
