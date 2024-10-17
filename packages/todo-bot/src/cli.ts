#!/usr/bin/env node

// Copyright 2022 Google LLC
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

import * as yargs from 'yargs';
import {AnnotationScanner} from './scanner';

interface Flags {
  owner: string;
  repo: string;
  branch: string;
  annotation: string[];
}

const defaultCommand: yargs.CommandModule<{}, Flags> = {
  command: 'scan',
  describe: 'Scan a repository for annotations',
  builder(yargs) {
    return yargs
      .option('owner', {
        describe: 'Repository owner',
        type: 'string',
        required: true,
      })
      .option('repo', {
        describe: 'Repository name',
        type: 'string',
        required: true,
      })
      .option('branch', {
        describe: 'Branch to snan',
        type: 'string',
        required: false,
        default: 'main',
      })
      .option('annotation', {
        describe: 'Annotation to scan for',
        type: 'string',
        array: true,
        default: ['TODO'],
      });
  },
  async handler(argv) {
    const scanner = new AnnotationScanner(argv.owner, argv.repo, argv.branch);
    const foundAnnotations = await scanner.findAnnotations(argv.annotation);
    console.log(`found ${foundAnnotations.length} annotations`, foundAnnotations);
  },
};

export const parser = yargs
  .command(defaultCommand)
  .strict(true)
  .scriptName('todo-bot');

if (module === require.main) {
  (async () => {
    await parser.parseAsync();
    process.on('unhandledRejection', console.error);
    process.on('uncaughtException', console.error);
  })();
}
