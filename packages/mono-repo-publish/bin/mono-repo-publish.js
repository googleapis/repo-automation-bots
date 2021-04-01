#!/usr/bin/env node

// Copyright 2021 Google LLC
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

const yargs = require('yargs');
const core = require('../src/main.js');
// Get testing repo that touches submodules that we would want to publish
// Once we have the list, actually calling npm publish on those modules
yargs.usage('$0', 'publish packages affected by a pull request', () => {}, async (argv) => {
  const pr = core.parseURL(argv.prUrl);
  const octokit = core.getOctokitInstance();
  const files = await core.getsPRFiles(pr, octokit);
  const submodules = core.listChangedSubmodules(files);
  core.publishSubmodules(submodules, argv.dryRun);
})
  .option('pr-url', { description: 'the URL of the GH PR for submodules you wish to publish, e.g., https://github.com/googleapis/release-please/pull/707', type: 'string', demand: true })
  .option('dry-run', { description: 'whether or not to publish in dry run', type: 'boolean', default: false })
  .parse();
