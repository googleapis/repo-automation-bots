// Copyright 2019 Google LLC
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

import { Application } from 'probot';
import {
  ChecksCreateParams,
  PullsListFilesResponse,
  PullsListFilesResponseItem,
  Response,
} from '@octokit/rest';

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | undefined;

// TODO: add this to a configuration file to be extended per repository.
const TRUSTED_CONTRIBUTORS = ['renovate-bot', 'release-please[bot]'];
function isTrustedContribution(author: string): boolean {
  return TRUSTED_CONTRIBUTORS.includes(author);
}

export = (app: Application) => {
  app.on(['pull_request'], async context => {
    app.log(
      `PR ${context.payload.pull_request.number} action = ${context.payload.action}`
    );
  });

  app.on(
    [
      'pull_request.edited',
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.synchronized',
    ],
    async context => {
      const PR_AUTHOR = context.payload.pull_request.user.login;

      // TODO: add additional verification that only dependency version changes occurred.
      if (isTrustedContribution(PR_AUTHOR)) {
        const issuesAddLabelsParams = context.repo({
          issue_number: context.payload.pull_request.number,
          labels: ['kokoro:run'],
        });

        await context.github.issues.addLabels(issuesAddLabelsParams);
      }
    }
  );
};
