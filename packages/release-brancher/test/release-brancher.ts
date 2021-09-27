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
    describe('with releaseType java-lts', () => {
      beforeEach(() => {
        runner = new Runner({
          branchName: '1.x',
          targetTag: 'v1.3.0',
          gitHubToken: 'sometoken',
          upstreamOwner: 'testOwner',
          upstreamRepo: 'testRepo',
          releaseType: 'java-lts',
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

    it('throws if repo has no branch protection enabled', () => {
      const config = loadFixture('sync-repo-settings/no-branches.yaml');
      runner = new Runner({
        branchName: '3.1.x',
        targetTag: 'v3.1.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      assert.throws(() => {
        runner.updateSyncRepoSettings(config);
      });
    });
  });

  describe('updateWorkflows', () => {
    it('ignores workflows without branch lists that match', () => {
      const config = loadFixture('workflows/empty-objects.yaml');
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const newConfig = runner.updateWorkflow(config, 'main');
      assert.ok(newConfig);
      assert.deepStrictEqual(newConfig, config);
    });

    it('updates push branch lists', () => {
      const config = loadFixture('workflows/only-push.yaml');
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const newConfig = runner.updateWorkflow(config, 'main');
      assert.ok(newConfig);
      snapshot(newConfig);
    });

    it('ignores non-matching push branch lists', () => {
      const config = loadFixture('workflows/only-push.yaml');
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const newConfig = runner.updateWorkflow(config, 'master');
      assert.ok(newConfig);
      assert.deepStrictEqual(newConfig, config);
    });

    it('updates pull request branch lists', () => {
      const config = loadFixture('workflows/only-pull-request.yaml');
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const newConfig = runner.updateWorkflow(config, 'main');
      assert.ok(newConfig);
      snapshot(newConfig);
    });

    it('ignores non-matching pull branch lists', () => {
      const config = loadFixture('workflows/only-pull-request.yaml');
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const newConfig = runner.updateWorkflow(config, 'master');
      assert.ok(newConfig);
      assert.deepStrictEqual(newConfig, config);
    });

    it('ignores empty objects', () => {
      const config = loadFixture('workflows/empty-objects.yaml');
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
      });
      const newConfig = runner.updateWorkflow(config, 'master');
      assert.ok(newConfig);
      assert.deepStrictEqual(newConfig, config);
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
        releaseType: 'java-lts',
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

    it('opens or creates a new pull request with java-lts-no-sp release type', async () => {
      runner = new Runner({
        branchName: '1.3.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
        releaseType: 'java-lts-no-sp',
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
          snapshot('pr-changes-java-lts-no-sp', Array.from(changes.entries()));
          snapshot('pr-options-lts-no-sp', options);
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

  describe('createWorkflowPullRequest', () => {
    it('opens or creates a new pull request', async () => {
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
        releaseType: 'java-lts',
      });
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/git/matching-refs/tags%2Fv1.3.0')
        .reply(200, [{ref: 'refs/tags/v1.3.0', object: {sha: 'abcd1234'}}])
        .get('/repos/testOwner/testRepo/git/trees/abcd1234?recursive=true')
        .reply(200, {
          sha: 'abcd1234',
          tree: [
            {
              path: '.github/workflows/ci.yaml',
            },
            {
              path: '.github/workflows/approve.yaml',
            },
          ],
        })
        .get('/repos/testOwner/testRepo')
        .reply(200, {
          name: 'testRepo',
          full_name: 'testOwner/testRepo',
          default_branch: 'main',
        })
        .get('/repos/testOwner/testRepo/contents/.github%2Fworkflows%2Fci.yaml')
        .reply(200, {
          content: Buffer.from(
            loadFixture('workflows/only-push.yaml'),
            'utf8'
          ).toString('base64'),
        })
        .get(
          '/repos/testOwner/testRepo/contents/.github%2Fworkflows%2Fapprove.yaml'
        )
        .reply(200, {
          content: Buffer.from(
            loadFixture('workflows/empty-objects.yaml')
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
          snapshot('workflows-pr-changes', Array.from(changes.entries()));
          snapshot('workflows-pr-options', options);
          return Promise.resolve(2345);
        }
      );
      const pullNumber = await runner.createWorkflowPullRequest();
      assert.equal(pullNumber, 2345);

      requests.done();
    });

    it('opens or creates a new pull request with java-lts-no-sp release type', async () => {
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
        releaseType: 'java-lts-no-sp',
      });
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/git/matching-refs/tags%2Fv1.3.0')
        .reply(200, [{ref: 'refs/tags/v1.3.0', object: {sha: 'abcd1234'}}])
        .get('/repos/testOwner/testRepo/git/trees/abcd1234?recursive=true')
        .reply(200, {
          sha: 'abcd1234',
          tree: [
            {
              path: '.github/workflows/ci.yaml',
            },
            {
              path: '.github/workflows/approve.yaml',
            },
          ],
        })
        .get('/repos/testOwner/testRepo')
        .reply(200, {
          name: 'testRepo',
          full_name: 'testOwner/testRepo',
          default_branch: 'main',
        })
        .get('/repos/testOwner/testRepo/contents/.github%2Fworkflows%2Fci.yaml')
        .reply(200, {
          content: Buffer.from(
            loadFixture('workflows/only-push.yaml'),
            'utf8'
          ).toString('base64'),
        })
        .get(
          '/repos/testOwner/testRepo/contents/.github%2Fworkflows%2Fapprove.yaml'
        )
        .reply(200, {
          content: Buffer.from(
            loadFixture('workflows/empty-objects.yaml')
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
          snapshot(
            'workflows-pr-changes-java-lts-no-sp',
            Array.from(changes.entries())
          );
          snapshot('workflows-pr-options-java-lts-no-sp', options);
          return Promise.resolve(2345);
        }
      );
      const pullNumber = await runner.createWorkflowPullRequest();
      assert.equal(pullNumber, 2345);

      requests.done();
    });

    it('ignores non-matching branches a new pull request', async () => {
      runner = new Runner({
        branchName: '1.x',
        targetTag: 'v1.3.0',
        gitHubToken: 'sometoken',
        upstreamOwner: 'testOwner',
        upstreamRepo: 'testRepo',
        releaseType: 'java-lts',
      });
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/git/matching-refs/tags%2Fv1.3.0')
        .reply(200, [{ref: 'refs/tags/v1.3.0', object: {sha: 'abcd1234'}}])
        .get('/repos/testOwner/testRepo/git/trees/abcd1234?recursive=true')
        .reply(200, {
          sha: 'abcd1234',
          tree: [
            {
              path: '.github/workflows/ci.yaml',
            },
            {
              path: '.github/workflows/approve.yaml',
            },
          ],
        })
        .get('/repos/testOwner/testRepo')
        .reply(200, {
          name: 'testRepo',
          full_name: 'testOwner/testRepo',
          default_branch: 'other-main-branch',
        })
        .get('/repos/testOwner/testRepo/contents/.github%2Fworkflows%2Fci.yaml')
        .reply(200, {
          content: Buffer.from(
            loadFixture('workflows/only-push.yaml'),
            'utf8'
          ).toString('base64'),
        })
        .get(
          '/repos/testOwner/testRepo/contents/.github%2Fworkflows%2Fapprove.yaml'
        )
        .reply(200, {
          content: Buffer.from(
            loadFixture('workflows/empty-objects.yaml')
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
          snapshot('workflows-pr-no-changes', Array.from(changes.entries()));
          snapshot('workflows-pr-no-options', options);
          return Promise.resolve(2345);
        }
      );
      const pullNumber = await runner.createWorkflowPullRequest();
      assert.equal(pullNumber, 2345);

      requests.done();
    });
  });
});
