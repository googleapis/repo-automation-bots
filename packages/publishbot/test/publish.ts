/**
 * Copyright 2019 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Application } from 'probot';
import handler from '../src/publish';

import { resolve } from 'path';
import { Probot } from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

interface Secret {
  payload: { [key: string]: Buffer };
}

interface PublishConfig {
  token: string;
  registry: string;
}

describe('publish', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      // use a bare instance of octokit, the default version
      // enables retries which makes testing difficult.
      Octokit: require('@octokit/rest'),
    });

    const app = probot.load(handler);
    app.app = {
      getSignedJsonWebToken() {
        return 'abc123';
      },
      getInstallationAccessToken(): Promise<string> {
        return Promise.resolve('abc123');
      },
    };
  });

  it('should publish to npm if configuration found', async () => {
    const payload = require(resolve(
      fixturesPath,
      'events',
      'release_released'
    ));
    const config = fs.readFileSync(
      resolve(fixturesPath, 'config', 'valid-config.yml')
    );
    const requests = nock('https://api.github.com')
      .get('/repos/Codertocat/Hello-World/contents/.github/publish.yml')
      .reply(200, { content: config.toString('base64') })
      .get('/repos/Codertocat/Hello-World/tarball/0.0.1')
      .reply(
        200,
        fs.createReadStream(resolve(fixturesPath, './tiny-tarball-1.0.0.tgz'))
      );

    handler.getPublicationSecrets = async (
      app: Application
    ): Promise<Secret> => {
      return {
        payload: {
          data: Buffer.from(
            JSON.stringify({
              registry: 'registry.example.com',
              token: 'abc123',
            })
          ),
        },
      };
    };

    await probot.receive({ name: 'release.released', payload, id: 'abc123' });
    requests.done();
  });

  // it('publish', async () => {
  /*const payload = require(resolve(
      fixturesPath,
      'events',
      'pull_request_opened'
    ));

    const requests = nock('https://api.github.com')
      .get('/repos/testOwner/testRepo/contents/.github/publish.yml')
      .reply(200, { content: config.toString('base64') })

    await probot.receive({
      name: 'pull_request.opened',
      payload,
      id: 'abc123'
    });

    requests.done();*/
  // });
});
