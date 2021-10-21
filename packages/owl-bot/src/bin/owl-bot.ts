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
import {openPR} from './commands/open-pr';
import {scanConfigs} from './commands/scan-configs';
import {validate} from './commands/validate';
import {enqueueCopyTasks} from './commands/enqueue-copy-tasks';
import {copyExists} from './commands/copy-exists';
import {copyCodeCommand} from './commands/copy-code';
import {copyCodeAndCreatePullRequestCommand} from './commands/copy-code-and-create-pull-request';
import {scanGoogleapisGenAndCreatePullRequestsCommand} from './commands/scan-googleapis-gen-and-create-pull-requests';
import {writeLock} from './commands/write-lock';
import {maybeCreatePullRequestForLockUpdateCommand} from './commands/maybe-create-pull-request-for-lock-update';
import {testWebhook} from './commands/test-webhook';
import {copyCodeIntoPullRequestCommand} from './commands/copy-code-into-pull-request';
import {copyBazelBin} from './commands/copy-bazel-bin';
import {scanAndRetryFailedLockUpdatesCommand} from './commands/scan-and-retry-failed-lock-updates';
import {commitPostProcessorUpdateCommand} from './commands/commit-post-processor-update';

yargs(process.argv.slice(2))
  .command(triggerBuildCommand)
  .command(openPR)
  .command(scanConfigs)
  .command(validate)
  .command(enqueueCopyTasks)
  .command(copyExists)
  .command(copyCodeCommand)
  .command(copyBazelBin)
  .command(scanGoogleapisGenAndCreatePullRequestsCommand)
  .command(copyCodeAndCreatePullRequestCommand)
  .command(writeLock)
  .command(maybeCreatePullRequestForLockUpdateCommand)
  .command(testWebhook)
  .command(copyCodeIntoPullRequestCommand)
  .command(scanAndRetryFailedLockUpdatesCommand)
  .command(commitPostProcessorUpdateCommand)
  .demandCommand(1)
  .strictCommands()
  .parse();
