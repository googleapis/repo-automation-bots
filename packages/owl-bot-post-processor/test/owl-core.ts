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
import {core} from '../src/core';
import * as sinon from 'sinon';
import {describe, it, beforeEach, afterEach} from 'mocha';

import * as protos from '@google-cloud/cloudbuild/build/protos/protos';
import {CloudBuildClient} from '@google-cloud/cloudbuild';
import {Octokit} from '@octokit/rest';

const sandbox = sinon.createSandbox();

describe('core', () => {
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
    sandbox.stub(core, 'getGitHubShortLivedAccessToken').resolves({
      token: 'abc123',
      expires_at: '2021-01-13T23:37:43.707Z',
      permissions: {},
      repository_selection: 'included',
    });
    sandbox.stub(core, 'getAuthenticatedOctokit').resolves(({
      pulls: {
        get() {
          return prData;
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any) as InstanceType<typeof Octokit>);
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe('getAccessTokenURL', () => {
    it('returns URI for token endpoint', () => {
      const uri = core.getAccessTokenURL(12345);
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
      sandbox.stub(core, 'getCloudBuildInstance').returns(({
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as CloudBuildClient);
      const build = await core.triggerBuild({
        image: 'node@abc123',
        appId: 12345,
        privateKey: 'abc123',
        installation: 12345,
        repo: 'bcoe/example',
        pr: 99,
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
      sandbox.stub(core, 'getCloudBuildInstance').returns(({
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as CloudBuildClient);
      const build = await core.triggerBuild({
        image: 'node@abc123',
        appId: 12345,
        privateKey: 'abc123',
        installation: 12345,
        repo: 'bcoe/example',
        pr: 99,
        project: 'fake-project',
        trigger: 'abc123',
      });
      assert.ok(triggerRequest);
      assert.strictEqual(build.conclusion, 'failure');
      assert.strictEqual(build.summary, '1 steps failed 🙁');
    });
  });
  describe('getOwlBotLock', () => {
    it('reads .OwlBot.lock.yaml and returns parsed YAML', async () => {
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
      const config = `docker:
  image: node
  digest: sha256:9205bb385656cd196f5303b03983282c95c2dfab041d275465c525b501574e5c`;
      const content = {
        data: {
          content: Buffer.from(config, 'utf8').toString('base64'),
          encoding: 'base64',
        },
      };
      const octokit = ({
        pulls: {
          get() {
            return prData;
          },
        },
        repos: {
          getContent() {
            return content;
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as InstanceType<typeof Octokit>;
      const lock = await core.getOwlBotLock('bcoe/test', 22, octokit);
      assert.strictEqual(lock.docker.image, 'node');
      assert.strictEqual(
        lock.docker.digest,
        'sha256:9205bb385656cd196f5303b03983282c95c2dfab041d275465c525b501574e5c'
      );
    });
    it('throws error if config is invalid', async () => {
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
      const config = `no-docker-key:
      image: node
      digest: sha256:9205bb385656cd196f5303b03983282c95c2dfab041d275465c525b501574e5c`;
      const content = {
        data: {
          content: Buffer.from(config, 'utf8').toString('base64'),
          encoding: 'base64',
        },
      };
      const octokit = ({
        pulls: {
          get() {
            return prData;
          },
        },
        repos: {
          getContent() {
            return content;
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) as InstanceType<typeof Octokit>;
      assert.rejects(async () => {
        await core.getOwlBotLock('bcoe/test', 22, octokit);
      }, /batman/);
    });
  });
});
