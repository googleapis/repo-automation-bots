// Copyright 2020 Google LLC
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

/* eslint-disable @typescript-eslint/no-var-requires */

import myProbotApp from '../src/snippet-bot';

import {resolve} from 'path';
import {Probot} from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';
import {expect} from 'chai';
import {describe, it, beforeEach} from 'mocha';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('snippet-bot', () => {
  let probot: Probot;

  const config = fs.readFileSync(
    resolve(fixturesPath, 'config', 'valid-config.yml')
  );

  beforeEach(() => {
    probot = new Probot({});
    probot.app = {
      getSignedJsonWebToken() {
        return 'abc123';
      },
      getInstallationAccessToken(): Promise<string> {
        return Promise.resolve('abc123');
      },
    };
    probot.load(myProbotApp);
  });

  describe('shows an example of how to use chai library', () => {
    it('confirms the random boolean is true', async () => {
      expect(config.toString()).to.include('ignore.py');
    });
  });

  describe('responds to PR', () => {
    it('quits early', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const changedFiles = require(resolve(fixturesPath, './pr_files_test_py'));
      const payload = require(resolve(fixturesPath, './pr_event'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/.github/snippet-bot.yml'
        )
        .reply(200, {content: config.toString('base64')})
        .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
        .reply(404, changedFiles);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
    });

    it('sets a "failure" context on PR', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const changedFiles = require(resolve(fixturesPath, './pr_files_test_py'));
      const payload = require(resolve(fixturesPath, './pr_event'));
      const blob = require(resolve(fixturesPath, './failure_blob'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/.github/snippet-bot.yml'
        )
        .reply(200, {content: config.toString('base64')})
        .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
        .reply(200, changedFiles)
        .get(
          '/repos/tmatsuo/repo-automation-bots/git/blobs/223828dbd668486411b475665ab60855ba9898f3'
        )
        .reply(200, blob)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
    });
  });
});
