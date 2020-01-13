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

import { Application } from 'probot';
import { GitHubAPI } from 'probot/lib/github';
import { PullsListCommitsResponseItem, Response } from '@octokit/rest';

const CONFIGURATION_FILE_PATH = 'merge-on-green.yml';

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

async function getBranchProtection(
  github: GitHubAPI,
  owner: string,
  repo: string,
  branch: string
) {
  try {
    const data = (
      await github.repos.getBranchProtection({
        owner,
        repo,
        branch,
      })
    ).data;
    return data;
  } catch (err) {
    return null;
  }
}

export = (app: Application) => {
  app.on(['pull_request'], async context => {
    const config = (await context.config(
      CONFIGURATION_FILE_PATH,
      {}
    )) as Configuration;

    console.log('a');
    const { owner, repo } = context.repo();

    const branchProtection = await getBranchProtection(
      context.github,
      owner,
      repo,
      context.payload.pull_request.head.repo.default_branch
    );

    const configProtection = config.required_status_checks;

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
      head_sha: commits[commits.length - 1].sha,
    });

    //TODO: confirm if branchProtection returns an array if branch protection is set up but no checks are specified
    //don't think so: you can't set up a branch without a required test
    //make sure branch Protection has at least 3 check runs specified
    //
    if (!branchProtection) {
      checkParams = context.repo({
        head_sha: commits[commits.length - 1].sha,
        name: 'merge-on-green-readiness',
        conclusion: 'failure' as Conclusion,
        output: {
          title: 'You have no required status checks',
          summary: 'Enforce branch protection on your repo.',
          text:
            'To add required status checks to your repository, please follow instructions in this link: \nhttps://help.github.com/en/github/administering-a-repository/enabling-required-status-checks\n' +
            '\nIn order to add applications to your repository that will run check runs, please follow instructions here: \nhttps://developer.github.com/apps/installing-github-apps/\n' +
            '\nLastly, please make sure that your required status checks are the same as the ones listed in your config file if you created one.',
        },
      });
    }

    //&& !config.required_status_checks

    if (branchProtection) {
      if (branchProtection.required_status_checks.contexts.length < 3) {
        checkParams = context.repo({
          head_sha: commits[commits.length - 1].sha,
          name: 'merge-on-green-readiness',
          conclusion: 'failure' as Conclusion,
          output: {
            title: 'You have less than 3 required status checks',
            summary:
              "You likely don't have all the required status checks you need, please make sure to add the appropriate ones.",
            text:
              'To add required status checks to your repository, please follow instructions in this link: \nhttps://help.github.com/en/github/administering-a-repository/enabling-required-status-checks\n' +
              '\nIn order to add applications to your repository that will run check runs, please follow instructions here: \nhttps://developer.github.com/apps/installing-github-apps/\n' +
              '\nLastly, please make sure that your required status checks are the same as the ones listed in your config file if you created one.',
          },
        });
      }

      const branchProtectionArray = branchProtection.required_status_checks
        .contexts as string[];
      const configProtectionArray = configProtection as string[];

      if (configProtection) {
        configProtectionArray.forEach(statusCheck => {
          if (!branchProtectionArray.includes(statusCheck)) {
            checkParams = context.repo({
              head_sha: commits[commits.length - 1].sha,
              name: 'merge-on-green-readiness',
              conclusion: 'failure' as Conclusion,
              output: {
                title:
                  'Your branch protection does not match up with your config file',
                summary:
                  'Set up your branch protection to match your config file.',
                text:
                  'To add required status checks to your repository, please follow instructions in this link: \nhttps://help.github.com/en/github/administering-a-repository/enabling-required-status-checks\n' +
                  '\nIn order to add applications to your repository that will run check runs, please follow instructions here: \nhttps://developer.github.com/apps/installing-github-apps/\n' +
                  '\nLastly, please make sure that your required status checks are the same as the ones listed in your config file.',
              },
            });
          }
        });
      }
    }

    await context.github.checks.create(checkParams);
  });
};

//TODO: fail if config and no branch protection, ask user to enforce branch protection
//TODO: fail if config is set up and required checks are smaller than config (making config minimum requirement) - only if there is a config do we enforce a config minimum
//TODO: keep checking status of tests if there is only branch protection and no config or if brnach protection is at least as much as config
