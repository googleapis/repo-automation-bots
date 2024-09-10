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
import {Probot} from 'probot';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {
  getAuthenticatedOctokit,
  logger as defaultLogger,
  getContextLogger,
  GCFLogger,
  logger,
} from 'gcf-utils';
import {addOrUpdateIssue, closeIssue} from '@google-automations/issue-utils';

const RELEASE_TYPE_NO_PUBLISH = new Set(['go-yoshi', 'go', 'simple']);
const SUCCESSFUL_PUBLISH_LABEL = 'autorelease: published';
const FAILED_LABEL = 'autorelease: failed';
const TAGGED_LABEL = 'autorelease: tagged';
const PENDING_LABEL = 'autorelease: pending';
const TRIGGERED_LABEL = 'autorelease: triggered';
const ISSUE_TITLE = 'Warning: a recent release failed';

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

interface ReleasePullRequest {
  number: number;
  labels: string[];
  updatedAt: number;
}

interface FailedRelease {
  number: number;
  reason: string;
}

function hasLabel(
  pullRequest: ReleasePullRequest,
  labelToFind: string
): boolean {
  return !!pullRequest.labels.find(label => label === labelToFind);
}

function buildIssueBody(failures: FailedRelease[]): string {
  const list = failures
    .map(failure => `* #${failure.number} - ${failure.reason}`)
    .join('\n');
  return `The following release PRs may have failed:\n\n${list}`;
}

/**
 * Helper class for encapsulating the discovery of failed releases.
 */
class FailureChecker {
  private octokit: Octokit;
  private owner: string;
  private repo: string;
  private logger: GCFLogger;
  constructor(
    octokit: Octokit,
    owner: string,
    repo: string,
    logger: GCFLogger = defaultLogger
  ) {
    this.octokit = octokit;
    this.owner = owner;
    this.repo = repo;
    this.logger = logger;
  }

  /**
   * Return a list of failed releases with the reason they failed.
   * @param {string} terminalStateLabel The expected final status label
   * @returns {FailedRelease[]} Failed releases with the reason they failed.
   */
  async findFailedReleases(
    terminalStateLabel: string
  ): Promise<FailedRelease[]> {
    const failedReleases: FailedRelease[] = [];
    // Look for releases explicitly marked failed - these are usually set by
    // the release job
    for await (const releasePullRequest of this.pullRequestIterator(
      FAILED_LABEL
    )) {
      if (hasLabel(releasePullRequest, terminalStateLabel)) {
        // release is marked as both failed and successful - we assume
        // this job was retried and succeeded
        continue;
      }
      this.logger.info(
        `found failure for ${this.owner}/${this.repo} pr = ${
          releasePullRequest.number
        } labels = ${releasePullRequest.labels.join(',')}`
      );
      failedReleases.push({
        number: releasePullRequest.number,
        reason: 'The release job failed -- check the build log.',
      });
    }

    // Look for in-progress releases - these usually failed to start the next
    // step in the pipeline, or failed to report status back. We also ignore
    // pull requests that are too new (see WARNING_THRESHOLD)
    const inProcessLabels = new Set([TAGGED_LABEL, PENDING_LABEL]);
    inProcessLabels.delete(terminalStateLabel);
    for (const label of inProcessLabels.values()) {
      for await (const releasePullRequest of this.pullRequestIterator(label)) {
        if (!hasLabel(releasePullRequest, terminalStateLabel)) {
          this.logger.info(
            `found failure for ${this.owner}/${this.repo} pr = ${
              releasePullRequest.number
            } labels = ${releasePullRequest.labels.join(',')}`
          );
          if (hasLabel(releasePullRequest, TRIGGERED_LABEL)) {
            // Our release job triggering mechanism has added the triggered label,
            // but the next step failed to report success/failure state.
            failedReleases.push({
              number: releasePullRequest.number,
              reason:
                'The release job was triggered, but has not reported back success.',
            });
          } else {
            // The release job has not yet been triggered
            failedReleases.push({
              number: releasePullRequest.number,
              reason: `The release job is '${label}', but expected '${terminalStateLabel}'.`,
            });
          }
        }
      }
    }
    return failedReleases;
  }

  /**
   * Async iterator to iterate over closed pull requests with the provided
   * label.
   * @param {string} label Filter on pull requests with this label
   * @yields {ReleasePullRequest}
   */
  private async *pullRequestIterator(label: string) {
    const now = TimeMethods.Date().getTime();
    for await (const response of this.octokit.paginate.iterator(
      'GET /repos/{owner}/{repo}/issues',
      {
        owner: this.owner,
        repo: this.repo,
        labels: label,
        state: 'closed',
        sort: 'updated',
        direction: 'desc',
        per_page: 16,
      }
    )) {
      for (const issue of response.data) {
        const updatedAt = new Date(issue.updated_at).getTime();
        if (now - updatedAt < WARNING_THRESHOLD) {
          // issue is too new to open an issue
          logger.info(`PR #${issue.number} is too new.`);
          continue;
        }
        if (now - updatedAt > MAX_THRESHOLD) {
          // issue is too old to open an issue, stop iteration
          break;
        }
        if (!issue.pull_request?.merged_at) {
          // ignore non pull request issues and non-merged PRs
          logger.info(`PR #${issue.number} is not a merged PR`);
          continue;
        }
        const pullRequest: ReleasePullRequest = {
          number: issue.number,
          labels: issue.labels.map(label =>
            typeof label === 'object' ? label.name! : label
          ),
          updatedAt,
        };
        yield pullRequest;
      }
    }
  }
}

export function failureChecker(app: Probot) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('schedule.repository' as any, async context => {
    const logger = getContextLogger(context);
    const utcHour = TimeMethods.Date().getUTCHours();
    const {owner, repo} = context.repo();

    // If we're outside of working hours, and we're not in a test context, skip this bot.
    if (utcHour > END_HOUR_UTC && utcHour < START_HOUR_UTC) {
      logger.info("skipping run, we're currently outside of working hours");
      return;
    }
    const configuration =
      ((await context.config(
        WELL_KNOWN_CONFIGURATION_FILE
      )) as ConfigurationOptions | null) || {};

    if (configuration.disableFailureChecker) {
      return;
    }

    let octokit: Octokit;
    if (context.payload.installation && context.payload.installation.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        'Installation ID not provided in schedule.repository event.' +
          ' We cannot authenticate Octokit.'
      );
    }
    const checker = new FailureChecker(octokit, owner, repo, logger);

    // Some release types, such as go-yoshi, have no publish step so a release
    // is considered successful once a tag has occurred:
    const terminalStateLabel = RELEASE_TYPE_NO_PUBLISH.has(
      configuration.releaseType || ''
    )
      ? TAGGED_LABEL
      : SUCCESSFUL_PUBLISH_LABEL;

    const failures = await checker.findFailedReleases(terminalStateLabel);
    if (failures.length === 0) {
      await closeIssue(octokit, owner, repo, ISSUE_TITLE, logger);
      return;
    }

    const body = buildIssueBody(failures);
    await addOrUpdateIssue(
      octokit,
      owner,
      repo,
      ISSUE_TITLE,
      body,
      ['type: process'],
      logger
    );
  });
}
