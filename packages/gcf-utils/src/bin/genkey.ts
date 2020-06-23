#!/usr/bin/env node
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

import * as yargs from 'yargs';
import {Argv} from 'yargs';
import {v1} from '@google-cloud/secret-manager';
import {create, gather} from './genkey-util';

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
      .option('bot', {
        alias: 'b',
        type: 'string',
        demand: true,
        description: 'Name of the bot',
      })
      .option('id', {
        alias: 'i',
        type: 'string',
        demand: true,
        description: 'ID of the GitHub Application',
      })
      .option('secret', {
        alias: 's',
        type: 'string',
        demand: true,
        description: 'Webhook Secret of the GitHub Application',
      });
  }
).argv;

const keyfile = argv.keyfile || 'key.pem';
const project = argv.project as string;
const botname = argv.bot!;
const webhookSecret = argv.secret;
const id = Number(argv.id);

async function run(
  keyfile: string,
  webhookSecret: string,
  id: number,
  project: string,
  botname: string
) {
  const blob = await gather(keyfile, id, webhookSecret);
  const opts = project
    ? {
        projectId: project,
      }
    : undefined;
  const smclient = new v1.SecretManagerServiceClient(opts);
  await create(smclient, project, botname, blob);
}

run(keyfile, webhookSecret, id, project, botname);
