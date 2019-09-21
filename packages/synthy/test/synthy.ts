/**
 * Copyright 2019 Google LLC
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

import myProbotApp from '../src/synthy';

import { resolve } from 'path';
import { Probot } from 'probot';

import nock from 'nock';
import * as fs from 'fs';
import snapshot from 'snap-shot-it';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

// TODO: stop disabling warn once the following upstream patch is landed:
// https://github.com/probot/probot/pull/926
global.console.warn = () => {};

describe('ReleasePleaseBot', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      // use a bare instance of octokit, the default version
      // enables retries which makes testing difficult.
      Octokit: require('@octokit/rest'),
    });

    const app = probot.load(myProbotApp);
    app.app = {
      getSignedJsonWebToken() {
        return 'abc123';
      },
      getInstallationAccessToken(): Promise<string> {
        return Promise.resolve('abc123');
      },
    };
  });

  it('updates PR appropritely if multiple upstream PRs modified template directory', async () => {
    const payload = require(resolve(fixturesPath, './synthtool_pr'));
    const config = fs.readFileSync(
      resolve(fixturesPath, './config/javascript_synth.yml')
    );
    const files = require(resolve(fixturesPath, './files'));
    const commit1 = require(resolve(fixturesPath, './commit_1'));
    const commit2 = require(resolve(fixturesPath, './commit_2'));
    const synthMetadata = fs.readFileSync(
      resolve(fixturesPath, './synth-metadata.json')
    );

    const requests = nock('https://api.github.com')
      .get(
        '/repos/bcoe/nodejs-recaptcha-enterprise/contents/.github/synthy.yml'
      )
      .reply(200, { content: config })
      .get('/repos/bcoe/nodejs-recaptcha-enterprise/pulls/1/files?per_page=300')
      .reply(200, files)
      .get(
        '/repos/googleapis/synthtool/commits?path=synthtool%2Fgcp%2Ftemplates%2Fnode_library%2F.github%2Frelease-please.yml&per_page=1'
      )
      .reply(200, commit1)
      .get(
        '/repos/googleapis/synthtool/commits?path=synthtool%2Fgcp%2Ftemplates%2Fnode_library%2F.nycrc&per_page=1'
      )
      .reply(200, commit2)
      .get(
        '/repos/bcoe/nodejs-recaptcha-enterprise/contents/synth.metadata?ref=test-synthy'
      )
      .reply(200, { content: synthMetadata })
      .put(
        '/repos/bcoe/nodejs-recaptcha-enterprise/contents/synth.metadata',
        body => {
          delete body.content; // the date changes each time so snapshot will break.
          snapshot(body);
          return true;
        }
      )
      .reply(200)
      .patch('/repos/bcoe/nodejs-recaptcha-enterprise/pulls/1', body => {
        snapshot(body);
        return true;
      })
      .reply(200);

    await probot.receive({ name: 'pull_request', payload, id: 'abc123' });
    requests.done();
  });

  it('updates PR appropritely if a single upstream PR modified template directory', async () => {
    const payload = require(resolve(fixturesPath, './synthtool_pr'));
    const config = fs.readFileSync(
      resolve(fixturesPath, './config/javascript_synth.yml')
    );
    const files = require(resolve(fixturesPath, './files'));
    const commit1 = require(resolve(fixturesPath, './commit_1'));
    const synthMetadata = fs.readFileSync(
      resolve(fixturesPath, './synth-metadata.json')
    );

    const requests = nock('https://api.github.com')
      .get(
        '/repos/bcoe/nodejs-recaptcha-enterprise/contents/.github/synthy.yml'
      )
      .reply(200, { content: config })
      .get('/repos/bcoe/nodejs-recaptcha-enterprise/pulls/1/files?per_page=300')
      .reply(200, files)
      .get(
        '/repos/googleapis/synthtool/commits?path=synthtool%2Fgcp%2Ftemplates%2Fnode_library%2F.github%2Frelease-please.yml&per_page=1'
      )
      .reply(200, commit1)
      .get(
        '/repos/googleapis/synthtool/commits?path=synthtool%2Fgcp%2Ftemplates%2Fnode_library%2F.nycrc&per_page=1'
      )
      .reply(200, commit1)
      .get(
        '/repos/bcoe/nodejs-recaptcha-enterprise/contents/synth.metadata?ref=test-synthy'
      )
      .reply(200, { content: synthMetadata })
      .put(
        '/repos/bcoe/nodejs-recaptcha-enterprise/contents/synth.metadata',
        body => {
          delete body.content; // the date changes each time so snapshot will break.
          snapshot(body);
          return true;
        }
      )
      .reply(200)
      .patch('/repos/bcoe/nodejs-recaptcha-enterprise/pulls/1', body => {
        snapshot(body);
        return true;
      })
      .reply(200);

    await probot.receive({ name: 'pull_request', payload, id: 'abc123' });
    requests.done();
  });

  it('skips non synthtool PRs', async () => {
    const payload = require(resolve(fixturesPath, './not_synthtool_pr'));
    const config = fs.readFileSync(
      resolve(fixturesPath, './config/javascript_synth.yml')
    );
    const files = require(resolve(fixturesPath, './files'));
    const commit1 = require(resolve(fixturesPath, './commit_1'));
    const synthMetadata = fs.readFileSync(
      resolve(fixturesPath, './synth-metadata.json')
    );

    await probot.receive({ name: 'pull_request', payload, id: 'abc123' });
  });
});
