#!/usr/bin/env node
// Copyright 2021 Google LLC
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

import yargs = require('yargs');
import {triggerBuildCommand} from './commands/trigger-build';
import {listReposCommand} from './commands/list-repos-affected-by-docker-image';
import {openPR} from './commands/open-pr';
import {scanConfigs} from './commands/scan-configs';
yargs(process.argv.slice(2))
  .command(triggerBuildCommand)
  .command(listReposCommand)
  .command(openPR)
  .command(scanConfigs)
  .demandCommand(1)
  .strictCommands()
  .parse();
