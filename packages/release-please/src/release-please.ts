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

import { Application } from 'probot';
import { ReleasePR, ReleaseType } from 'release-please/build/src/release-pr';

// const PRIMARY_BRANCH = 'master';
const PRIMARY_BRANCH = 'test-branch';
const RELEASE_TYPE = ReleaseType.JavaAuthYoshi;
const DEFAULT_LABELS = 'autorelease: pending,type: process';
const DEFAULT_API_URL = 'https://api.github.com';

export = (app: Application) => {
  app.on('push', async context => {
    const repoUrl = context.payload.repository.full_name;
    const branch = context.payload.ref.replace('refs/heads/', '')
    if (branch != PRIMARY_BRANCH) {
      app.log.info(`Not on primary branch (${PRIMARY_BRANCH}): ${branch}`);
      return;
    }
    const packageName = context.payload.repository.name;
    const token = 'FIXME'; // somehow get the token

    const rp = new ReleasePR({
      releaseType: RELEASE_TYPE,
      packageName: packageName,
      repoUrl: repoUrl,
      label: DEFAULT_LABELS,
      apiUrl: DEFAULT_API_URL,
      token: token,
    });
    rp.run();
  });
};
