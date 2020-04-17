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
// eslint-disable-next-line node/no-unsupported-features/node-builtins
import {promises} from 'fs';
if (!promises) {
  console.warn('node 10 is required for publish bot');
  // eslint-disable-next-line no-process-exit
  process.exit(0);
}

// eslint-disable-next-line node/no-extraneous-import
import {Application, Probot} from 'probot';
import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';
import {expect} from 'chai';
import {describe, it, beforeEach} from 'mocha';

import handler from '../src/publish';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

interface Secret {
  payload: {[key: string]: Buffer};
}

describe('publish', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      // use a bare instance of octokit, the default version
      // enables retries which makes testing difficult.
      // eslint-disable-next-line node/no-extraneous-require
      Octokit: require('@octokit/rest'),
    });
    probot.app = {
      getSignedJsonWebToken() {
        return 'abc123';
      },
      getInstallationAccessToken(): Promise<string> {
        return Promise.resolve('abc123');
      },
    };
    probot.load(handler);
  });

  it('should publish to npm if configuration found', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
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
      .reply(200, {content: config.toString('base64')})
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

    handler.getPublicationSecrets = async (): Promise<Secret> => {
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

    await probot.receive({name: 'release.released', payload, id: 'abc123'});
    requests.done();
    expect(observedPkgPath).to.match(/\/tmp\/.*\/package/);
  });

  it('should not attempt to publish to npm if no configuration found', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
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
    await probot.receive({name: 'release.released', payload, id: 'abc123'});
    requests.done();
  });

  it('should publish candidate release to npm, if "publish:candidate" added', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const payload = require(resolve(
      fixturesPath,
      'events',
      'pull_request_labeled'
    ));
    const config = fs.readFileSync(
      resolve(fixturesPath, 'config', 'valid-config.yml')
    );
    const tarballRequest = nock('https://codeload.github.com')
      .get('/Codertocat/Hello-World/legacy.tar.gz/master')
      .reply(
        200,
        fs.createReadStream(resolve(fixturesPath, './tiny-tarball-1.0.0.tgz'))
      );
    const packumentRequest = nock('https://registry.npmjs.org')
      .get('/tiny-tarball')
      .reply(
        200,
        fs.createReadStream(
          resolve(fixturesPath, './tiny-tarball-packument-1.json')
        )
      );
    const apiRequests = nock('https://api.github.com')
      .get('/repos/Codertocat/Hello-World/contents/.github/publish.yml')
      .reply(200, {content: config.toString('base64')})
      .post('/repos/Codertocat/Hello-World/releases', req => {
        snapshot(req.body);
        return true;
      })
      .reply(200)
      .delete('/repos/Codertocat/Hello-World/issues/2/labels/publish:candidate')
      .reply(200)
      .post('/repos/Codertocat/Hello-World/issues/2/comments', req => {
        snapshot(req.body);
        return true;
      })
      .reply(200);

    handler.getPublicationSecrets = async (): Promise<Secret> => {
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
      app: Application,
      prerelease?: boolean
    ) => {
      snapshot(npmRc);
      expect(prerelease).to.equal(true);
      observedPkgPath = pkgPath;
    };

    await probot.receive({name: 'pull_request.labeled', payload, id: 'abc123'});
    apiRequests.done();
    tarballRequest.done();
    packumentRequest.done();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    snapshot(require(`${observedPkgPath}/package.json`));
  });

  it('should increment candidate version #, if multiple candidates are published', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const payload = require(resolve(
      fixturesPath,
      'events',
      'pull_request_labeled'
    ));
    const config = fs.readFileSync(
      resolve(fixturesPath, 'config', 'valid-config.yml')
    );
    const tarballRequest = nock('https://codeload.github.com')
      .get('/Codertocat/Hello-World/legacy.tar.gz/master')
      .reply(
        200,
        fs.createReadStream(resolve(fixturesPath, './tiny-tarball-1.0.0.tgz'))
      );
    const packumentRequest = nock('https://registry.npmjs.org')
      .get('/tiny-tarball')
      .reply(
        200,
        fs.createReadStream(
          resolve(fixturesPath, './tiny-tarball-packument-2.json')
        )
      );
    const apiRequests = nock('https://api.github.com')
      .get('/repos/Codertocat/Hello-World/contents/.github/publish.yml')
      .reply(200, {content: config.toString('base64')})
      .post('/repos/Codertocat/Hello-World/releases', req => {
        snapshot(req.body);
        return true;
      })
      .reply(200)
      .delete('/repos/Codertocat/Hello-World/issues/2/labels/publish:candidate')
      .reply(200)
      .post('/repos/Codertocat/Hello-World/issues/2/comments', req => {
        snapshot(req.body);
        return true;
      })
      .reply(200);

    handler.getPublicationSecrets = async (): Promise<Secret> => {
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
      app: Application,
      prerelease?: boolean
    ) => {
      snapshot(npmRc);
      expect(prerelease).to.equal(true);
      observedPkgPath = pkgPath;
    };

    await probot.receive({name: 'pull_request.labeled', payload, id: 'abc123'});
    apiRequests.done();
    tarballRequest.done();
    packumentRequest.done();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    snapshot(require(`${observedPkgPath}/package.json`));
  });
});
