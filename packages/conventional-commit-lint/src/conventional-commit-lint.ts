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

// eslint-disable-next-line node/no-extraneous-import
import {Application} from 'probot';
import lint from '@commitlint/lint';

import {rules} from '@commitlint/config-conventional';
// modify rules slightly:
// see: https://github.com/conventional-changelog/commitlint/blob/master/%40commitlint/config-conventional/index.js
delete rules['type-enum'];
rules['header-max-length'] = [2, 'always', 256];

// eslint-disable-next-line node/no-extraneous-import
import {PullsListCommitsResponseItem, Response} from '@octokit/rest';

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | undefined;

export = (app: Application) => {
  app.on('pull_request', async context => {
    // Fetch last 100 commits stored on a specific PR.
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

    let message = context.payload.pull_request.title;
    // if there is only one commit, lint the commit rather than
    // the pull request title:
    if (commits.length === 1) {
      message = commits[0].commit.message;
    }

    // support "foo!: message" syntax, see:
    // https://github.com/conventional-changelog/commitlint/pull/767
    message = message.replace('!:', ':');

    let text = '';
    let lintError = false;

    const result = await lint(message.toLowerCase(), rules);
    if (result.valid === false) {
      lintError = true;
      text += `:x: linting errors for "*${result.input}*"\n`;
      result.errors.forEach(error => {
        text += `* ${error.message}\n`;
      });
      text += '\n\n';
    }

    // post the status of commit linting to the PR, using:
    // https://developer.github.com/v3/checks/
    let checkParams = context.repo({
      name: 'conventionalcommits.org',
      conclusion: 'success' as Conclusion,
      head_sha: commits[commits.length - 1].sha,
    });

    if (lintError) {
      let summary =
        'Some of your commit messages failed linting.\n\nVisit [conventionalcommits.org](https://conventionalcommits.org) to learn our conventions.\n\n';
      if (commits.length === 1) {
        summary +=
          'Run `git commit --amend` and edit your message to match Conventional Commit guidelines.';
      } else {
        summary +=
          'edit your pull request title to match Conventional Commit guidelines.';
      }
      checkParams = context.repo({
        head_sha: commits[commits.length - 1].sha,
        conclusion: 'failure' as Conclusion,
        name: 'conventionalcommits.org',
        output: {
          title: 'Commit message did not follow Conventional Commits',
          summary,
          text,
        },
      });
    }
    await context.github.checks.create(checkParams);
  });
};
