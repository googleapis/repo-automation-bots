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

/* eslint-disable node/no-extraneous-import */

import myProbotApp from '../src/kokoro-trigger';
import {resolve} from 'path';
import {Probot, createProbot, ProbotOctokit} from 'probot';
import nock from 'nock';
import * as fs from 'fs';
import {describe, it, beforeEach} from 'mocha';
import * as assert from 'assert';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('kokoro-trigger', () => {
  let probot: Probot;

  const config = fs.readFileSync(
    resolve(fixturesPath, 'config', 'valid-config.yml')
  );

  beforeEach(() => {
    probot = createProbot({
      defaults: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
      },
    });
    probot.load(myProbotApp);
  });

  describe('responds to events', () => {
    it('responds to a PR', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened'
      ));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fkokoro-trigger.yml')
        .reply(200, config);

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });

      requests.done();
      assert.ok(true);
    });

    it('responds to issues', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened'));
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fkokoro-trigger.yml')
        .reply(200, config);
      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      requests.done();
    });
  });
});
