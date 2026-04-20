// Copyright 2026 Google LLC
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
import {Octokit} from '@octokit/rest';
import {getBotSecrets} from 'gcf-utils';
// eslint-disable-next-line node/no-extraneous-import
import {createAppAuth} from '@octokit/auth-app';
import {retry} from '@octokit/plugin-retry';

const OctokitWithRetry = Octokit.plugin(retry);
/**
 * Build Octokit instance with the given installation ID.
 * If installation ID is not provided, authenticate as a bot.
 * @param installationId installation ID of a GitHub App.
 * @returns Octokit instance.
 */
export async function getAuthenticatedOctokit(
  installationId: number | undefined
): Promise<Octokit> {
  const botSecrets = await getBotSecrets();
  if (installationId === undefined || installationId === null) {
    // Authenticate as a bot.
    return new OctokitWithRetry({
      authStrategy: createAppAuth,
      auth: {
        appId: botSecrets.appId,
        privateKey: botSecrets.privateKey,
      },
      retry: {
        retries: 1,
        retryAfter: 1,
      },
    });
  }
  // Authenticate as an installation.
  return new OctokitWithRetry({
    authStrategy: createAppAuth,
    auth: {
      appId: botSecrets.appId,
      privateKey: botSecrets.privateKey,
      installationId: installationId,
    },
    retry: {
      retries: 1,
      retryAfter: 1,
    },
  });
}
