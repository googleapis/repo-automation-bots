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
import assert from 'assert';
import * as runTrigger from '../run-trigger';
import * as runTriggerCommand from '../run-trigger-command';
import {describe, it} from 'mocha';

// Trigger ID in gcp
const TRIGGER_ID = 'owlbot-bootstrapper-trigger';
// Installation ID for owlbot-bootstrapper on googleapis/
const INSTALLATION_ID = '123456';
const PROJECT_ID = 'owlbot-bootstrap-prod';
const COMMON_CONTAINER_IMAGE = `us-docker.pkg.dev/${PROJECT_ID}/owlbot-bootstrapper-images/owlbot-bootstrapper:latest`;
const API_ID = 'google.cloud.kms.v1';
const REPO_TO_CLONE = 'github.com/soficodes/nodejs-kms.git';
const LANGUAGE_CONTAINER = 'gcr.io/myproject/myimage:latest';
const LANGUAGE = 'nodejs';

describe('tests running build trigger', () => {
  let cloudBuildClientStub: SinonStubbedInstance<CloudBuildClient> &
    CloudBuildClient;

  beforeEach(() => {
    cloudBuildClientStub = sinon.createStubInstance(
      CloudBuildClient
    ) as SinonStubbedInstance<CloudBuildClient> & CloudBuildClient;

    cloudBuildClientStub.runBuildTrigger.resolves([
      {
        promise: () => Promise.resolve(),
      },
    ]);
  });

  afterEach(() => {
    cloudBuildClientStub.runBuildTrigger.restore();
  });

  it('it should get correct variable names', async () => {
    await runTrigger.runTrigger(
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

  it('should get correct corresponding values if absent', async () => {
    await runTrigger.runTrigger(
      {
        projectId: PROJECT_ID,
        triggerId: TRIGGER_ID,
        installationId: INSTALLATION_ID,
        apiId: API_ID,
        language: 'nodejs',
      },
      cloudBuildClientStub,
      {
        language: 'nodejs',
        languageContainerInArtifactRegistry: `us-docker.pkg.dev/${PROJECT_ID}/owlbot-bootstrapper-images/node-bootstrapper:latest`,
        repoToClone: 'git@github.com/googleapis/google-cloud-node.git',
      }
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
            _REPO_TO_CLONE: 'git@github.com/googleapis/google-cloud-node.git',
            _LANGUAGE: LANGUAGE,
            _INSTALLATION_ID: INSTALLATION_ID,
            _CONTAINER: `us-docker.pkg.dev/${PROJECT_ID}/owlbot-bootstrapper-images/owlbot-bootstrapper:latest`,
            _LANGUAGE_CONTAINER: `us-docker.pkg.dev/${PROJECT_ID}/owlbot-bootstrapper-images/node-bootstrapper:latest`,
            _PROJECT_ID: PROJECT_ID,
          },
        },
      })
    );
  });

  it('throws an error if a language container is not provided by default', () => {
    assert.throws(() => {
      runTriggerCommand.getLanguageSpecificValues('python');
    }, /Error: No language-specific container specified/);
  });

  it('returns the correct language specific values', () => {
    assert.deepStrictEqual(
      runTriggerCommand.getLanguageSpecificValues('nodejs'),
      {
        language: 'nodejs',
        languageContainerInArtifactRegistry:
          'us-docker.pkg.dev/owlbot-bootstrap-prod/owlbot-bootstrapper-images/node-bootstrapper:latest',
        repoToClone: 'git@github.com/googleapis/google-cloud-node.git',
      }
    );
  });
});
