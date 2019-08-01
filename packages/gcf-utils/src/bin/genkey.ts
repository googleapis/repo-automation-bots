#!/usr/bin/env node
/**
 * Copyright 2019 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fs from 'fs';
import path from 'path';
import commander from 'commander';
import * as KMS from '@google-cloud/kms';
import { Storage, StorageOptions } from '@google-cloud/storage';
import { Base64 } from 'js-base64';
import { Options } from 'probot';
import * as tmp from 'tmp';

commander
    .version('0.0.1')
    .description("Generates a blob with key information for gcf-utils")
    .option('-f, --file <path>', 'Path to .pem file [key.pem]')
    .option('-p, --project <name>', 'Name of gcp project')
    .option('-l, --location <name>', 'Keyring location [global]')
    .option('-r, --keyring <name>', 'Name of keyring [probot-keys]')
    .option('-b, --bot <name>', 'Name of the bot')
    .option('-bu, --bucket <name>', 'Name of the Bucket')
    .option('-i, --id <n>', 'ID of the GitHub Application', parseInt)
    .option('-s, --secret <secret>', 'The webhook secret from GitHub')
    .parse(process.argv);

const keyfile: string = commander.file || 'key.pem';
const project: string = commander.project;
const location: string = commander.location || 'global';
const keyring: string = commander.keyring || 'probot-keys';
const bucketName: string = commander.bucket;
const botname: string = commander.bot;
const webhookSecret: string = commander.secret;
const id: number = commander.id;


if (!project) {
    console.error('Project name is required');
    commander.help();
}
if (!botname) {
    console.error('Name of the bot is required');
    commander.help();
}
if (!webhookSecret) {
    console.error('Webhook secret is required');
    commander.help();
}
if (!id) {
    console.error('GitHub Application ID is required');
    commander.help();
}
if (!bucketName) {
    console.error('Bucket Name is required');
    commander.help();
}

let keyContent: string = '';
try {
    keyContent = fs.readFileSync(keyfile, 'utf8');
} catch (e) {
    console.log(`Error reading file: ${keyfile}`);
    process.exit(1);
}

let blob: Options = {
    cert: keyContent,
    id: id,
    secret: webhookSecret
}

async function run() {
    let encblob: Buffer = Buffer.from('');
    try {
        const opts = project ? { projectId: project } as KMS.v1.KeyManagementServiceClient.ConfigurationObject : undefined;

        const kmsclient = new KMS.KeyManagementServiceClient(opts);

        const name = kmsclient.cryptoKeyPath(
            project,
            location,
            keyring,
            botname
        );

        let plaintext = Base64.encode(JSON.stringify(blob));
        const [kmsresult] = await kmsclient.encrypt({ name, plaintext: plaintext });
        encblob = kmsresult.ciphertext;

    } catch (e) {
        console.error('Got an error encrypting the blob');
        console.error(e);
        process.exit(1);
    }

    const options = (project) ? { project } as StorageOptions : undefined;
    const storage = new Storage(options);

    let tmpobj = tmp.dirSync();
    console.log('Dir: ', tmpobj.name);

    const fileName = path.join(tmpobj.name, botname);

    fs.writeFileSync(fileName, encblob);

    await storage.bucket(bucketName).upload(fileName);
    tmpobj.removeCallback();
}
run();