#!/usr/bin/env node
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

import * as yargs from 'yargs';
import {SecretRotator} from './secret-rotator';
import {iam, auth as authlibv7} from '@googleapis/iam';
import * as authlibv8 from 'google-auth-library';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';

interface RotateSecretArgs {
  'secret-name': string;
  'secret-project-id': string;
  'service-account-email': string;
  'service-account-project-id': string;
}

const rotateSecretCommand: yargs.CommandModule<{}, RotateSecretArgs> = {
  command: 'rotate-secret',
  describe: 'Rotate a secret',
  builder(yargs) {
    return yargs
      .option('secret-name', {
        describe: 'The name of the secret to rotate',
        demand: true,
        type: 'string',
      })
      .option('secret-project-id', {
        describe: 'The project ID that contains the secret',
        demand: true,
        type: 'string',
      })
      .option('service-account-email', {
        describe: 'The service account email address',
        demand: true,
        type: 'string',
      })
      .option('service-account-project-id', {
        describe: 'The project ID that contains the service account',
        demand: true,
        type: 'string',
      });
  },
  async handler(argv) {
    const authv7 = new authlibv7.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const authv8 = new authlibv8.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const iamClient = await iam({
      version: 'v1',
      auth: authv7,
    });
    const secretManagerClient = new SecretManagerServiceClient({
      auth: authv8,
      fallback: 'rest',
    });

    const secretRotator = new SecretRotator(iamClient, secretManagerClient);
    await secretRotator.rotateSecret(
      argv['service-account-project-id'],
      argv['service-account-email'],
      argv['secret-project-id'],
      argv['secret-name']
    );
  },
};

export const parser = yargs
  .command(rotateSecretCommand)
  .demandCommand(1)
  .strict(true)
  .scriptName('secret-rotator');

// Only run parser if executed with node bin, this allows
// for the parser to be easily tested:
if (require.main === module) {
  (async () => {
    await parser.parseAsync();
  })();
}
