// Copyright 2021 Google LLC
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

import {Octokit} from '@octokit/rest';
// Conflicting linters think the next line is extraneous or necessary.
// eslint-disable-next-line node/no-extraneous-import
import {ProbotOctokit} from 'probot';
import {promisify} from 'util';
import {readFile} from 'fs';
import {core} from './core';
import {GCFLogger} from 'gcf-utils/build/src/logging/gcf-logger';

const readFileAsync = promisify(readFile);

export type OctokitType =
  | InstanceType<typeof Octokit>
  | InstanceType<typeof ProbotOctokit>;

export interface OctokitParams {
  'pem-path'?: string;
  privateKey?: string;
  'app-id': number;
  installation: number;
}

/**
 * Creates an authenticated token for octokit.
 */
export async function octokitTokenFrom(argv: OctokitParams): Promise<string> {
  let privateKey = '';
  if (argv['pem-path']) {
    privateKey = await readFileAsync(argv['pem-path'], 'utf8');
  } else if (argv.privateKey) {
    privateKey = argv.privateKey;
  }
  const token = await core.getGitHubShortLivedAccessToken(
    privateKey,
    argv['app-id'],
    argv.installation
  );
  return token.token;
}

/**
 * Creates an authenticated instance of octokit.
 */
export async function octokitFrom(
  argv: OctokitParams,
  shouldRetry = false
): Promise<OctokitType> {
  const token = await octokitTokenFrom(argv);
  return await core.getAuthenticatedOctokit(token, false, shouldRetry);
}

/**
 * Interface lets us easily replace in tests.
 */
export interface OctokitFactory {
  getGitHubShortLivedAccessToken(): Promise<string>;
  getShortLivedOctokit(token?: string): Promise<OctokitType>;
}

/**
 * Creates an octokit factory from the common params.
 * The factory will return a new octokit with a new token every 5 minutes.
 */
export function octokitFactoryFrom(params: OctokitParams): OctokitFactory {
  let lastOctokitTimestamp = 0;
  let lastOctokit: OctokitType | null = null;
  return {
    getGitHubShortLivedAccessToken() {
      return octokitTokenFrom(params);
    },
    async getShortLivedOctokit(token?: string) {
      if (token) {
        return core.getAuthenticatedOctokit(token, false);
      }
      const now = new Date().getTime();
      // Refresh every 5 minutes.  Tokens are good for 10 minutes.
      const elapsedMilliseconds = now - lastOctokitTimestamp;
      if (!lastOctokit || elapsedMilliseconds > 300000) {
        lastOctokitTimestamp = now;
        const atoken = await octokitTokenFrom(params);
        lastOctokit = await core.getAuthenticatedOctokit(atoken, false);
      }
      return lastOctokit;
    },
  };
}

/**
 * Creates an octokit factory a short lived token.
 */
export function octokitFactoryFromToken(token: string): OctokitFactory {
  return {
    getGitHubShortLivedAccessToken() {
      return Promise.resolve(token);
    },
    async getShortLivedOctokit(atoken?: string) {
      return await core.getAuthenticatedOctokit(atoken ?? token, false);
    },
  };
}

/**
 * Creates an issue if the given title doesn't exist.
 * Returns `true` if an issue has been created, `false` otherwise.
 *
 * @returns Promise<boolean>
 */
export async function createIssueIfTitleDoesntExist(
  octokit: OctokitType,
  owner: string,
  repo: string,
  title: string,
  body: string,
  logger: Console | GCFLogger = console
): Promise<boolean> {
  // check if issue exists
  const issues = await octokit.issues.listForRepo({
    owner,
    repo,
    per_page: 100,
    state: 'open',
  });

  for (const issue of issues.data) {
    if (issue.title === title) {
      logger.info(`Issue '${title}' exists (${issue.html_url}). Skipping...`);
      return false;
    }
  }

  const createdIssue = await octokit.issues.create({
    owner,
    repo,
    title,
    body,
  });

  logger.info(`Created '${title}' (${createdIssue.data.html_url}).`);

  return true;
}
