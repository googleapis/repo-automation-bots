// Copyright 2024 Google LLC
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

export interface BotSecrets {
  privateKey: string;
  appId: number;
  webhookSecret: string;
}

interface BotSecretJsonContents {
  cert?: string; // legacy key, use privateKey instead
  privateKey: string;
  id?: number; // legacy key, use appId instead
  appId: number;
  secret?: string; // legacy key, use webhookSecret instead
  webhookSecret: string;
}

export function parseBotSecrets(secretsJson: string): BotSecrets {
  const secrets = JSON.parse(secretsJson) as BotSecretJsonContents;

  const privateKey = secrets.privateKey ?? secrets.cert;
  const appId = secrets.appId ?? secrets.id;
  const webhookSecret = secrets.webhookSecret ?? secrets.secret;
  return {
    privateKey: privateKey,
    appId: appId,
    webhookSecret: webhookSecret,
  };
}