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

import {v1 as SecretManagerV1} from '@google-cloud/secret-manager';
import {SecretLoader, BotSecrets} from './secret-loader';

interface GoogleSecretOptions {
  secretsClient?: SecretManagerV1.SecretManagerServiceClient;
}

export class GoogleSecretLoader implements SecretLoader {
  private projectId: string;
  private secretsClient: SecretManagerV1.SecretManagerServiceClient;

  constructor(projectId: string, options: GoogleSecretOptions = {}) {
    this.projectId = projectId;
    this.secretsClient =
      options.secretsClient ??
      new SecretManagerV1.SecretManagerServiceClient({
        fallback: 'rest',
      });
  }

  async load(botName: string): Promise<BotSecrets> {
    const [version] = await this.secretsClient.accessSecretVersion({
      name: `projects/${this.projectId}/secrets/${botName}/versions/latest`,
    });
    // Extract the payload as a string.
    const payload = version?.payload?.data?.toString() || '';
    if (payload === '') {
      throw Error('did not retrieve a payload from SecretManager.');
    }
    const secrets = JSON.parse(payload);

    const privateKey = secrets.privateKey ?? secrets.cert;
    const appId = secrets.appId ?? secrets.id;
    const webhookSecret = secrets.webhookSecret ?? secrets.secret;
    return {
      privateKey: privateKey,
      appId: appId,
      webhookSecret: webhookSecret,
    };
  }
}
