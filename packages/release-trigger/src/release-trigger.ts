// Copyright 2021 Google LLC
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

// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {logger as defaultLogger, GCFLogger} from 'gcf-utils';

import * as child_process from 'child_process';

export class TriggerError extends Error {
  readonly cause: Error;
  readonly command: string;
  readonly stdout: string;
  readonly stderr: string;
  constructor(cause: Error, command: string, stdout: string, stderr: string) {
    super(cause.message);
    this.cause = cause;
    this.command = command;
    this.stdout = stdout;
    this.stderr = stderr;
    this.name = TriggerError.name;
  }
}

export const execFile = function (
  file: string,
  args: string[],
  token: string,
  logger: GCFLogger = defaultLogger
): Promise<{stdout: string; stderr: string; error?: Error}> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return new Promise((resolve, _reject) => {
    child_process.execFile(
      file,
      args,
      {
        env: {
          ...process.env,
          GITHUB_TOKEN: token,
        },
      },
      (error, stdout, stderr) => {
        if (stdout) {
          logger.info(stdout);
        }
        if (stderr) {
          logger.warn(stderr);
        }
        resolve({stdout, stderr, error: error || undefined});
      }
    );
  });
};

export const ALLOWED_ORGANIZATIONS = [
  'googleapis',
  'GoogleCloudDataproc',
  'GoogleCloudPlatform',
];

export const FAILED_LABEL = 'autorelease: failed';
export const TAGGED_LABEL = 'autorelease: tagged';
export const TRIGGERED_LABEL = 'autorelease: triggered';
export const PUBLISHED_LABEL = 'autorelease: published';
export interface Repository {
  owner: string;
  repo: string;
}

interface BasicPullRequest {
  owner: string;
  repo: string;
  number: number;
}

export interface PullRequest {
  html_url: string;
  number: number;
  state: string;
  labels: {
    name?: string;
  }[];
  merge_commit_sha: string | null;
  user?: {
    login?: string | undefined;
  } | null;
  base: {
    repo: {
      owner?: {
        login?: string | null;
      } | null;
      name: string;
    };
  };
  closed_at: string | null;
}

const LAUNCH_DATE = new Date('2022-06-01');
export function isReleasePullRequest(pullRequest: PullRequest): boolean {
  return (
    pullRequest.state === 'closed' &&
    !!pullRequest.merge_commit_sha &&
    pullRequest.labels.some(label => {
      return label.name === TAGGED_LABEL;
    }) &&
    !pullRequest.labels.some(label => {
      return label.name === TRIGGERED_LABEL;
    }) &&
    !!pullRequest.closed_at &&
    new Date(pullRequest.closed_at) > LAUNCH_DATE
  );
}

export async function findPendingReleasePullRequests(
  octokit: Octokit,
  repository: Repository,
  maxNumber = 5,
  maxPages = 2,
  logger: GCFLogger = defaultLogger
): Promise<PullRequest[]> {
  // TODO: switch to graphql
  const listGenerator = octokit.paginate.iterator(
    'GET /repos/{owner}/{repo}/pulls',
    {
      owner: repository.owner,
      repo: repository.repo,
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
    }
  );

  const found: PullRequest[] = [];
  let page = 1;
  for await (const listResponse of listGenerator) {
    for (const pullRequest of listResponse.data) {
      if (isReleasePullRequest(pullRequest)) {
        found.push(pullRequest);
        if (found.length >= maxNumber) {
          break;
        }
      }
    }
    if (page >= maxPages) {
      break;
    }
    page++;
  }
  logger.debug(`Found ${found.length} release pull requests`);
  return found;
}

export interface TriggerKokoroOptions {
  logger?: GCFLogger;
  multiScmName?: string;
}
export async function triggerKokoroJob(
  pullRequestUrl: string,
  token: string,
  options: TriggerKokoroOptions = {}
): Promise<{stdout: string; stderr: string; jobName?: string}> {
  return invokeAutoreleaseWithArgs(
    pullRequestUrl,
    token,
    ['trigger-single', `--pull=${pullRequestUrl}`],
    options
  );
}

/**
 * Logs and runs a python3 -m autorelease command.
 * @param someUrl Echoed in log.
 * @param token Passed to autorelease via GITHUB_TOKEN environment variable.
 * @param autoreleaseArgs Arguments to pass to command line.
 * @returns process results
 */
export async function invokeAutoreleaseWithArgs(
  someUrl: string,
  token: string,
  autoreleaseArgs: string[],
  options: TriggerKokoroOptions = {}
): Promise<{stdout: string; stderr: string; jobName?: string}> {
  const logger = options.logger || defaultLogger;
  logger.info(`triggering job for ${someUrl}`);
  const args = ['-m', 'autorelease', ...autoreleaseArgs];
  if (options.multiScmName) {
    args.push(`--multi-scm-name=${options.multiScmName}`);
  }
  const command = `python3 ${args.join(' ')}`;
  logger.debug(`command:  ${command}`);
  const {stdout, stderr, error} = await execFile('python3', args, token);
  if (error) {
    logger.error(`error executing command: ${command}`, error);
    throw new TriggerError(error, command, stdout, stderr);
  }
  const jobName = parseJobName(stdout);
  return {stdout, stderr, jobName};
}

const JOB_NAME_REGEX = new RegExp('Triggering (.*) using [0-9a-f]+');
export function parseJobName(stdout: string): string | undefined {
  const match = stdout.match(JOB_NAME_REGEX);
  if (match) {
    return match[1];
  }
  return undefined;
}

export async function markTriggered(
  octokit: Octokit,
  pullRequest: BasicPullRequest,
  logger: GCFLogger = defaultLogger
) {
  logger.info('adding `autorelease: triggered` label');
  await octokit.issues.addLabels({
    owner: pullRequest.owner,
    repo: pullRequest.repo,
    issue_number: pullRequest.number,
    labels: [TRIGGERED_LABEL],
  });
}

export async function markFailed(
  octokit: Octokit,
  pullRequest: BasicPullRequest,
  logger: GCFLogger = defaultLogger
) {
  logger.info('adding `autorelease: failed` label');
  await octokit.issues.addLabels({
    owner: pullRequest.owner,
    repo: pullRequest.repo,
    issue_number: pullRequest.number,
    labels: [FAILED_LABEL],
  });
}

export async function cleanupPublished(
  octokit: Octokit,
  pullRequest: BasicPullRequest,
  logger: GCFLogger = defaultLogger
): Promise<boolean> {
  logger.info('adding `autorelease: failed` label');
  let success = true;
  for (const name of [TAGGED_LABEL, TRIGGERED_LABEL]) {
    try {
      await octokit.issues.removeLabel({
        owner: pullRequest.owner,
        repo: pullRequest.repo,
        issue_number: pullRequest.number,
        name,
      });
    } catch (err) {
      logger.warn(`failed to remove label ${name}`);
      success = false;
      // ignore error for 404
    }
  }
  return success;
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
