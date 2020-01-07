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
import { GitHubAPI } from 'probot/lib/github';
import { PullsListCommitsResponseItem, Response } from '@octokit/rest';
import { Z_DATA_ERROR } from 'zlib';
import { notStrictEqual } from 'assert';


const CONFIGURATION_FILE_PATH = 'mergeOnGreen.yml';


interface Configuration {
  required_status_checks?: string[];
}

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | undefined;

async function getBranchProtection(github: GitHubAPI, owner: string, repo: string, branch: string) {
  try {
    const data = (await github.repos.getBranchProtection({
      owner, 
      repo, 
      branch,
    })).data
    return data;
  } catch (err) {
    return null;
  }
}


export = (app: Application) => {
  app.on(
    [
      'pull_request'
    ],
    async context => {
      const config = (await context.config(
        CONFIGURATION_FILE_PATH,
        {}
      )) as Configuration;

      const { owner, repo } = context.repo();
      
      const data = await getBranchProtection(context.github, owner, repo, context.payload.pull_request.head.repo.default_branch);
    
      const commitParams = context.repo({
        pull_number: context.payload.pull_request.number,
        per_page: 100,
      });

      // Response object has a typed response.data, which has definitions that
      // can be found here: https://unpkg.com/@octokit/rest@16.28.3/index.d.ts
      let commitsResponse: Response<PullsListCommitsResponseItem[]>;
      try {
        commitsResponse = await context.github.pulls.listCommits(commitParams);
      } catch (err) {
        app.log.error(err);
        return;
      }
      
      const commits = commitsResponse.data;

      let checkParams = context.repo({
        name: 'merge-on-green-readiness',
        conclusion: 'success' as Conclusion,
        head_sha: commits[commits.length - 1].sha
     })


     if(!data && !config.required_status_checks) {
       checkParams = context.repo({ 
         head_sha: commits[commits.length - 1].sha,
         name: 'merge-on-green-readiness',
         conclusion: 'failure' as Conclusion,
         output: {
           title: 'You have no required status checks',
           summary: 'Add required checks or make changes to the merge-on-green config file'
         }
       })
     } 

     await context.github.checks.create(checkParams);

      // if (context.payload.check_run !== null) {

      //   context.log.info("The bot is alive!");
        
      //   return;
      // }
    })
};