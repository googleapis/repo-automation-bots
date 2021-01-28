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

import myProbotApp from '../src/canary-bot';
import {resolve} from 'path';
import {Probot, createProbot, ProbotOctokit} from 'probot';
import nock from 'nock';
import * as fs from 'fs';
import {describe, it, beforeEach} from 'mocha';
import * as assert from 'assert';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

// const packageJsonFile = fs.readFileSync(resolve(__dirname, '.../package.json'), 'utf-8');
// const packageJson = JSON.parse(packageJsonFile);

describe('canary-bot', () => {
  let probot: Probot;

  beforeEach(async() => {
    probot = createProbot({defaults: {
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      }),
    }});
    await probot.load(myProbotApp);
  });

  describe('responds to events', () => {
    it('responds to issues', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened'));
      const requests = nock('https://api.github.com')
        .post('/repos/testuser2/testRepo/issues/5/comments')
        .reply(200)
      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
      requests.done();
    });

    it('does not add a comment if the title is wrong', async () => {
      const payload = require(resolve(fixturesPath, './events/issue_opened_wrong_title'));
      await probot.receive({name: 'issues.opened', payload, id: 'abc123'});
    });
  });
});
