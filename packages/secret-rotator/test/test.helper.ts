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

import {SecretRotator} from '../src/secret-rotator';
import sinon, {SinonStubbedInstance} from 'sinon';
import {describe, it} from 'mocha';
import {iam_v1} from '@googleapis/iam';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import assert from 'assert';

const secretManagerClientStub = sinon.createStubInstance(
  SecretManagerServiceClient
) as SinonStubbedInstance<SecretManagerServiceClient> &
  SecretManagerServiceClient;

secretManagerClientStub.addSecretVersion.resolves([{name: 'hello'}]);

// Because of how IAM is structured, sinon gives this error when using createStubInstance:
// Error: Expected to stub methods on object but found none
// So, creating the stubs myself

const iamClientStubNoKey = {
  projects: {
    serviceAccounts: {
      keys: {
        create: () => {
          return {
            data: {
              privateKeyData: undefined,
            },
          };
        },
      },
    },
  },
} as unknown as iam_v1.Iam;

const iamClientStubListAndDelete = {
  projects: {
    serviceAccounts: {
      keys: {
        list: () => {
          return {
            data: {
              keys: [
                {
                  name: 'test-result-1',
                  privateKeyData: 'test-result-1',
                  validBeforeTime: '3000-05-24T17:53:22Z',
                },
                {
                  name: 'test-result-2',
                  privateKeyData: 'test-result-2',
                  validBeforeTime: '2021-05-24T17:53:22Z',
                },
              ],
            },
          };
        },
        delete: () => {
          return;
        },
      },
    },
  },
} as unknown as iam_v1.Iam;

const iamClientStubList = {
  projects: {
    serviceAccounts: {
      keys: {
        list: () => {
          return {
            data: {
              keys: [
                {
                  name: 'test-result-1',
                  privateKeyData: 'test-result-1',
                  validBeforeTime: '3000-05-24T17:53:22Z',
                },
                {
                  name: 'test-result-2',
                  privateKeyData: 'test-result-2',
                  validBeforeTime: '2021-05-24T17:53:22Z',
                },
              ],
            },
          };
        },
      },
    },
  },
} as unknown as iam_v1.Iam;

const iamClientStubCreate = {
  projects: {
    serviceAccounts: {
      keys: {
        create: () => {
          return {
            data: {
              privateKeyData: 'testResult',
            },
          };
        },
      },
    },
  },
} as unknown as iam_v1.Iam;

describe('behavior of helper functions', async () => {
  it('should return the right name when creating a service account key', async () => {
    const helper = new SecretRotator(
      iamClientStubCreate,
      secretManagerClientStub
    );

    const response = await helper.createServiceAccountKey(
      iamClientStubCreate,
      'test-service-account',
      'test-service-account-email'
    );

    const result = Buffer.from('testResult', 'base64');
    assert.deepStrictEqual(result, response);
  });

  it('should throw if there is no key', async () => {
    const helper = new SecretRotator(
      iamClientStubNoKey,
      secretManagerClientStub
    );

    assert.rejects(async () => {
      await helper.createServiceAccountKey(
        iamClientStubNoKey,
        'test-service-account',
        'test-service-account-email'
      );
    });
  });

  it('should return the correct secret', async () => {
    const helper = new SecretRotator(
      iamClientStubCreate,
      secretManagerClientStub
    );

    const buff = Buffer.from('testResult', 'base64');

    const response = await helper.updateSecret(
      secretManagerClientStub,
      'test-secret-project-manager-Id',
      'test-secret-name',
      buff
    );

    assert.deepStrictEqual(response, 'hello');
  });

  it('should delete any expired keys', async () => {
    const helper = new SecretRotator(
      iamClientStubListAndDelete,
      secretManagerClientStub
    );

    // Avoiding using spies because of complicated dependency injections.
    // Instead, here I'm checking that we do not throw an error in the iamClientStub
    // that has a deletion mechanism, and checking that we do throw an error on the same
    // list if there isn't a deletion mechanism (indicating that we needed to delete, but
    // couldn't)
    assert.strictEqual(
      await helper.deleteExpiredServiceAccountKeys(
        iamClientStubListAndDelete,
        'test-service-account',
        'test-service-account-email'
      ),
      undefined
    );

    assert.rejects(async () => {
      await helper.createServiceAccountKey(
        iamClientStubList,
        'test-service-account',
        'test-service-account-email'
      );
    });
  });
});
