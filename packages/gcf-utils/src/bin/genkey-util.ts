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

import {promises as fs} from 'fs';
import {Options} from 'probot';
import {v1} from '@google-cloud/secret-manager';

/// gather gets the key from the specified keyfile
// and returns a probot.Options object
export async function gather(
  keyfile: string,
  id: number,
  webhookSecret: string
): Promise<Options> {
  let keyContent = '';
  // Propagate exceptions up
  keyContent = await fs.readFile(keyfile, 'utf8');

  return {
    privateKey: keyContent,
    appId: id,
    secret: webhookSecret,
  };
}

// create takes the given Options and creates
// a Google Cloud Secret Manager Secret
// whose name is the Bot and whose Secret Version
// is a stringified version of the given blob
export async function create(
  smclient: v1.SecretManagerServiceClient,
  project: string,
  botname: string,
  blob: Options
) {
  const [secret] = await smclient.createSecret({
    parent: `projects/${project}`,
    secretId: botname,
    secret: {
      replication: {
        automatic: {},
      },
    },
  });

  const [version] = await smclient.addSecretVersion({
    parent: secret.name,
    payload: {
      data: Buffer.from(JSON.stringify(blob)),
    },
  });

  console.log(`Created secret ${version.name}`);
}
