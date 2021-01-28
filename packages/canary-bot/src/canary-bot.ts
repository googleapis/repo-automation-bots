// Copyright 2019 Google LLC
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

import {Probot} from 'probot';
import * as fs from 'fs';
import {resolve} from 'path';
import { logger } from 'gcf-utils';

const packageJsonFile = fs.readFileSync(resolve(__dirname, '../../package.json'), 'utf-8');
const packageJson = JSON.parse(packageJsonFile);

export = (app: Probot) => {
  app.on(['issues.opened'], async context => {
    if(context.payload.issue.title.includes('canary-bot test')) {
      await context.octokit.issues.createComment({
        owner: context.payload.issue.user.login,
        repo: context.payload.repository.name,
        issue_number: context.payload.issue.number,
        body: `The dependencies and their versions are: ${JSON.stringify(packageJson.dependencies)}`,
      })
    } else {
      logger.info('The bot is skipping this issue because the title does not include canary-bot test');
    }
  });
};
