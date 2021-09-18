// Copyright 2021 Google LLC
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

import {iam_v1} from '@googleapis/iam';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import {logger} from 'gcf-utils';

export class Helper {
  iamClient: iam_v1.Iam;
  secretManagerClient: SecretManagerServiceClient;
  serviceAccountProjectId: string;
  serviceAccountEmail: string;
  secretManagerProjectId: string;
  secretName: string;

  constructor(
    iamClient: iam_v1.Iam,
    secretManagerClient: SecretManagerServiceClient,
    serviceAccountProjectId: string,
    serviceAccountEmail: string,
    secretManagerProjectId: string,
    secretName: string
  ) {
    this.iamClient = iamClient;
    this.secretManagerClient = secretManagerClient;
    this.serviceAccountProjectId = serviceAccountProjectId;
    this.serviceAccountEmail = serviceAccountEmail;
    this.secretManagerProjectId = secretManagerProjectId;
    this.secretName = secretName;
  }

  public async createServiceAccountKey(
    client: iam_v1.Iam,
    serviceAccountProjectId: string,
    serviceAccountEmail: string
  ) {
    const name = `projects/${serviceAccountProjectId}/serviceAccounts/${serviceAccountEmail}`;
    const key = await client.projects.serviceAccounts.keys.create({
      name,
      requestBody: {
        privateKeyType: 'TYPE_GOOGLE_CREDENTIALS_FILE',
      },
    });
    console.log(key.data.privateKeyData);
    if (!key.data.privateKeyData) {
      throw new Error('unable to return data');
    }
    return Buffer.from(key.data.privateKeyData, 'base64');
  }

  public async deleteExpiredServiceAccountKeys(
    client: iam_v1.Iam,
    serviceAccountProjectId: string,
    serviceAccountEmail: string
  ) {
    const name = `projects/${serviceAccountProjectId}/serviceAccounts/${serviceAccountEmail}`;
    const keys = await client.projects.serviceAccounts.keys.list({
      name,
    });
    if (keys.data['keys']) {
      for (const key of keys.data['keys']) {
        if (
          key.name &&
          key.validBeforeTime &&
          new Date(key.validBeforeTime).getTime() <
            new Date(Date.now()).getTime()
        ) {
          logger.info(
            `deleting expired keys for ${serviceAccountEmail}: ${key.name}`
          );
          await client.projects.serviceAccounts.keys.delete({name: key.name});
        }
      }
    }
  }

  public async updateSecret(
    secretsClient: SecretManagerServiceClient,
    secretManagerProjectId: string,
    secretName: string,
    data: Buffer
  ) {
    const parent = `projects/${secretManagerProjectId}/secrets/${secretName}`;
    const [version] = await secretsClient.addSecretVersion({
      parent,
      payload: {
        data,
      },
    });
    return version.name;
  }

  public async rotateSecret(
    serviceAccountProjectId: string,
    serviceAccountEmail: string,
    secretManagerProjectId: string,
    secretName: string
  ) {
    logger.info(
      `creating new key for service account: ${serviceAccountEmail} (${serviceAccountProjectId})`
    );

    const serviceAccountKey = await this.createServiceAccountKey(
      this.iamClient,
      serviceAccountProjectId,
      serviceAccountEmail
    );
    logger.info(`updating secret: ${secretName} (${secretManagerProjectId})`);

    const version = await this.updateSecret(
      this.secretManagerClient,
      secretManagerProjectId,
      secretName,
      serviceAccountKey
    );
    logger.info(`updated secret: ${version}`);

    await this.deleteExpiredServiceAccountKeys(
      this.iamClient,
      serviceAccountProjectId,
      serviceAccountEmail
    );
  }
}
