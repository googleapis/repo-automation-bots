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
//

import { Application, Context } from 'probot';
import { PullsListCommitsResponseItem, Response } from '@octokit/rest';

const CONFIGURATION_FILE_PATH = 'alwaysGreen.yml';

interface Configuration {
  randomBoolean: boolean;
}

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | undefined;

export = (app: Application) => {
  app.on(
    [
      'pull_request.opened'
    ],
    async context => {

      const commitParams = context.repo({
        pull_number: context.payload.pull_request.number,
        per_page: 100,
      });
  
      let commitsResponse: Response<PullsListCommitsResponseItem[]>;
      try {
        commitsResponse = await context.github.pulls.listCommits(commitParams);
      } catch (err) {
        console.info(err);
        app.log.error(err);
        return;
      }
  
      const commits = commitsResponse.data;

     let checkParams = context.repo({
      name: 'alwaysGreen',
      conclusion: 'success' as Conclusion,
      head_sha: commits[commits.length - 1].sha,
    });

    await context.github.checks.create(checkParams);

    })
};