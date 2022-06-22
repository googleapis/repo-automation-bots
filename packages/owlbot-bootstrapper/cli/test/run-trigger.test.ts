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

import {CloudBuildClient} from '@google-cloud/cloudbuild';
import sinon, {SinonStubbedInstance} from 'sinon';
import {assert} from 'console';
import {runTrigger} from '../run-trigger';
import {describe, it} from 'mocha';

// Trigger ID in gcp
const TRIGGER_ID = 'owlbot-bootstrapper-trigger';
// Installation ID for owlbot-bootstrapper on googleapis/
const INSTALLATION_ID = '123456';
const PROJECT_ID = 'owlbot-bootstrapper-prod';
const COMMON_CONTAINER_IMAGE = `gcr.io/${PROJECT_ID}/owlbot-bootstrapper:latest`;
const API_ID = 'google.cloud.kms.v1';
const REPO_TO_CLONE = 'github.com/soficodes/nodejs-kms.git';
const LANGUAGE_CONTAINER = 'gcr.io/myproject/myimage:latest';
const LANGUAGE = 'nodejs';

describe('tests running build trigger', () => {
  const cloudBuildClientStub = sinon.createStubInstance(
    CloudBuildClient
  ) as SinonStubbedInstance<CloudBuildClient> & CloudBuildClient;

  cloudBuildClientStub.runBuildTrigger.resolves([
    {
      promise: () => Promise.resolve(),
    },
  ]);
  it('it should get correct variable names', async () => {
    await runTrigger(
      {
        projectId: PROJECT_ID,
        triggerId: TRIGGER_ID,
        installationId: INSTALLATION_ID,
        container: COMMON_CONTAINER_IMAGE,
        apiId: API_ID,
        repoToClone: REPO_TO_CLONE,
        language: 'nodejs',
        languageContainer: LANGUAGE_CONTAINER,
      },
      cloudBuildClientStub
    );

    assert(
      cloudBuildClientStub.runBuildTrigger.calledWith({
        projectId: PROJECT_ID,
        triggerId: TRIGGER_ID,
        source: {
          projectId: PROJECT_ID,
          branchName: 'main',
          substitutions: {
            _API_ID: API_ID,
            _REPO_TO_CLONE: REPO_TO_CLONE,
            _LANGUAGE: LANGUAGE,
            _INSTALLATION_ID: INSTALLATION_ID,
            _CONTAINER: COMMON_CONTAINER_IMAGE,
            _LANGUAGE_CONTAINER: LANGUAGE_CONTAINER,
            _PROJECT_ID: PROJECT_ID,
          },
        },
      })
    );
  });
});
