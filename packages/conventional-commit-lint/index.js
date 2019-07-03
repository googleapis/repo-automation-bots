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

const lint = require('@commitlint/lint');
const {rules} = require('@commitlint/config-conventional');

module.exports = app => {
  app.on('pull_request', async context => {
    // TODO: support PRs with more than 100 commits.
    const commitParams = context.repo({
      pull_number: context.payload.pull_request.number,
      per_page: 100,
    });
    const commits = (await context.github.pulls.listCommits(commitParams)).data;

    // run the commit linter against all recent commits.
    let text = '';
    let lintError = false;
    for (let i = 0, commit; (commit = commits[i]) !== undefined; i++) {
      const message = commit.commit.message;
      const result = await lint(message, rules);
      if (result.valid === false) {
        lintError = true;
        text += `:x: linting errors for "*${result.input}*"\n`;
        result.errors.forEach(error => {
          text += `* ${error.message}\n`;
        });
        text += '\n\n'
      }
    }

    // post the status of commit linting ot the PR.
    let checkParams = {
      name: 'conventionalcommits.org',
      conclusion: 'success',
      head_sha: commits[commits.length - 1].sha,
    };

    if (lintError) {
      checkParams = context.repo({
        head_sha: commits[commits.length - 1].sha,
        conclusion: 'failure',
        name: 'conventionalcommits.org',
        output: {
          title: 'Commit message did not follow Conventional Commits',
          summary: `Some of your commit messages failed linting.\n\nVisit [conventionalcommits.org](https://conventionalcommits.org) to learn our conventions.\n\nRun \`git reset --soft HEAD~${commits.length} && git commit .\` to amend your message.`,
          text,
        },
      });
    }
    await context.github.checks.create(checkParams);
  });
};
