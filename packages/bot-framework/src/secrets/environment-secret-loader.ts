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

import {SecretLoader, BotSecrets} from './secret-loader';
import fs from 'fs';

export class EnvironmentSecretLoader implements SecretLoader {
  async load(botName: string): Promise<BotSecrets> {
    const webhookSecret = process.env.WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error(
        'Need to specify webhook secret via WEBHOOK_SECRET env variable.'
      );
    }
    const appId = process.env.APP_ID;
    if (!appId) {
      throw new Error('Need to specify GitHub app ID via APP_ID env variable.');
    }
    const privateKey = process.env.PRIVATE_KEY_PATH
      ? fs.readFileSync(process.env.PRIVATE_KEY_PATH).toString('utf-8')
      : process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error(
        'Need to specify private key via PRIVATE_KEY_PATH or PRIVATE_KEY env variable.'
      );
    }
    return {
      webhookSecret,
      appId,
      privateKey,
    };
  }
}
