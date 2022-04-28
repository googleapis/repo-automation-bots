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

import {GithubAuthenticator} from '../github-authenticator';
import sinon, {SinonStubbedInstance} from 'sinon';
import {describe, it} from 'mocha';
import {SecretManagerServiceClient} from '@google-cloud/secret-manager';
import nock from 'nock';
import * as fs from 'fs';
import path from 'path';
import assert from 'assert';

nock.disableNetConnect();

const secretManagerClientStub = sinon.createStubInstance(
  SecretManagerServiceClient
) as SinonStubbedInstance<SecretManagerServiceClient> &
  SecretManagerServiceClient;

secretManagerClientStub.accessSecretVersion.resolves([
  {
    payload: {
      data: `{"privateKey":"${fs
        .readFileSync(
          path.resolve(__dirname, '../../test/fixtures/fake-private-key.pem')
        )
        .toString()}","appId":"12345","secret":"abc123"}`,
    },
  },
]);

describe('behavior of Github Authenticator Class', async () => {
  it('should create the right type of object', async () => {
    const githubAuthenticator = new GithubAuthenticator(
      'projectId',
      '2345567',
      secretManagerClientStub
    );

    const expectation = {
      projectId: 'projectId',
      appInstallationId: '2345567',
      secretManagerClient: secretManagerClientStub,
      OWLBOT_SECRET_NAME: 'owlbot-bootstrapper-app',
    };

    assert.deepStrictEqual(
      githubAuthenticator.OWLBOT_SECRET_NAME,
      expectation.OWLBOT_SECRET_NAME
    );
    assert.deepStrictEqual(
      githubAuthenticator.projectId,
      expectation.projectId
    );
    assert.deepStrictEqual(
      githubAuthenticator.secretManagerClient,
      expectation.secretManagerClient
    );
    assert.deepStrictEqual(
      githubAuthenticator.appInstallationId,
      expectation.appInstallationId
    );
  });

  it('should get a short lived access token', async () => {
    const githubAuthenticator = new GithubAuthenticator(
      'projectId',
      '2345567',
      secretManagerClientStub
    );

    const scope = nock('https://api.github.com')
      .post('/app/installations/2345567/access_tokens')
      .reply(201, {token: 'ghs_12345'});

    assert.deepStrictEqual(
      await githubAuthenticator.getGitHubShortLivedAccessToken(),
      'ghs_12345'
    );

    scope.done();
  });

  it('should throw an error if getting token does not respond with 201', async () => {
    const githubAuthenticator = new GithubAuthenticator(
      'projectId',
      '2345567',
      secretManagerClientStub
    );

    const scope = nock('https://api.github.com')
      .post('/app/installations/2345567/access_tokens')
      .reply(202);

    await assert.rejects(
      githubAuthenticator.getGitHubShortLivedAccessToken(),
      /unexpected response/
    );
    scope.done();
  });

  it('should return an authenticated Octokit instance', async () => {
    const githubAuthenticator = new GithubAuthenticator(
      'projectId',
      '2345567',
      secretManagerClientStub
    );

    const typeofOctokit = await githubAuthenticator.authenticateOctokit(
      'ghs_12345'
    );

    assert.ok(typeofOctokit.rest);
  });
});
