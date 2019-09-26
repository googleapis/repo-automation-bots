/**
 * Copyright 2019 Google LLC
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

import { Application, Context } from 'probot';
import {Translate} from '@google-cloud/translate';

const CONFIGURATION_FILE_PATH = 'translate.yml';

interface Configuration {
}

export = (app: Application) => {
  app.on('issues.opened', async context => {
    const config = (await context.config(
      CONFIGURATION_FILE_PATH,
      {}
    )) as Configuration;

    const translate = new Translate();
    const [translated_title,] = await translate.translate(context.payload.issue.title, "en");
    const [translated_body,] = await translate.translate(context.payload.issue.body, "en");

    context.github.issues.createComment(context.repo({
      issue_number: context.payload.issue.number,
      body: `Translated title:

${translated_title}.

Translated body:

${translated_body}`
    }));
  });
};
