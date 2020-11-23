// Copyright 2019 Google LLC
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

/* eslint-disable @typescript-eslint/no-var-requires */

import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import {describe, it, beforeEach} from 'mocha';
import snapshot from 'snap-shot-it';
import nock from 'nock';
// eslint-disable-next-line node/no-extraneous-import
import {config} from '@probot/octokit-plugin-config';
const TestingOctokit = ProbotOctokit.plugin(config);

import myProbotApp from '../src/conventional-commit-lint';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

// TODO: stop disabling warn once the following upstream patch is landed:
// https://github.com/probot/probot/pull/926
global.console.warn = () => {};

describe('ConventionalCommitLint', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = createProbot({
      githubToken: 'abc123',
      Octokit: TestingOctokit,
    });
    probot.load(myProbotApp);
  });

  it('sets a "failure" context on PR, if commits fail linting', async () => {
    const payload = require(resolve(
      fixturesPath,
      './pull_request_synchronize'
    ));
    const invalidCommits = [
      ...require(resolve(fixturesPath, './invalid_commit')),
    ];
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
      .reply(200, invalidCommits)
      .post('/repos/bcoe/test-release-please/check-runs', body => {
        snapshot(body);
        return true;
      })
      .reply(200);

    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    requests.done();
  });

  it('sets a "success" context on PR, if commit lint succeeds', async () => {
    const payload = require(resolve(
      fixturesPath,
      './pull_request_synchronize'
    ));
    const validCommits = [...require(resolve(fixturesPath, './valid_commit'))];

    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
      .reply(200, validCommits)
      .post('/repos/bcoe/test-release-please/check-runs', body => {
        snapshot(body);
        return true;
      })
      .reply(200);

    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    requests.done();
  });

  it('should handle a PR with no commits', async () => {
    const payload = require(resolve(
      fixturesPath,
      './pull_request_synchronize'
    ));
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
      .reply(200, []);
    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    requests.done();
  });

  describe('PR With Multiple Commits', () => {
    it('has a valid pull request title', async () => {
      const payload = require(resolve(
        fixturesPath,
        './pull_request_synchronize'
      ));
      // create a history that has one valid commit, and one invalid commit:
      const invalidCommits = [
        ...require(resolve(fixturesPath, './invalid_commit')),
      ];
      // eslint-disable-next-line prefer-spread
      invalidCommits.push.apply(
        invalidCommits,
        require(resolve(fixturesPath, './valid_commit'))
      );

      const requests = nock('https://api.github.com')
        .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
        .reply(200, invalidCommits)
        .post('/repos/bcoe/test-release-please/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('has an invalid pull request title', async () => {
      const payload = require(resolve(
        fixturesPath,
        './pull_request_synchronize_invalid_title'
      ));
      // create a history that has one valid commit, and one invalid commit:
      const invalidCommits = [
        ...require(resolve(fixturesPath, './invalid_commit')),
      ];
      // eslint-disable-next-line prefer-spread
      invalidCommits.push.apply(
        invalidCommits,
        require(resolve(fixturesPath, './valid_commit'))
      );

      const requests = nock('https://api.github.com')
        .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
        .reply(200, invalidCommits)
        .post('/repos/bcoe/test-release-please/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('has a valid title, invalid commit, automerge label', async () => {
      const payload = require(resolve(
        fixturesPath,
        './pull_request_automerge'
      ));
      // create a history that has one valid commit, and one invalid commit:
      const invalidCommit = require(resolve(fixturesPath, './invalid_commit'));
      const requests = nock('https://api.github.com')
        .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
        .reply(200, invalidCommit)
        .post('/repos/bcoe/test-release-please/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });
  });
});
