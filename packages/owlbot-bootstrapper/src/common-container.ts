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

import {execSync} from 'child_process';
import { isMonoRepo, cloneRepo, openBranch, commitAndPushChanges } from './monorepo-utils';
const repoToClone = process.env._REPO_TO_CLONE;
const isPreProcess = process.env._IS_PRE_PROCESS;
const language = process.env._LANGUAGE;
const projectId = process.env.PROJECT_ID

async function main() {
  await setConfig();

  if (isPreProcess) {
    if (isMonoRepo(language)) {
      await cloneRepo(projectId, repoToClone);
      await openBranch();
    } else {
      execSync('git init');
    }
  } else {
    if (isMonoRepo(language)) {
      await commitAndPushChanges('owlbot-googleapis-initial-PR');
      // still have to open a PR
    } else {
      await commitAndPushChanges('main');
    }
  }
}

async function setConfig() {
  execSync('git config --global user.name "Googleapis Bootstrapper"');
  execSync(
    'git config --global user.email "googleapis-bootstrapper[bot]@users.noreply.github.com"'
  );
}

main();