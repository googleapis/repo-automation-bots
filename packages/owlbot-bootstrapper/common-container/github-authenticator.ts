// Copyright 2022 Google LLC
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

import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import {Octokit} from '@octokit/rest';
import {Secret} from './interfaces';
import {request} from 'gaxios';
import {logger} from 'gcf-utils';

/**
 * Github authenticator class
 *
 * @param projectId project ID where owlbot-bootstrapper secret is stored
 * @param appInstallationId installation ID for owlbot-bootstrapper on github org
 * @param secretManagerClient a secret manager service client
 */
export class GithubAuthenticator {
  projectId: string;
  appInstallationId: string;
  secretManagerClient: SecretManagerServiceClient;
  signingClient: (payload: object, privateKey: string, algorithm: {}) => string;
  OWLBOT_SECRET_NAME = 'owlbot-bootstrapper';

  constructor(
    projectId: string,
    appInstallationId: string,
    secretManagerClient: SecretManagerServiceClient,
    signingClient: (
      payload: object,
      privateKey: string,
      algorithm: {}
    ) => string
  ) {
    this.projectId = projectId;
    this.appInstallationId = appInstallationId;
    this.secretManagerClient = secretManagerClient;
    this.signingClient = signingClient;
  }

  /**
   * Gets a short lived access token from Github using a jwt
   */
  public async getGitHubShortLivedAccessToken(): Promise<string> {
    const secret = await this._parseSecretInfo(
      this.secretManagerClient,
      this.projectId,
      this.OWLBOT_SECRET_NAME
    );
    const payload = {
      // issued at time
      // Note: upstream API seems to fail if decimals are included
      // in unixtime, this is why parseInt is run:
      iat: parseInt('' + Date.now() / 1000),
      // JWT expiration time (10 minute maximum)
      exp: parseInt('' + Date.now() / 1000 + 10 * 60),
      // GitHub App's identifier
      iss: secret.appId,
    };
    const jwt = this.signingClient(payload, secret.privateKey, {
      algorithm: 'RS256',
    });
    const resp = await request({
      url: `https://api.github.com/app/installations/${this.appInstallationId}/access_tokens`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (resp.status !== 201) {
      throw Error(`unexpected response http = ${resp.status}`);
    } else {
      return (resp.data as any).token;
    }
  }

  /**
   * Authenticates an Octokit instance
   */
  public async authenticateOctokit(token: string): Promise<Octokit> {
    try {
      return new Octokit({
        auth: token,
      });
    } catch (err) {
      logger.error(err as any);
      throw err;
    }
  }

  /**
   * Gets the latest secret version name in GCP project
   *
   * @param projectId project ID where owlbot-bootstrapper secret is stored
   * @param secretName the incomplete name for the secret (without the full path)
   * @returns The full secret name
   */
  public _getLatestSecretVersionName(
    projectId: string,
    secretName: string
  ): string {
    const fullSecretName = `projects/${projectId}/secrets/${secretName}`;
    return `${fullSecretName}/versions/latest`;
  }

  /**
   * Parses JSON from secret payload into values.
   *
   * @param secretManagerClient a secret manager service client
   * @param projectId project ID where owlbot-bootstrapper secret is stored
   * @param secretName the incomplete name for the secret (without the full path)
   * @returns The full secret name
   */
  public async _parseSecretInfo(
    secretManagerClient: SecretManagerServiceClient,
    projectId: string,
    secretName: string
  ): Promise<Secret> {
    const name = this._getLatestSecretVersionName(projectId, secretName);
    const [version] = await secretManagerClient.accessSecretVersion({
      name: name,
    });

    // Extract the payload as a string.
    const payload = version?.payload?.data?.toString() || '';
    if (payload === '') {
      throw Error('did not retrieve a payload from SecretManager.');
    }

    const config = JSON.parse(payload);
    return config;
  }
}
