// Copyright 2020 Google LLC
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

import {create} from '../src/bin/genkey-util';
import {describe, beforeEach, afterEach, it} from 'mocha';
import {Options} from 'probot';
import sinon from 'sinon';
import {v1} from '@google-cloud/secret-manager';

describe('genkey', () => {
  describe('run', () => {
    let secretClientStub: v1.SecretManagerServiceClient;
    let createSecretStub: sinon.SinonStub;
    let addSecretVersionStub: sinon.SinonStub;
    let opts: Options;
    let botname: string;
    let project: string;

    beforeEach(() => {
      project = 'my';
      botname = 'foo';
      secretClientStub = new v1.SecretManagerServiceClient();

      createSecretStub = sinon
        .stub(secretClientStub, 'createSecret')
        .callsFake(() => {
          return Promise.resolve([
            {
              name: 'foo',
            },
          ]);
        });

      addSecretVersionStub = sinon
        .stub(secretClientStub, 'addSecretVersion')
        .callsFake(() => {
          return Promise.resolve([
            {
              name: 'foo/bar',
            },
          ]);
        });
    });

    afterEach(() => {
      createSecretStub.reset();
      addSecretVersionStub.reset();
      botname = '';
      opts = {};
      project = '';
    });

    it('creates secrets', async () => {
      opts = {
        privateKey: 'asdf',
        appId: 12345,
        secret: 'zxcv',
      };

      await create(secretClientStub, project, botname, opts);
      sinon.assert.calledOnceWithExactly(createSecretStub, {
        parent: 'projects/my',
        secretId: 'foo',
        secret: {
          replication: {
            automatic: {},
          },
        },
      });
      sinon.assert.calledOnceWithExactly(addSecretVersionStub, {
        parent: 'foo',
        payload: {
          data: Buffer.from(JSON.stringify(opts)),
        },
      });
    });
  });
});
