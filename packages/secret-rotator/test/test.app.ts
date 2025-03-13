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

import * as app from '../src/app';
import fetch from 'node-fetch';
import {SecretRotator} from '../src/secret-rotator';
import sinon, {SinonStub} from 'sinon';
import {describe, it} from 'mocha';
import assert from 'assert';
import * as http from 'http';

const TEST_SERVER_PORT = 8080;

describe('behavior of Cloud Run service', async () => {
  let server: http.Server;
  let rotateSecretStub: SinonStub;

  beforeEach(() => {
    server = app.app.listen(TEST_SERVER_PORT, () => {
      console.log(`Secret-rotator: listening on port ${TEST_SERVER_PORT}`);
    });
    rotateSecretStub = sinon.stub(SecretRotator.prototype, 'rotateSecret');
  });

  afterEach(done => {
    rotateSecretStub.restore();
    server.close(done);
  });

  it('should get 200 when posting, and parse correctly', async () => {
    const response = await fetch(`http://localhost:${TEST_SERVER_PORT}/rotate-service-account-key`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        serviceAccountProjectId: 'test-service-account',
        serviceAccountEmail: 'test-service-account-email',
        secretManagerProjectId: 'test-secret-project-manager-Id',
        secretName: 'test-secret-name',
      }),
    });
    const json = await response.json();

    assert.ok(rotateSecretStub.calledOnce);
    assert.ok(
      rotateSecretStub.calledWith(
        'test-service-account',
        'test-service-account-email',
        'test-secret-project-manager-Id',
        'test-secret-name'
      )
    );
    assert.deepStrictEqual(response.status, 200);
    assert.deepStrictEqual(json, {
      serviceAccountProjectId: 'test-service-account',
      serviceAccountEmail: 'test-service-account-email',
      secretManagerProjectId: 'test-secret-project-manager-Id',
      secretName: 'test-secret-name',
    });
  });

  it('should throw an error if service account is falsy', async () => {
    await assert.rejects(async () => {
      await fetch(`http://localhost:${TEST_SERVER_PORT}/rotate-service-account-key`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          serviceAccountProjectId: '',
          serviceAccountEmail: 'test-service-account-email',
          secretManagerProjectId: 'test-secret-project-manager-Id',
          secretName: 'test-secret-name',
        }),
      }).then(res => {
        throw new Error(`Request failed with status code ${res.status}`);
      });
    }, /Error: Request failed with status code 400/);
  });

  it('should throw an error if service account email is falsy', async () => {
    await assert.rejects(async () => {
      await fetch(`http://localhost:${TEST_SERVER_PORT}/rotate-service-account-key`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          serviceAccountProjectId: 'test-service-account',
          serviceAccountEmail: '',
          secretManagerProjectId: 'test-secret-project-manager-Id',
          secretName: 'test-secret-name',
        }),
      }).then(res => {
        throw new Error(`Request failed with status code ${res.status}`);
      });
    }, /Error: Request failed with status code 400/);
  });

  it('should throw an error if secret manager project ID is falsy', async () => {
    await assert.rejects(async () => {
      await fetch(`http://localhost:${TEST_SERVER_PORT}/rotate-service-account-key`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          serviceAccountProjectId: 'test-service-account',
          serviceAccountEmail: 'test-service-account-email',
          secretManagerProjectId: '',
          secretName: 'test-secret-name',
        }),
      }).then(res => {
        throw new Error(`Request failed with status code ${res.status}`);
      });
    }, /Error: Request failed with status code 400/);
  });

  it('should throw an error if secret name is falsy', async () => {
    await assert.rejects(async () => {
      await fetch(`http://localhost:${TEST_SERVER_PORT}/rotate-service-account-key`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          serviceAccountProjectId: 'test-service-account',
          serviceAccountEmail: 'test-service-account-email',
          secretManagerProjectId: 'test-secret-project-manager-Id',
          secretName: '',
        }),
      }).then(res => {
        throw new Error(`Request failed with status code ${res.status}`);
      });
    }, /Error: Request failed with status code 400/);
  });

  it('should get 404 when calling with any other method', async () => {
    await assert.rejects(async () => {
      await fetch(`http://localhost:${TEST_SERVER_PORT}/`, {
        method: 'GET',
      }).then(res => {
        throw new Error(`Request failed with status code ${res.status}`);
      });
    }, /Error: Request failed with status code 404/);
  });
});
