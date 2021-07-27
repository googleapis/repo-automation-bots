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

import {describe, it, beforeEach} from 'mocha';
import nock from 'nock';
import {
  findPendingReleasePullRequests,
  PullRequest,
} from '../src/release-trigger';
import {Octokit} from '@octokit/rest';
import * as assert from 'assert';

nock.disableNetConnect();

const octokit = new Octokit({
  auth: 'fake-access-token',
});

function buildFakePullRequest(
  owner: string,
  repo: string,
  number: number,
  options?: {
    labels?: string[];
    mergeCommitSha?: string;
  }
): PullRequest {
  const optionsWithDefaults = {
    ...{labels: ['autorelease: tagged'], mergeCommitSha: 'abcd1234'},
    ...options,
  };
  return {
    html_url: `https://github.com/${owner}/${repo}/pull/${number}`,
    number,
    state: 'closed',
    labels: optionsWithDefaults.labels.map(label => {
      return {name: label};
    }),
    merge_commit_sha: optionsWithDefaults.mergeCommitSha,
    base: {
      repo: {
        owner: {
          login: owner,
        },
        name: repo,
      },
    },
  };
}

describe('release-trigger', () => {
  describe('findPendingReleasePullRequests', () => {
    it('should paginate through pull requests', async () => {
      const scope = nock('https://api.github.com')
        .get(
          '/repos/testOwner/testRepo/pulls?state=closed&sort=updated&direction=desc'
        )
        .reply(200, [buildFakePullRequest('testOwner', 'testRepo', 1234)], {
          Link: '</repos/testOwner/testRepo/pulls?state=closed&sort=updated&direction=desc&page=2>; rel="next"',
        })
        .get(
          '/repos/testOwner/testRepo/pulls?state=closed&sort=updated&direction=desc&page=2'
        )
        .reply(200, [buildFakePullRequest('testOwner', 'testRepo', 1235)]);
      const pullRequests = await findPendingReleasePullRequests(octokit, {
        owner: 'testOwner',
        repo: 'testRepo',
      });
      assert.strictEqual(pullRequests.length, 2);
      assert.strictEqual(
        pullRequests[0].html_url,
        'https://github.com/testOwner/testRepo/pull/1234'
      );
      assert.strictEqual(
        pullRequests[1].html_url,
        'https://github.com/testOwner/testRepo/pull/1235'
      );
      scope.done();
    });

    it('should ignore non-release pull requests', async () => {
      const scope = nock('https://api.github.com')
        .get(
          '/repos/testOwner/testRepo/pulls?state=closed&sort=updated&direction=desc'
        )
        .reply(200, [
          buildFakePullRequest('testOwner', 'testRepo', 1234),
          buildFakePullRequest('testOwner', 'testRepo', 1235, {
            labels: ['foo: bar'],
          }),
        ]);
      const pullRequests = await findPendingReleasePullRequests(octokit, {
        owner: 'testOwner',
        repo: 'testRepo',
      });
      assert.strictEqual(pullRequests.length, 1);
      assert.strictEqual(
        pullRequests[0].html_url,
        'https://github.com/testOwner/testRepo/pull/1234'
      );
      scope.done();
    });

    it('should ignore pull requests already triggered', async () => {
      const scope = nock('https://api.github.com')
        .get(
          '/repos/testOwner/testRepo/pulls?state=closed&sort=updated&direction=desc'
        )
        .reply(200, [
          buildFakePullRequest('testOwner', 'testRepo', 1234),
          buildFakePullRequest('testOwner', 'testRepo', 1235, {
            labels: ['autorelease: tagged', 'autorelease: triggered'],
          }),
        ]);
      const pullRequests = await findPendingReleasePullRequests(octokit, {
        owner: 'testOwner',
        repo: 'testRepo',
      });
      assert.strictEqual(pullRequests.length, 1);
      assert.strictEqual(
        pullRequests[0].html_url,
        'https://github.com/testOwner/testRepo/pull/1234'
      );
      scope.done();
    });

    it('should ignore closed, unmerged pull requests', async () => {
      const scope = nock('https://api.github.com')
        .get(
          '/repos/testOwner/testRepo/pulls?state=closed&sort=updated&direction=desc'
        )
        .reply(200, [
          buildFakePullRequest('testOwner', 'testRepo', 1234),
          buildFakePullRequest('testOwner', 'testRepo', 1235, {
            mergeCommitSha: undefined,
          }),
        ]);
      const pullRequests = await findPendingReleasePullRequests(octokit, {
        owner: 'testOwner',
        repo: 'testRepo',
      });
      assert.strictEqual(pullRequests.length, 1);
      assert.strictEqual(
        pullRequests[0].html_url,
        'https://github.com/testOwner/testRepo/pull/1234'
      );
      scope.done();
    });
  });

  describe('triggerKokoroJob', () => {
    it('should execute autorelease trigger-single command', async () => {});

    it('should catch and log an exception', async () => {});
  });

  describe('markTriggered', () => {
    it('should add a label to a pull request', async () => {});
  });

  describe('markFailed', () => {
    it('should add a label to a pull request', async () => {});
  });
});
