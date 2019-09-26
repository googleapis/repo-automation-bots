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
import { Translate } from '@google-cloud/translate';

const CONFIGURATION_FILE_PATH = 'translate.yml';

interface Configuration {
  repoLanguageCode?: string;
}

export = (app: Application) => {
  app.on('issues.opened', async context => {
    const config = (await context.config(
      CONFIGURATION_FILE_PATH,
      {}
    )) as Configuration;
    const repoLanguageCode = config.repoLanguageCode || 'en';

    const translate = new Translate();
    const [translatedTitle] = await translate.translate(
      context.payload.issue.title,
      repoLanguageCode
    );
    const [translatedBody] = await translate.translate(
      context.payload.issue.body,
      repoLanguageCode
    );

    await context.github.issues.createComment(
      context.repo({
        issue_number: context.payload.issue.number,
        body: `Translated title:

${translatedTitle}.

Translated body:

${translatedBody}`,
      })
    );
  });
};
