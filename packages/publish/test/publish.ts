// Copyright 2019 Google LLC
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
//

// Publish bot requires a minimum of Node 10 for the
// runtime, we uses the lack of fs.promises to detect this.
const { promises } = require('fs');
if (!promises) {
  console.warn('node 10 is required for publish bot');
  process.exit(0);
}

import { Application } from 'probot';
import handler from '../src/publish';

import { resolve } from 'path';
import { Probot } from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';
import { expect } from 'chai';

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
      )
      .get('/repos/Codertocat/Hello-World/pulls?state=closed&per_page=100')
      .reply(200, [
        {
          head: {
            ref: 'release-v0.0.1',
          },
          number: 1,
        },
      ])
      .delete('/repos/Codertocat/Hello-World/issues/1/labels')
      .reply(200);

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

    let observedPkgPath: string | undefined = undefined;
    handler.publish = async (
      npmRc: string,
      pkgPath: string,
      app: Application
    ) => {
      snapshot(npmRc);
      observedPkgPath = pkgPath;
    };

    await probot.receive({ name: 'release.released', payload, id: 'abc123' });
    requests.done();
    expect(observedPkgPath).to.match(/\/tmp\/.*\/package/);
  });

  it('should not attempt to publish to npm if no configuration found', async () => {
    const payload = require(resolve(
      fixturesPath,
      'events',
      'release_released'
    ));
    const requests = nock('https://api.github.com')
      .get('/repos/Codertocat/Hello-World/contents/.github/publish.yml')
      .reply(404)
      .get('/repos/Codertocat/.github/contents/.github/publish.yml')
      .reply(404);
    await probot.receive({ name: 'release.released', payload, id: 'abc123' });
    requests.done();
  });
});
