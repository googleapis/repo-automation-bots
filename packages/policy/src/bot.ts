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

// eslint-disable-next-line node/no-extraneous-import
import {Probot, Context} from 'probot';
import {logger} from 'gcf-utils';
import {getPolicy} from './policy';
import {exportToBigQuery} from './export';
import {submitFixes} from './changer';

export const allowedOrgs = ['googleapis', 'googlecloudplatform'];

export function policyBot(app: Probot) {
  app.on(['schedule.repository' as '*'], async (context: Context) => {
    const owner: string = context.payload.organization.login;
    const name: string = context.payload.repository.name;
    const repo = `${owner}/${name}`;

    if (
      context.payload.cron_org !== owner ||
      !allowedOrgs.includes(owner.toLowerCase())
    ) {
      logger.info(`skipping run for ${context.payload.cron_org}`);
      return;
    }

    const policy = getPolicy(context.octokit, logger);
    const repoMetadata = await policy.getRepo(repo);
    if (repoMetadata.private || repoMetadata.archived) {
      return;
    }
    const result = await policy.checkRepoPolicy(repoMetadata);
    await exportToBigQuery(result);

    // specifically wrap this in a try/catch to avoid retries if the fix
    // causes any errors.  Otherwise, the entire function is retried, and the
    // result is recorded twice.
    try {
      await submitFixes(result, repoMetadata, context.octokit);
    } catch (e) {
      logger.error(e);
    }
  });
}
