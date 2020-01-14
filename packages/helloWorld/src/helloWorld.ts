/**
 * Copyright 2019 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// define types for a few modules used by probot that do not have their
// own definitions published. Before taking this step, folks should first
// check whether type bindings are already published.

import { Application, Context } from 'probot';
import * as util from 'util';

const CONFIGURATION_FILE_PATH = 'helloWorld.yml';

interface Configuration {
  randomBoolean: boolean;
}


export = (app: Application) => {
  app.on(
    [
      'issues.opened',
      'pull_request.opened'
    ],
    async context => {
      const config = (await context.config(
        CONFIGURATION_FILE_PATH,
        {}
      )) as Configuration;

      if ((context.payload.pull_request || context.payload.issue) && config.randomBoolean) {
        context.log.info("The bot is alive!");
        return;
      }
    })
};