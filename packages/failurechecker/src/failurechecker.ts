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
import {Probot, ProbotOctokit} from 'probot';
import {logger} from 'gcf-utils';

type OctokitType = InstanceType<typeof ProbotOctokit>;

// labels indicative of the fact that a release has not completed yet.
const RELEASE_LABELS = ['autorelease: pending', 'autorelease: failed'];
const RELEASE_TYPE_NO_PUBLISH = ['go-yoshi', 'go', 'simple'];
const SUCCESSFUL_PUBLISH_LABEL = 'autorelease: published';

// We open an issue that a release has failed if it's been longer than 3
// hours and we're within normal working hours.
const WARNING_THRESHOLD = 60 * 60 * 3 * 1000;

// Keep the issue open for 28 days
const MAX_THRESHOLD = 60 * 60 * 24 * 28 * 1000;

// We currently only open issues during the hours 9 to 7.
const END_HOUR_UTC = 3;
const START_HOUR_UTC = 17;

const WELL_KNOWN_CONFIGURATION_FILE = 'release-please.yml';
interface ConfigurationOptions {
  releaseType?: string;
  disableFailureChecker?: boolean;
}

// exported for testing purposes
export const TimeMethods = {
  Date: () => {
    return new Date();
  },
};

export function failureChecker(app: Probot) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('schedule.repository' as any, async context => {
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
      RELEASE_TYPE_NO_PUBLISH.indexOf('' + configuration.releaseType) === -1 &&
      !configuration.disableFailureChecker
    ) {
      labels.push('autorelease: tagged');
    }

    const now = TimeMethods.Date().getTime();
    const failed: number[] = [];
    for (const label of labels) {
      const results = (
        await context.octokit.issues.listForRepo({
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
            await context.octokit.pulls.get({
              owner,
              repo,
              pull_number: issue.number,
            })
          ).data;
          if (
            pr.merged_at &&
            pr.labels.some(l => labels.includes(l.name!)) &&
            !pr.labels.some(l => l.name === SUCCESSFUL_PUBLISH_LABEL)
          ) {
            logger.info(
              `found failure for ${owner}/${repo} pr = ${
                pr.number
              } labels = ${labels.join(',')}`
            );
            failed.push(pr.number);
          }
        }
      }
    }

    await manageWarningIssue(owner, repo, failed, context.octokit);
    logger.info(`it's alive! event for ${repo}`);
  });

  function buildIssueBody(prNumbers: number[]): string {
    const list = prNumbers.map(prNumber => `* #${prNumber}`).join('\n');
    return `The following release PRs may have failed:\n\n${list}`;
  }

  const ISSUE_TITLE = 'Warning: a recent release failed';
  const LABELS = 'type: process';
  async function manageWarningIssue(
    owner: string,
    repo: string,
    prNumbers: number[],
    github: OctokitType
  ) {
    const {data: issues} = await github.issues.listForRepo({
      owner,
      repo,
      labels: LABELS,
      per_page: 32,
    });
    const warningIssue = issues.find(issue => {
      return issue.title.includes(ISSUE_TITLE);
    });

    // TODO: remove this probe once we have a better idea of how
    // a cron effects our usage limits:
    logger.info((await github.rateLimit.get()).data);

    // existing issue and no failures - close the existing issue
    if (prNumbers.length === 0) {
      if (warningIssue) {
        await github.issues.update({
          owner,
          repo,
          issue_number: warningIssue.number,
          state: 'closed',
        });
      }
      return;
    }

    const body = buildIssueBody(prNumbers);

    if (warningIssue) {
      if (warningIssue.body === body) {
        // issue already up-to-date
        logger.info(`a warning issue was already opened for prs ${prNumbers}`);
        return;
      }

      // Update the existing issue
      await github.issues.update({
        owner,
        repo,
        issue_number: warningIssue.number,
        body,
      });
      return;
    }
    app.log(`opening warning issue on ${repo} for PR #${prNumbers}`);
    await github.issues.create({
      owner,
      repo,
      title: ISSUE_TITLE,
      body,
      labels: LABELS.split(','),
    });
  }
}
