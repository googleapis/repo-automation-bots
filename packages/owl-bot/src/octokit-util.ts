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
  'pem-path': string;
  'app-id': number;
  installation: number;
}

/**
 * Creates an authenticated token for octokit.
 */
export async function octokitTokenFrom(argv: OctokitParams): Promise<string> {
  const privateKey = await readFileAsync(argv['pem-path'], 'utf8');
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
export async function octokitFrom(argv: OctokitParams): Promise<OctokitType> {
  const token = await octokitTokenFrom(argv);
  return await core.getAuthenticatedOctokit(token, false);
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
 */
export function octokitFactoryFrom(params: OctokitParams): OctokitFactory {
  return {
    getGitHubShortLivedAccessToken() {
      return octokitTokenFrom(params);
    },
    async getShortLivedOctokit(token?: string) {
      const atoken = token ?? (await octokitTokenFrom(params));
      return await core.getAuthenticatedOctokit(atoken, false);
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
