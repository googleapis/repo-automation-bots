// Copyright 2021 Google LLC
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
import {describe, it, beforeEach, afterEach} from 'mocha';

import * as assert from 'assert';
import {execSync} from 'child_process';
import * as path from 'path';
import rimraf from 'rimraf';
import {core, OWL_BOT_IGNORE} from '../src/core';
import nock from 'nock';
import * as sinon from 'sinon';
import {mkdirSync, writeFileSync} from 'fs';

import * as protos from '@google-cloud/cloudbuild/build/protos/protos';
import {CloudBuildClient} from '@google-cloud/cloudbuild';
import {Octokit} from '@octokit/rest';

nock.disableNetConnect();
const sandbox = sinon.createSandbox();

/**
 * Stubs out core.getGitHubShortLivedAccessToken and
 * core.getAuthenticatedOctokit with test values.
 */
function initSandbox(prData: unknown) {
  sandbox.stub(core, 'getGitHubShortLivedAccessToken').resolves({
    token: 'abc123',
    expires_at: '2021-01-13T23:37:43.707Z',
    permissions: {},
    repository_selection: 'included',
  });
  sandbox.stub(core, 'getAuthenticatedOctokit').resolves({
    pulls: {
      get() {
        return prData;
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as InstanceType<typeof Octokit>);
}

function newPrData(labels: string[] = []): unknown {
  const prData = {
    data: {
      head: {
        ref: 'my-feature-branch',
        repo: {
          full_name: 'bcoe/example',
        },
      },
      labels: labels.map(name => {
        return {name};
      }),
    },
  };
  return prData;
}

describe('core', () => {
  afterEach(() => {
    sandbox.restore();
  });
  describe('getAccessTokenURL', () => {
    it('returns URI for token endpoint', () => {
      const uri = core.getAccessTokenURL(12345);
      assert.strictEqual(
        uri,
        'https://api.github.com/app/installations/12345/access_tokens'
      );
    });
  });
  describe('triggerBuild', () => {
    it('returns with success if build succeeds', async () => {
      initSandbox(newPrData());
      const successfulBuild = {
        status: 'SUCCESS',
        steps: [
          {
            status: 'SUCCESS',
            name: 'foo step',
          },
        ],
      };
      let triggerRequest:
        | protos.google.devtools.cloudbuild.v1.IRunBuildTriggerRequest
        | undefined = undefined;
      sandbox.stub(core, 'getCloudBuildInstance').returns({
        runBuildTrigger(
          request: protos.google.devtools.cloudbuild.v1.IRunBuildTriggerRequest
        ) {
          triggerRequest = request;
          return [
            {
              metadata: {
                build: {
                  id: 'abc123',
                },
              },
            },
          ];
        },
        getBuild() {
          return [successfulBuild];
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any as CloudBuildClient);
      const build = await core.triggerPostProcessBuild({
        image: 'node@abc123',
        appId: 12345,
        privateKey: 'abc123',
        installation: 12345,
        repo: 'bcoe/example',
        pr: 99,
        project: 'fake-project',
        trigger: 'abc123',
      });
      assert.ok(triggerRequest);
      assert.strictEqual(build!.conclusion, 'success');
      assert.strictEqual(build!.summary, 'successfully ran 1 steps 🎉!');
    });

    it(
      "doesn't trigger build when labeled with " + OWL_BOT_IGNORE,
      async () => {
        initSandbox(newPrData([OWL_BOT_IGNORE]));
        const build = await core.triggerPostProcessBuild({
          image: 'node@abc123',
          appId: 12345,
          privateKey: 'abc123',
          installation: 12345,
          repo: 'bcoe/example',
          pr: 99,
          project: 'fake-project',
          trigger: 'abc123',
        });
        assert.strictEqual(build, null);
      }
    );

    it('returns with failure if build fails', async () => {
      initSandbox(newPrData());
      const successfulBuild = {
        status: 'FAILURE',
        steps: [
          {
            status: 'FAILURE',
            name: 'foo step',
          },
        ],
      };
      let triggerRequest:
        | protos.google.devtools.cloudbuild.v1.IRunBuildTriggerRequest
        | undefined = undefined;
      sandbox.stub(core, 'getCloudBuildInstance').returns({
        runBuildTrigger(
          request: protos.google.devtools.cloudbuild.v1.IRunBuildTriggerRequest
        ) {
          triggerRequest = request;
          return [
            {
              metadata: {
                build: {
                  id: 'abc123',
                },
              },
            },
          ];
        },
        getBuild() {
          return [successfulBuild];
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any as CloudBuildClient);
      const build = await core.triggerPostProcessBuild({
        image: 'node@abc123',
        appId: 12345,
        privateKey: 'abc123',
        installation: 12345,
        repo: 'bcoe/example',
        pr: 99,
        project: 'fake-project',
        trigger: 'abc123',
      });
      assert.ok(triggerRequest);
      assert.strictEqual(build!.conclusion, 'failure');
      assert.strictEqual(build!.summary, '1 steps failed 🙁');
    });
  });
  describe('getOwlBotLock', () => {
    it('reads .OwlBot.lock.yaml and returns parsed YAML', async () => {
      const prData = {
        data: {
          head: {
            ref: 'my-feature-branch',
            repo: {
              full_name: 'bcoe/example',
            },
          },
        },
      };
      const config = `docker:
  image: node
  digest: sha256:9205bb385656cd196f5303b03983282c95c2dfab041d275465c525b501574e5c`;
      const content = {
        data: {
          content: Buffer.from(config, 'utf8').toString('base64'),
          encoding: 'base64',
        },
      };
      const octokit = {
        pulls: {
          get() {
            return prData;
          },
        },
        repos: {
          getContent() {
            return content;
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any as InstanceType<typeof Octokit>;
      const lock = await core.getOwlBotLock('bcoe/test', 22, octokit);
      assert.strictEqual(lock!.docker.image, 'node');
      assert.strictEqual(
        lock!.docker.digest,
        'sha256:9205bb385656cd196f5303b03983282c95c2dfab041d275465c525b501574e5c'
      );
    });
    it('throws error if config is invalid', async () => {
      const prData = {
        data: {
          head: {
            ref: 'my-feature-branch',
            repo: {
              full_name: 'bcoe/example',
            },
          },
        },
      };
      const config = `no-docker-key:
      image: node
      digest: sha256:9205bb385656cd196f5303b03983282c95c2dfab041d275465c525b501574e5c`;
      const content = {
        data: {
          content: Buffer.from(config, 'utf8').toString('base64'),
          encoding: 'base64',
        },
      };
      const octokit = {
        pulls: {
          get() {
            return prData;
          },
        },
        repos: {
          getContent() {
            return content;
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any as InstanceType<typeof Octokit>;
      assert.rejects(core.getOwlBotLock('bcoe/test', 22, octokit));
    });
    it('returns "undefined" if config not found', async () => {
      const prData = {
        data: {
          head: {
            ref: 'my-feature-branch',
            repo: {
              full_name: 'bcoe/example',
            },
          },
        },
      };
      const octokit = {
        pulls: {
          get() {
            return prData;
          },
        },
        repos: {
          getContent() {
            throw Object.assign(Error('Not Found'), {status: 404});
          },
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any as InstanceType<typeof Octokit>;
      const config = await core.getOwlBotLock('bcoe/test', 22, octokit);
      assert.strictEqual(config, undefined);
    });
  });
  describe('getFilesModifiedBySha', () => {
    const gitFixture = 'tmp';
    const testRepo = 'test-repo';
    before(() => {
      // If we're in a CI/CD environment set git username and email:
      if (process.env.CI) {
        execSync('git config --global user.email "beepboop@example.com"');
        execSync('git config --global user.name "HAL 9000"');
      }
    });
    beforeEach(() => {
      rimraf.sync(gitFixture);
      mkdirSync(gitFixture, {recursive: true});
    });
    afterEach(() => {
      rimraf.sync(gitFixture);
    });
    it('returns files added at sha', async () => {
      // Initialize git repo:
      execSync(`git init ${testRepo}`, {cwd: gitFixture});
      // Write a couple files:
      writeFileSync(path.join(gitFixture, testRepo, 'a.txt'), 'hello', 'utf8');
      writeFileSync(path.join(gitFixture, testRepo, 'b.txt'), 'hello', 'utf8');
      // Commit the changes:
      const fullRepoPath = path.join(gitFixture, testRepo);
      execSync('git add .', {cwd: fullRepoPath});
      execSync('git commit -a -m "feat: add two files"', {
        cwd: fullRepoPath,
      });
      // Grab the current sha:
      const sha = execSync('git rev-parse HEAD', {
        cwd: fullRepoPath,
      }).toString('utf8');
      const filesModified = await core.getFilesModifiedBySha(fullRepoPath, sha);
      assert.deepStrictEqual(filesModified, ['b.txt', 'a.txt']);
    });
    it('returns files removed at sha', async () => {
      // Initialize git repo:
      execSync(`git init ${testRepo}`, {cwd: gitFixture});
      // Write a couple files:
      writeFileSync(path.join(gitFixture, testRepo, 'a.txt'), 'hello', 'utf8');
      writeFileSync(path.join(gitFixture, testRepo, 'b.txt'), 'hello', 'utf8');
      // Commit the changes:
      const fullRepoPath = path.join(gitFixture, testRepo);
      execSync('git add .', {cwd: fullRepoPath});
      execSync('git commit -a -m "feat: add two files"', {
        cwd: fullRepoPath,
      });
      // Remove a file:
      rimraf.sync(path.join(gitFixture, testRepo, 'a.txt'));
      // Commit the change:
      execSync('git add .', {cwd: fullRepoPath});
      execSync('git commit -a -m "fix: removed tricksy file"', {
        cwd: fullRepoPath,
      });
      // Grab the current sha:
      const sha = execSync('git rev-parse HEAD', {
        cwd: fullRepoPath,
      }).toString('utf8');
      const filesModified = await core.getFilesModifiedBySha(fullRepoPath, sha);
      assert.deepStrictEqual(filesModified, ['a.txt']);
    });
    it('returns files added and removed at same sha', async () => {
      // Initialize git repo:
      execSync(`git init ${testRepo}`, {cwd: gitFixture});
      // Write a couple files:
      writeFileSync(path.join(gitFixture, testRepo, 'a.txt'), 'hello', 'utf8');
      writeFileSync(path.join(gitFixture, testRepo, 'b.txt'), 'hello', 'utf8');
      // Commit the changes:
      const fullRepoPath = path.join(gitFixture, testRepo);
      execSync('git add .', {cwd: fullRepoPath});
      execSync('git commit -a -m "feat: add two files"', {
        cwd: fullRepoPath,
      });
      // Remove a file:
      rimraf.sync(path.join(gitFixture, testRepo, 'a.txt'));
      // Add a file:
      writeFileSync(
        path.join(gitFixture, testRepo, 'c.txt'),
        'goodbye',
        'utf8'
      );
      // Commit the change:
      execSync('git add .', {cwd: fullRepoPath});
      execSync('git commit -a -m "feat: remove and add file"', {
        cwd: fullRepoPath,
      });
      // Grab the current sha:
      const sha = execSync('git rev-parse HEAD', {
        cwd: fullRepoPath,
      }).toString('utf8');
      const filesModified = await core.getFilesModifiedBySha(fullRepoPath, sha);
      assert.deepStrictEqual(filesModified, ['c.txt', 'a.txt']);
    });
  });
  describe('hasOwlBotLoop', () => {
    it('returns false if post processor not looping', async () => {
      const commits = [
        // Two PRs from gcf-owl-bot[bot] are expected: a PR to
        // submit files, followed by a commit from the post processor:
        {
          author: {
            login: 'gcf-owl-bot[bot]',
          },
        },
        {
          author: {
            login: 'gcf-owl-bot[bot]',
          },
        },
        {
          author: {
            login: 'bcoe',
          },
        },
        {
          author: {
            login: 'gcf-owl-bot[bot]',
          },
        },
      ];
      const githubMock = nock('https://api.github.com')
        .get('/repos/bcoe/foo/pulls/22/commits')
        .reply(200, commits);
      const loop = await core.hasOwlBotLoop('bcoe', 'foo', 22, new Octokit());
      assert.strictEqual(loop, false);
      githubMock.done();
    });
    it('returns true if post processor looping', async () => {
      const commits = [
        // Three commits from OwlBot in a row should not happen:
        {
          author: {
            login: 'gcf-owl-bot[bot]',
          },
        },
        {
          author: {
            login: 'gcf-owl-bot[bot]',
          },
        },
        {
          author: {
            login: 'gcf-owl-bot[bot]',
          },
        },
        {
          author: {
            login: 'bcoe',
          },
        },
      ];
      const githubMock = nock('https://api.github.com')
        .get('/repos/bcoe/foo/pulls/22/commits')
        .reply(200, commits);
      const loop = await core.hasOwlBotLoop('bcoe', 'foo', 22, new Octokit());
      assert.strictEqual(loop, true);
      githubMock.done();
    });
  });
});
