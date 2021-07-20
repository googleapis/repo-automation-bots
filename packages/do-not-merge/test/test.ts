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

import myProbotApp from '../src/do-not-merge';
import {resolve} from 'path';
import {Probot, createProbot, ProbotOctokit} from 'probot';
import nock from 'nock';
import {describe, it, beforeEach} from 'mocha';
import snapshot from 'snap-shot-it';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('do-not-merge', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = createProbot({
      overrides: {
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
    it('does nothing for PRs without label and no existing check', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_labeled_other'
      ));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/testOwner/testRepo/commits/c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a/check-runs?check_name=Do%20Not%20Merge&filter=latest'
        )
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
    });

    it('does nothing for closed PRs', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_labeled_closed'
      ));

      const requests = nock('https://api.github.com');

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
    });

    it('creates failed check when label added', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_labeled'
      ));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/testOwner/testRepo/commits/c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a/check-runs?check_name=Do%20Not%20Merge&filter=latest'
        )
        .reply(200)
        .post('/repos/testOwner/testRepo/check-runs', body => {
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

    it('creates failed check when alternative label added', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_labeled'
      ));
      payload.pull_request.labels[0].name = 'do-not-merge';

      const requests = nock('https://api.github.com')
        .get(
          '/repos/testOwner/testRepo/commits/c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a/check-runs?check_name=Do%20Not%20Merge&filter=latest'
        )
        .reply(200)
        .post('/repos/testOwner/testRepo/check-runs', body => {
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

    it('updates check to pass after label removed', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_labeled_other'
      ));

      const id = 123;

      const requests = nock('https://api.github.com')
        .get(
          '/repos/testOwner/testRepo/commits/c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a/check-runs?check_name=Do%20Not%20Merge&filter=latest'
        )
        .reply(200, {
          check_runs: [{id: id, conclusion: 'failure'}],
        })
        .patch(`/repos/testOwner/testRepo/check-runs/${id}`, body => {
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

    it('updates check to failure after label re-added', async () => {
      const payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_labeled'
      ));

      const id = 123;

      const requests = nock('https://api.github.com')
        .get(
          '/repos/testOwner/testRepo/commits/c5b0c82f5d58dd4a87e4e3e5f73cd752e552931a/check-runs?check_name=Do%20Not%20Merge&filter=latest'
        )
        .reply(200, {
          check_runs: [{id: id, conclusion: 'success'}],
        })
        .patch(`/repos/testOwner/testRepo/check-runs/${id}`, body => {
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
