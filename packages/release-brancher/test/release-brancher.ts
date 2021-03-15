// Copyright 2021 Google LLC
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

import {resolve} from 'path';
import nock from 'nock';
import * as fs from 'fs';
import * as sinon from 'sinon';
import * as suggester from 'code-suggester';
import {describe, it, beforeEach} from 'mocha';
import * as assert from 'assert';
import snapshot from 'snap-shot-it';
import {Runner} from '../src/release-brancher';
import {Octokit} from '@octokit/rest';
import {CreatePullRequestUserOptions} from 'code-suggester/build/src/types';

nock.disableNetConnect();
const sandbox = sinon.createSandbox();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

function loadFixture(path: string): string {
  return fs.readFileSync(resolve(fixturesPath, path)).toString('utf-8');
}

describe('Runner', () => {
  let runner: Runner;
  afterEach(() => {
    sandbox.restore();
  });

  describe('updateReleasePleaseConfig', () => {
    describe('without releaseType', () => {
      beforeEach(() => {
        runner = new Runner({
          branchName: '1.x',
          targetTag: 'v1.3.0',
          gitHubToken: 'sometoken',
          upstreamOwner: 'testOwner',
          upstreamRepo: 'testRepo',
        });
      });
      it('updates a basic config', async () => {
        const config = loadFixture('release-please/basic.yaml');
        const newConfig = runner.updateReleasePleaseConfig(config);
        assert.ok(newConfig);
        snapshot(newConfig);
      });

      it('updates a config with extra branches already configured', async () => {
        const config = loadFixture('release-please/with-extra-branches.yaml');
        const newConfig = runner.updateReleasePleaseConfig(config);
        assert.ok(newConfig);
        snapshot(newConfig);
      });
    });
    describe('with releaseType', () => {
      beforeEach(() => {
        runner = new Runner({
          branchName: '1.x',
          targetTag: 'v1.3.0',
          gitHubToken: 'sometoken',
          upstreamOwner: 'testOwner',
          upstreamRepo: 'testRepo',
          releaseType: 'custom-releaser',
        });
      });
      it('updates a basic config', async () => {
        const config = loadFixture('release-please/basic.yaml');
        const newConfig = runner.updateReleasePleaseConfig(config);
        assert.ok(newConfig);
        snapshot(newConfig);
      });

      it('updates a config with extra branches already configured', async () => {
        const config = loadFixture('release-please/with-extra-branches.yaml');
        const newConfig = runner.updateReleasePleaseConfig(config);
        assert.ok(newConfig);
        snapshot(newConfig);
      });
    });
    it('ignores branch if it already exists', () => {
      const config = loadFixture('release-please/with-extra-branches.yaml');
      runner = new Runner({
        branchName: '3.1.x',
        targetTag: 'v3.1.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const newConfig = runner.updateReleasePleaseConfig(config);
      assert.equal(newConfig, undefined);
    });
  });

  describe('updateSyncRepoSettings', () => {
    it('updates a basic config', async () => {
      const config = loadFixture('sync-repo-settings/basic.yaml');
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const newConfig = runner.updateSyncRepoSettings(config);
      assert.ok(newConfig);
      snapshot(newConfig);
    });

    it('updates a config with extra branches already configured', async () => {
      const config = loadFixture('sync-repo-settings/with-extra-branches.yaml');
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const newConfig = runner.updateSyncRepoSettings(config);
      assert.ok(newConfig);
      snapshot(newConfig);
    });

    it('ignores branch if it already exists', () => {
      const config = loadFixture('sync-repo-settings/with-extra-branches.yaml');
      runner = new Runner({
        branchName: '3.1.x',
        targetTag: 'v3.1.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const newConfig = runner.updateSyncRepoSettings(config);
      assert.equal(newConfig, undefined);
    });

    it('ignores branch if repo has no branch protection enabled', () => {
      const config = loadFixture('sync-repo-settings/no-branches.yaml');
      runner = new Runner({
        branchName: '3.1.x',
        targetTag: 'v3.1.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const newConfig = runner.updateSyncRepoSettings(config);
      assert.equal(newConfig, undefined);
    });
  });

  describe('createBranch', () => {
    it('ignores if branch already exists', async () => {
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/git/ref/heads%2F1.x')
        .reply(200, {ref: 'refs/heads/1.x'});
      const ref = await runner.createBranch();
      assert.ok(ref);
      assert.equal(ref, 'refs/heads/1.x');
      requests.done();
    });

    it('errors if cannot find SHA for tag', async () => {
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/git/ref/heads%2F1.x')
        .reply(404)
        .get('/repos/testOwner/testRepo/git/matching-refs/tags%2Fv1.3.0')
        .reply(404);

      await assert.rejects(runner.createBranch());
      requests.done();
    });

    it('creates a branch', async () => {
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/git/ref/heads%2F1.x')
        .reply(404)
        .get('/repos/testOwner/testRepo/git/matching-refs/tags%2Fv1.3.0')
        .reply(200, [{ref: 'refs/tags/v1.3.0', object: {sha: 'abcd1234'}}])
        .post('/repos/testOwner/testRepo/git/refs', body => {
          snapshot(body);
          return body;
        })
        .reply(201, {ref: 'refs/heads/1.x'});
      const ref = await runner.createBranch();
      assert.ok(ref);
      assert.equal(ref, 'refs/heads/1.x');
      requests.done();
    });
  });

  describe('createPullRequest', () => {
    it('opens or creates a new pull request', async () => {
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Frelease-please.yml')
        .reply(200, {
          content: Buffer.from(
            loadFixture('release-please/basic.yaml'),
            'utf8'
          ).toString('base64'),
        })
        .get(
          '/repos/testOwner/testRepo/contents/.github%2Fsync-repo-settings.yaml'
        )
        .reply(200, {
          content: Buffer.from(
            loadFixture('sync-repo-settings/basic.yaml')
          ).toString('base64'),
        });
      sandbox.replace(
        suggester,
        'createPullRequest',
        (
          _octokit: Octokit,
          changes: suggester.Changes | null | undefined,
          options: CreatePullRequestUserOptions
        ): Promise<number> => {
          assert.ok(changes);

          // Map does not work well with snapshot
          snapshot('pr-changes', Array.from(changes.entries()));
          snapshot('pr-options', options);
          return Promise.resolve(2345);
        }
      );
      const pullNumber = await runner.createPullRequest();
      assert.equal(pullNumber, 2345);

      requests.done();
    });

    it('ignores already configured files', async () => {
      runner = new Runner({
        branchName: '3.1.x',
        targetTag: 'v3.1.2',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Frelease-please.yml')
        .reply(200, {
          content: Buffer.from(
            loadFixture('release-please/with-extra-branches.yaml'),
            'utf8'
          ).toString('base64'),
        })
        .get(
          '/repos/testOwner/testRepo/contents/.github%2Fsync-repo-settings.yaml'
        )
        .reply(200, {
          content: Buffer.from(
            loadFixture('sync-repo-settings/with-extra-branches.yaml')
          ).toString('base64'),
        });
      sandbox.replace(
        suggester,
        'createPullRequest',
        (
          _octokit: Octokit,
          changes: suggester.Changes | null | undefined
        ): Promise<number> => {
          assert.ok(changes);
          assert.equal(0, changes.size);
          return Promise.resolve(0);
        }
      );
      const pullNumber = await runner.createPullRequest();
      assert.equal(pullNumber, 0);

      requests.done();
    });

    it('ignores missing files', async () => {
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Frelease-please.yml')
        .reply(404)
        .get(
          '/repos/testOwner/testRepo/contents/.github%2Fsync-repo-settings.yaml'
        )
        .reply(404);
      sandbox.replace(
        suggester,
        'createPullRequest',
        (
          _octokit: Octokit,
          changes: suggester.Changes | null | undefined
        ): Promise<number> => {
          assert.ok(changes);
          assert.equal(0, changes.size);
          return Promise.resolve(0);
        }
      );
      const pullNumber = await runner.createPullRequest();
      assert.equal(pullNumber, 0);

      requests.done();
    });
  });
});
