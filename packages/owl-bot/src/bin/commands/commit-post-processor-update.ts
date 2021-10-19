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

// Invoked by update-pr.yaml to commit changes to an open pull request after
// the post processor runs.
//
// This used to be a simple "git commit ...", but the addition of the
// squash flag in .OwlBot.yaml makes it more complicated.  When squash
// is true and the most recent commit was a copy from googleapis-gen, then
// we want to squash the changes made by the post processor.

import yargs = require('yargs');
import {commitAndPushPostProcessorUpdate} from '../../commit-post-processor-update';

export const commitPostProcessorUpdateCommand: yargs.CommandModule<{}, {}> = {
  command: 'commit-post-processor-update',
  describe:
    'Runs either `git commit -m "Updates from OwlBot"` or ' +
    '`git commit --amend --no-edit`\n' +
    'depending on the squash flag in .OwlBot.yaml.\n\n' +
    'Run this command in the root directory of a client library repository ' +
    'after running the post processor.',
  handler: () => commitAndPushPostProcessorUpdate(),
};
