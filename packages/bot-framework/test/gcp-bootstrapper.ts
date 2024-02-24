// Copyright 2023 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {describe, afterEach, it} from 'mocha';
import sinon from 'sinon';
import nock from 'nock';
import {RestoreFn} from 'mocked-env';
import mockedEnv from 'mocked-env';
import assert from 'assert';
import {GCPBootstrapper} from '../src/gcp-bootstrapper';
import {MockSecretLoader} from './helpers';
import {GoogleSecretLoader} from '../src/secrets/google-secret-loader';

nock.disableNetConnect();
const sandbox = sinon.createSandbox();

describe('GCPBootstrapper', () => {
  let restoreEnv: RestoreFn | null;
  afterEach(() => {
    sandbox.restore();
    if (restoreEnv) {
      restoreEnv();
      restoreEnv = null;
    }
  });

  describe('load', () => {
    it('requires a project id', async () => {
      await assert.rejects(
        async () => {
          await GCPBootstrapper.load({});
        },
        e => {
          return (e as Error).message.includes('PROJECT_ID');
        }
      );
    });
    it('requires a bot name', async () => {
      await assert.rejects(
        async () => {
          await GCPBootstrapper.load({
            projectId: 'my-project',
          });
        },
        e => {
          return (e as Error).message.includes('GCF_SHORT_FUNCTION_NAME');
        }
      );
    });
    it('requires a location', async () => {
      await assert.rejects(
        async () => {
          await GCPBootstrapper.load({
            projectId: 'my-project',
            botName: 'my-bot-name',
          });
        },
        e => {
          return (e as Error).message.includes('GCF_LOCATION');
        }
      );
    });
    it('detects from env var', async () => {
      restoreEnv = mockedEnv({
        GCF_SHORT_FUNCTION_NAME: 'my-bot-name',
        GCF_LOCATION: 'my-location',
        PROJECT_ID: 'my-project',
      });
      const bootstrapper = await GCPBootstrapper.load({
        secretLoader: new MockSecretLoader(),
      });
      assert.ok(bootstrapper);
    });
    it('loads secrets from Secret Manager', async () => {
      sandbox.stub(GoogleSecretLoader.prototype, 'load').resolves({
        privateKey: 'my-private-key',
        webhookSecret: 'my-webhook-secret',
        appId: '123456',
      });
      const bootstrapper = await GCPBootstrapper.load({
        projectId: 'my-project',
        botName: 'my-bot-name',
        location: 'my-location',
      });
      assert.ok(bootstrapper);
    });
  });
});
