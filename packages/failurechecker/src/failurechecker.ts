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

import { Application } from 'probot';
import * as util from 'util';
import * as moment from 'moment';
import { GitHubAPI } from 'probot/lib/github';

const CONFIGURATION_FILE_PATH = 'failurechecker.yml';

const RELEASE_LABEL = 'autorelease: pending';

// We open an issue that a release has failed if it's been longer than 3
// hours and we're within normal working hours.
const WARNING_THRESHOLD = 60 * 60 * 3 * 1000;
// We currently only open issues during the hours 9 to 7.
const END_HOUR_UTC = 3;
const START_HOUR_UTC = 17;

export = (app: Application) => {
  app.on(['schedule.repository'], async context => {
    const utcHour = moment.utc().hour();

    if (utcHour >= START_HOUR_UTC || utcHour <= END_HOUR_UTC) {
      app.log("skipping run, we're currently outside of working hours");
      return;
    }

    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;

    // TODO: we should potentially extend this out further for the benefit
    // of high traffic repos (currently the PR could go below the fold).
    const prs = (
      await context.github.pulls.list({
        owner: context.payload.organization.login,
        repo: context.payload.repository.name,
        state: 'closed',
        per_page: 100,
      })
    ).data;

    const now = new Date().getTime();
    for (const pr of prs) {
      // PR was closed but not merged.
      if (!pr.merged_at) {
        app.log(`pr ${pr.number} was never merged`);
        continue;
      }

      // we only care about merged PRs with release labels.
      if (!pr.labels.find(l => l.name === RELEASE_LABEL)) continue;

      const closedTime = new Date(pr.milestone.closed_at).getTime();
      if (now - closedTime > WARNING_THRESHOLD) {
        await openWarningIssue(owner, repo, pr.number, context.github);
      }
    }

    app.log(`it's alive! event for ${context.payload.repository.name}`);
  });

  const ISSUE_TITLE = `Warning: a recent release failed`;
  const LABELS = 'type: process';
  async function openWarningIssue(
    owner: string,
    repo: string,
    prNumber: number,
    github: GitHubAPI
  ) {
    if (!repo.includes('node')) {
      app.log(
        `we are currently only testing on Node.js repos, skipping ${repo}`
      );
      return;
    }

    const issues = (
      await github.issues.listForRepo({
        owner,
        repo,
        labels: LABELS,
        per_page: 32,
      })
    ).data;
    const warningIssue = issues.find(issue => {
      return issue.title.includes(ISSUE_TITLE);
    });
    if (warningIssue) {
      app.log(`a warning issue was already opened for pr ${prNumber}`);
      return;
    }
    return github.issues.create({
      owner,
      repo,
      title: ISSUE_TITLE,
      body: `The release PR #${prNumber} is still in a pending state after several hours`,
      labels: LABELS.split(','),
    });
  }
};
