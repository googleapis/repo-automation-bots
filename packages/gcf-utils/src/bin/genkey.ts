#!/usr/bin/env node
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
import path from 'path';
import * as yargs from 'yargs';
import { Argv } from 'yargs';
import * as KMS from '@google-cloud/kms';
import { Storage, StorageOptions } from '@google-cloud/storage';
import { Base64 } from 'js-base64';
import { Options } from 'probot';
import * as tmp from 'tmp';

const argv = yargs.command(
  'gen',
  'Create and upload a client key.',
  (yargs: Argv) => {
    return yargs
      .option('keyfile', {
        describe: 'The path to the .pem keyfile',
        type: 'string',
        default: 'key.pem',
      })
      .option('verbose', {
        alias: 'v',
        default: false,
        type: 'boolean',
      })
      .option('project', {
        describe: 'Name of GCP project',
        alias: 'p',
        type: 'string',
        demand: true,
      })
      .option('location', {
        alias: 'l',
        desription: 'Keyring location',
        type: 'string',
        default: 'global',
      })
      .option('bot', {
        alias: 'b',
        type: 'string',
        description: 'Name of the bot',
      })
      .option('bucket', {
        alias: 'bu',
        type: 'string',
        description: 'Name of the Bucket',
      })
      .option('id', {
        alias: 'i',
        type: 'string',
        description: 'ID of the GitHub Application',
      })
      .option('secret', {
        alias: 's',
        type: 'string',
        description: 'Webhook Secret of the GitHub Application',
      });
  }
).argv;

const keyfile: string = (argv.keyfile as string) || 'key.pem';
const project: string = argv.project as string;
const location: string = (argv.location as string) || 'global';
const keyring: string = (argv.keyring as string) || 'probot-keys';
const bucketName: string = argv.bucket as string;
const botname: string = argv.bot as string;
const webhookSecret: string = argv.secret as string;
const id: number = argv.id as number;

if (!project) {
  console.error('Project name is required');
  yargs.showHelp();
  process.exit(1);
}
if (!botname) {
  console.error('Name of the bot is required');
  yargs.showHelp();
  process.exit(1);
}
if (!webhookSecret) {
  console.error('Webhook secret is required');
  yargs.showHelp();
  process.exit(1);
}
if (!id) {
  console.error('GitHub Application ID is required');
  yargs.showHelp();
  process.exit(1);
}
if (!bucketName) {
  console.error('Bucket Name is required');
  yargs.showHelp();
  process.exit(1);
}

let keyContent = '';
try {
  keyContent = fs.readFileSync(keyfile, 'utf8');
} catch (e) {
  console.log(`Error reading file: ${keyfile}`);
  process.exit(1);
}

const blob: Options = {
  cert: keyContent,
  id,
  secret: webhookSecret,
};

async function run() {
  let encblob: Buffer = Buffer.from('');

  const opts = project
    ? ({
        projectId: project,
      } as KMS.v1.KeyManagementServiceClient.ConfigurationObject)
    : undefined;

  const kmsclient = new KMS.KeyManagementServiceClient(opts);

  const name = kmsclient.cryptoKeyPath(project, location, keyring, botname);

  const plaintext = Buffer.from(JSON.stringify(blob), 'utf-8');
  const [kmsresult] = await kmsclient.encrypt({ name, plaintext });
  encblob = kmsresult.ciphertext;

  const options = project ? ({ project } as StorageOptions) : undefined;
  const storage = new Storage(options);

  const tmpobj = tmp.dirSync();
  console.log('Dir: ', tmpobj.name);

  const fileName = path.join(tmpobj.name, botname);

  fs.writeFileSync(fileName, encblob);

  await storage.bucket(bucketName).upload(fileName);
  tmpobj.removeCallback();
}
run();
