// Copyright 2019 Google LLC
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

import fs from 'fs';
import { Options } from 'probot';
import { v1 } from '@google-cloud/secret-manager';

export async function gather(keyfile: string, id: number, webhookSecret: string): Promise<Options> {
    let keyContent = '';
    try {
        keyContent = fs.readFileSync(keyfile, 'utf8');
    } catch (e) {
        throw Error(`Error reading file: ${keyfile}`);
    }

    const blob: Options = {
        cert: keyContent,
        id,
        secret: webhookSecret,
    };
    return blob;
}

export async function create(smclient: v1.SecretManagerServiceClient, project: string, botname: string, blob: Options) {
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