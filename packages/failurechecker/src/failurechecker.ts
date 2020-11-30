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

// define types for a few modules used by probot that do not have their
// own definitions published. Before taking this step, folks should first
// check whether type bindings are already published.

// eslint-disable-next-line node/no-extraneous-import
import {Application, ProbotOctokit} from 'probot';
import {IssuesListForRepoResponseData} from '@octokit/types';
import {logger} from 'gcf-utils';

type OctokitType = InstanceType<typeof ProbotOctokit>;

// labels indicative of the fact that a release has not completed yet.
const RELEASE_LABELS = ['autorelease: pending', 'autorelease: failed'];
const RELEASE_TYPE_NO_PUBLISH = ['go-yoshi'];

// We open an issue that a release has failed if it's been longer than 3
// hours and we're within normal working hours.
const WARNING_THRESHOLD = 60 * 60 * 3 * 1000;

const MAX_THRESHOLD = 60 * 60 * 24 * 3 * 1000;
// We currently only open issues during the hours 9 to 7.
const END_HOUR_UTC = 3;
const START_HOUR_UTC = 17;

const WELL_KNOWN_CONFIGURATION_FILE = 'release-please.yml';
interface ConfigurationOptions {
  releaseType?: string;
}

// exported for testing purposes
export const TimeMethods = {
  Date: () => {
    return new Date();
  },
};

export function failureChecker(app: Application) {
  app.on('schedule.repository' as '*', async context => {
    const utcHour = TimeMethods.Date().getUTCHours();
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;

    // If we're outside of working hours, and we're not in a test context, skip this bot.
    if (utcHour > END_HOUR_UTC && utcHour < START_HOUR_UTC) {
      logger.info("skipping run, we're currently outside of working hours");
      return;
    }
    // Some release types, such as go-yoshi, have no publish step so a release
    // is considered successful once a tag has occurred:
    const configuration =
      ((await context.config(
        WELL_KNOWN_CONFIGURATION_FILE
      )) as ConfigurationOptions | null) || {};
    const labels = [...RELEASE_LABELS];
    if (
      RELEASE_TYPE_NO_PUBLISH.indexOf('' + configuration.releaseType) === -1
    ) {
      labels.push('autorelease: tagged');
    }

    const now = TimeMethods.Date().getTime();
    for (const label of labels) {
      const results = (
        await context.github.issues.listForRepo({
          owner: context.payload.organization.login,
          repo: context.payload.repository.name,
          labels: label,
          state: 'closed',
          sort: 'updated',
          direction: 'desc',
          per_page: 16,
        })
      ).data;
      for (const issue of results) {
        const updatedTime = new Date(issue.updated_at).getTime();
        if (
          now - updatedTime > WARNING_THRESHOLD &&
          now - updatedTime < MAX_THRESHOLD
        ) {
          // Check that the corresponding PR was actually merged,
          // rather than closed:
          const pr = (
            await context.github.pulls.get({
              owner,
              repo,
              pull_number: issue.number,
            })
          ).data;
          if (pr.merged_at) {
            await openWarningIssue(owner, repo, pr.number, context.github);
          }
        }
      }
    }
    logger.info(`it's alive! event for ${repo}`);
  });

  const ISSUE_TITLE = 'Warning: a recent release failed';
  const LABELS = 'type: process';
  async function openWarningIssue(
    owner: string,
    repo: string,
    prNumber: number,
    github: OctokitType
  ) {
    const issues = (
      await github.issues.listForRepo({
        owner,
        repo,
        labels: LABELS,
        per_page: 32,
      })
    ).data as IssuesListForRepoResponseData;
    const warningIssue = issues.find(issue => {
      return issue.title.includes(ISSUE_TITLE);
    });

    // TODO: remove this probe once we have a better idea of how
    // a cron effects our usage limits:
    logger.info((await github.rateLimit.get()).data);

    if (warningIssue) {
      logger.info(`a warning issue was already opened for pr ${prNumber}`);
      return;
    }
    app.log(`opening warning issue on ${repo} for PR #${prNumber}`);
    return github.issues.create({
      owner,
      repo,
      title: ISSUE_TITLE,
      body: `The release PR #${prNumber} is still in a pending state after several hours`,
      labels: LABELS.split(','),
    });
  }
}
