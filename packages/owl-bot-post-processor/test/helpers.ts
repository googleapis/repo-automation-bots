/* eslint-disable @typescript-eslint/no-explicit-any */
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
import * as assert from 'assert';
import {helpers} from '../src/helpers';
// eslint-disable-next-line node/no-unpublished-import
import * as sinon from 'sinon';
// eslint-disable-next-line node/no-unpublished-import
import {describe, it, beforeEach, afterEach} from 'mocha';

import * as protos from '@google-cloud/cloudbuild/build/protos/protos';
import {CloudBuildClient} from '@google-cloud/cloudbuild';
import {Octokit} from '@octokit/rest';

const sandbox = sinon.createSandbox();

describe('helpers', () => {
  beforeEach(() => {
    const prData = {
      data: {
        head: {
          ref: 'my-feature-branch',
          repo: {
            full_name: 'bcoe/example',
          },
        },
      },
    };
    sandbox.stub(helpers, 'getToken').resolves({
      token: 'abc123',
      expires_at: '2021-01-13T23:37:43.707Z',
      permissions: {},
      repository_selection: 'included',
    });
    sandbox.stub(helpers, 'getAuthenticatedOctokit').resolves(({
      pulls: {
        get() {
          return prData;
        },
      },
    } as any) as InstanceType<typeof Octokit>);
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe('getAccessTokenURL', () => {
    it('returns URI for token endpoint', () => {
      const uri = helpers.getAccessTokenURL('12345');
      assert.strictEqual(
        uri,
        'https://api.github.com/app/installations/12345/access_tokens'
      );
    });
  });
  describe('triggerBuild', () => {
    it('returns with success if build succeeds', async () => {
      const successfulBuild = {
        status: 'SUCCESS',
        steps: [
          {
            status: 'SUCCESS',
            name: 'foo step',
          },
        ],
      };
      let triggerRequest:
        | protos.google.devtools.cloudbuild.v1.IRunBuildTriggerRequest
        | undefined = undefined;
      sandbox.stub(helpers, 'getCloudBuildInstance').returns(({
        runBuildTrigger(
          request: protos.google.devtools.cloudbuild.v1.IRunBuildTriggerRequest
        ) {
          triggerRequest = request;
          return [
            {
              metadata: {
                build: {
                  id: 'abc123',
                },
              },
            },
          ];
        },
        getBuild() {
          return [successfulBuild];
        },
      } as any) as CloudBuildClient);
      const build = await helpers.triggerBuild({
        'app-id': 12345,
        'pem-path': './fake.pem',
        installation: '12345',
        repo: 'bcoe/example',
        pr: '99',
        project: 'fake-project',
        trigger: 'abc123',
      });
      assert.ok(triggerRequest);
      assert.strictEqual(build.conclusion, 'success');
      assert.strictEqual(build.summary, 'successfully ran 1 steps 🎉!');
    });
    it('returns with failure if build fails', async () => {
      const successfulBuild = {
        status: 'FAILURE',
        steps: [
          {
            status: 'FAILURE',
            name: 'foo step',
          },
        ],
      };
      let triggerRequest:
        | protos.google.devtools.cloudbuild.v1.IRunBuildTriggerRequest
        | undefined = undefined;
      sandbox.stub(helpers, 'getCloudBuildInstance').returns(({
        runBuildTrigger(
          request: protos.google.devtools.cloudbuild.v1.IRunBuildTriggerRequest
        ) {
          triggerRequest = request;
          return [
            {
              metadata: {
                build: {
                  id: 'abc123',
                },
              },
            },
          ];
        },
        getBuild() {
          return [successfulBuild];
        },
      } as any) as CloudBuildClient);
      const build = await helpers.triggerBuild({
        'app-id': 12345,
        'pem-path': './fake.pem',
        installation: '12345',
        repo: 'bcoe/example',
        pr: '99',
        project: 'fake-project',
        trigger: 'abc123',
      });
      assert.ok(triggerRequest);
      assert.strictEqual(build.conclusion, 'failure');
      assert.strictEqual(build.summary, '1 steps failed 🙁');
    });
  });
});
