#!/usr/bin/env node

// Copyright 2022 Google LLC
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

// This file will be run manually, or when owlbot-bootstrapper
// is wired up to respond to github webhook events that indicate
// changes to the googleapis/googleapis/apiindex.json file. This file
// is the CLI entrypoint to run googleapis-bootstrapper when kicking off
// the process manually. It then calls run-trigger, which kicks off the build.

import yargs = require('yargs');
import {runTriggerCommand} from './run-trigger-command';

yargs(process.argv.slice(2))
  .command(runTriggerCommand)
  .demandCommand(1)
  .parse();
