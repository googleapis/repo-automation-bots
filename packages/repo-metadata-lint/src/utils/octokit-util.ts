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
import fs from 'fs';
import {request} from 'gaxios';
import {sign} from 'jsonwebtoken';

const {readFile} = promisify(fs.promises);

export type OctokitType =
  | InstanceType<typeof Octokit>
  | InstanceType<typeof ProbotOctokit>;

export interface OctokitParams {
  'pem-path'?: string;
  privateKey?: string;
  'app-id': number;
  installation: number;
}

interface AuthArgs {
  privateKey: string;
  appId: number;
  installation: number;
}

interface Token {
  token: string;
  expires_at: string;
  permissions: object;
  repository_selection: string;
}

/**
 * Creates an authenticated token for octokit.
 */
export async function octokitTokenFrom(argv: OctokitParams): Promise<string> {
  let privateKey = '';
  if (argv['pem-path']) {
    privateKey = await readFile(argv['pem-path'], 'utf8');
  } else if (argv.privateKey) {
    privateKey = argv.privateKey;
  }
  const token = await getGitHubShortLivedAccessToken(
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
  return await getAuthenticatedOctokit(token, false);
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
        return getAuthenticatedOctokit(token, false);
      }
      const now = new Date().getTime();
      // Refresh every 5 minutes.  Tokens are good for 10 minutes.
      const elapsedMilliseconds = now - lastOctokitTimestamp;
      if (!lastOctokit || elapsedMilliseconds > 300000) {
        lastOctokitTimestamp = now;
        const atoken = await octokitTokenFrom(params);
        lastOctokit = await getAuthenticatedOctokit(atoken, false);
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
      return await getAuthenticatedOctokit(atoken ?? token, false);
    },
  };
}

export async function getGitHubShortLivedAccessToken(
  privateKey: string,
  appId: number,
  installation: number
): Promise<Token> {
  const payload = {
    // issued at time
    // Note: upstream API seems to fail if decimals are included
    // in unixtime, this is why parseInt is run:
    iat: parseInt('' + Date.now() / 1000),
    // JWT expiration time (10 minute maximum)
    exp: parseInt('' + Date.now() / 1000 + 10 * 60),
    // GitHub App's identifier
    iss: appId,
  };
  const jwt = sign(payload, privateKey, {algorithm: 'RS256'});
  const resp = await request<Token>({
    url: getAccessTokenURL(installation),
    method: 'POST',
    headers: {
      Authorization: `Bearer ${jwt}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (resp.status !== 201) {
    throw Error(`unexpected response http = ${resp.status}`);
  } else {
    return resp.data;
  }
}

export function getAccessTokenURL(installation: number) {
  return `https://api.github.com/app/installations/${installation}/access_tokens`;
}

let cachedOctokit: OctokitType;
export async function getAuthenticatedOctokit(
  auth: string | AuthArgs,
  cache = true
): Promise<OctokitType> {
  if (cache && cachedOctokit) return cachedOctokit;
  let tokenString: string;
  if (auth instanceof Object) {
    const token = await getGitHubShortLivedAccessToken(
      auth.privateKey,
      auth.appId,
      auth.installation
    );
    tokenString = token.token;
  } else {
    tokenString = auth;
  }
  const octokit = new Octokit({
    auth: tokenString,
  });
  if (cache) cachedOctokit = octokit;
  return octokit;
}
