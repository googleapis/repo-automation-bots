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
// import * as assert from 'assert';

// There are lots of unused args on fake functions, and that's ok.
/* eslint-disable @typescript-eslint/no-unused-vars */

import * as assert from 'assert';
import {describe, it, afterEach} from 'mocha';

import {
  createOnePullRequestForUpdatingLock,
  refreshConfigs,
  scanGithubForConfigs,
} from '../src/handlers';
import {Configs, ConfigsStore} from '../src/configs-store';
import {dump} from 'js-yaml';
import * as suggester from 'code-suggester';
import {Octokit} from '@octokit/rest';
import * as sinon from 'sinon';
import {OwlBotLock} from '../src/config-files';
import {
  core,
  getAuthenticatedOctokit,
  getGitHubShortLivedAccessToken,
} from '../src/core';
import {FakeConfigsStore} from './fake-configs-store';
import {GithubRepo} from '../src/github-repo';
const sandbox = sinon.createSandbox();

type Changes = Array<[string, {content: string; mode: string}]>;

describe('handlers', () => {
  afterEach(() => {
    sandbox.restore();
  });
  describe('createOnePullRequestForUpdatingLock', () => {
    it('updates .github/.OwlBot.lock.yaml if no pull request found', async () => {
      const lock = {
        docker: {
          image: 'foo-image',
          digest: 'sha256:abc123',
        },
      };
      const expectedYaml = dump(lock);
      let recordedURI = '';
      // Mock the database helpers used to check for/update existing PRs:
      class FakeConfigStore implements ConfigsStore {
        findReposAffectedByFileChanges(
          changedFilePaths: string[]
        ): Promise<GithubRepo[]> {
          throw new Error('Method not implemented.');
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        getConfigs(repo: string): Promise<Configs | undefined> {
          throw new Error('Method not implemented.');
        }
        storeConfigs(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          repo: string,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          configs: Configs,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          replaceCommithash: string | null
        ): Promise<boolean> {
          throw new Error('Method not implemented.');
        }
        findReposWithPostProcessor(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          dockerImageName: string
        ): Promise<[string, Configs][]> {
          throw new Error('Method not implemented.');
        }
        findPullRequestForUpdatingLock(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          repo: string,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          lock: OwlBotLock
        ): Promise<string | undefined> {
          return Promise.resolve(undefined);
        }
        recordPullRequestForUpdatingLock(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          repo: string,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          lock: OwlBotLock,
          pullRequestId: string
        ): Promise<string> {
          recordedURI = pullRequestId;
          return Promise.resolve(recordedURI);
        }
      }
      const fakeConfigStore = new FakeConfigStore();
      // Mock the method from code-suggester that opens the upstream
      // PR on GitHub:
      let expectedChanges: Changes = [];
      sandbox.replace(
        suggester,
        'createPullRequest',
        (_octokit, changes): Promise<number> => {
          if (changes) {
            expectedChanges = [...((changes as unknown) as Changes)];
          }
          return Promise.resolve(22);
        }
      );

      const expectedURI = await createOnePullRequestForUpdatingLock(
        fakeConfigStore,
        new Octokit(), // Not actually used.
        'owl/test',
        lock
      );
      assert.strictEqual(expectedURI, 'https://github.com/owl/test/pull/22');
      assert.strictEqual(recordedURI, 'https://github.com/owl/test/pull/22');
      assert.strictEqual(expectedChanges[0][1].content, expectedYaml);
    });
    it('returns existing pull request URI, if PR has already been created', async () => {
      const lock = {
        docker: {
          image: 'foo-image',
          digest: 'sha256:abc123',
        },
      };
      // Mock the database helpers used to check for/update existing PRs:
      class FakeConfigStore implements ConfigsStore {
        findReposAffectedByFileChanges(
          changedFilePaths: string[]
        ): Promise<GithubRepo[]> {
          throw new Error('Method not implemented.');
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        getConfigs(repo: string): Promise<Configs | undefined> {
          throw new Error('Method not implemented.');
        }
        storeConfigs(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          repo: string,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          configs: Configs,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          replaceCommithash: string | null
        ): Promise<boolean> {
          throw new Error('Method not implemented.');
        }
        findReposWithPostProcessor(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          dockerImageName: string
        ): Promise<[string, Configs][]> {
          throw new Error('Method not implemented.');
        }
        findPullRequestForUpdatingLock(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          repo: string,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          lock: OwlBotLock
        ): Promise<string | undefined> {
          return Promise.resolve('https://github.com/owl/test/pull/99');
        }
        recordPullRequestForUpdatingLock(
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          repo: string,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          lock: OwlBotLock,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          pullRequestId: string
        ): Promise<string> {
          throw new Error('Method not implemented.');
        }
      }
      const fakeConfigStore = new FakeConfigStore();
      const expectedURI = await createOnePullRequestForUpdatingLock(
        fakeConfigStore,
        new Octokit(), // Not actually used.
        'owl/test',
        lock
      );
      assert.strictEqual(expectedURI, 'https://github.com/owl/test/pull/99');
    });
  });
});

describe('refreshConfigs', () => {
  afterEach(() => {
    sandbox.restore();
  });

  const octokitSha123 = ({
    repos: {
      getBranch() {
        return {
          data: {
            commit: {
              sha: '123',
            },
          },
        };
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as InstanceType<typeof Octokit>;

  it('stores a good yaml', async () => {
    const configsStore = new FakeConfigsStore();
    sandbox.stub(core, 'getFileContent').resolves(`
      docker:
        image: gcr.io/repo-automation-bots/nodejs-post-processor:latest
    `);

    await refreshConfigs(
      configsStore,
      undefined,
      octokitSha123,
      'googleapis',
      'nodejs-vision',
      'main',
      42
    );

    assert.deepStrictEqual(
      configsStore.configs,
      new Map([
        [
          'googleapis/nodejs-vision',
          {
            branchName: 'main',
            commitHash: '123',
            installationId: 42,
            yaml: {
              docker: {
                image:
                  'gcr.io/repo-automation-bots/nodejs-post-processor:latest',
              },
            },
          },
        ],
      ])
    );
  });

  it('stores a good lock.yaml', async () => {
    const configsStore = new FakeConfigsStore();
    sandbox.stub(core, 'getFileContent').resolves(`
      docker:
        image: gcr.io/repo-automation-bots/nodejs-post-processor:latest
        digest: sha256:abcdef
    `);

    await refreshConfigs(
      configsStore,
      undefined,
      octokitSha123,
      'googleapis',
      'nodejs-vision',
      'main',
      42
    );

    assert.deepStrictEqual(
      configsStore.configs,
      new Map([
        [
          'googleapis/nodejs-vision',
          {
            branchName: 'main',
            commitHash: '123',
            installationId: 42,
            lock: {
              docker: {
                digest: 'sha256:abcdef',
                image:
                  'gcr.io/repo-automation-bots/nodejs-post-processor:latest',
              },
            },
          },
        ],
      ])
    );
  });

  it('stores empty config files', async () => {
    const configsStore = new FakeConfigsStore();
    sandbox.stub(core, 'getFileContent').resolves(undefined);

    await refreshConfigs(
      configsStore,
      undefined,
      octokitSha123,
      'googleapis',
      'nodejs-vision',
      'main',
      42
    );

    assert.deepStrictEqual(
      configsStore.configs,
      new Map([
        [
          'googleapis/nodejs-vision',
          {
            branchName: 'main',
            commitHash: '123',
            installationId: 42,
          },
        ],
      ])
    );
  });

  it("stores nothing when there's a mid-air collision", async () => {
    const configsStore = new FakeConfigsStore(
      new Map([
        [
          'googleapis/nodejs-vision',
          {
            branchName: 'main',
            commitHash: '456',
            installationId: 42,
          },
        ],
      ])
    );
    sandbox.stub(core, 'getFileContent').resolves(undefined);

    await refreshConfigs(
      configsStore,
      undefined,
      octokitSha123,
      'googleapis',
      'nodejs-vision',
      'main',
      77
    );

    assert.deepStrictEqual(
      configsStore.configs,
      new Map([
        [
          'googleapis/nodejs-vision',
          {
            branchName: 'main',
            commitHash: '456',
            installationId: 42,
          },
        ],
      ])
    );
  });

  it('stores nothing when the configs are up to date', async () => {
    const configs: Configs = {
      branchName: 'main',
      commitHash: '123',
      installationId: 42,
    };
    const configsStore = new FakeConfigsStore();
    sandbox.stub(core, 'getFileContent').resolves(undefined);

    await refreshConfigs(
      configsStore,
      configs,
      octokitSha123,
      'googleapis',
      'nodejs-vision',
      'main',
      77
    );

    assert.deepStrictEqual(configsStore.configs, new Map());
  });
});

describe('scanGithubForConfigs', () => {
  afterEach(() => {
    sandbox.restore();
  });

  const octokitWithRepos = ({
    repos: {
      getBranch() {
        return {
          data: {
            commit: {
              sha: '123',
            },
          },
        };
      },
      listForOrg: {
        endpoint: {
          merge() {
            return 'merge';
          },
        },
      },
    },
    paginate: {
      iterator() {
        return [
          {
            name: 'nodejs-vision',
            default_branch: 'main',
          },
          {
            name: 'java-speech',
          },
          {
            name: 'python-iap',
            default_branch: 'master',
          },
        ].map(configs => {
          return Promise.resolve({data: [configs]});
        });
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as InstanceType<typeof Octokit>;

  const octokitWith404OnBranch = ({
    repos: {
      getBranch() {
        throw Object.assign(Error('Not Found'), {status: 404});
      },
      listForOrg: {
        endpoint: {
          merge() {
            return 'merge';
          },
        },
      },
    },
    paginate: {
      iterator() {
        return [
          {
            name: 'nodejs-vision',
            default_branch: 'main',
          },
        ].map(configs => {
          return Promise.resolve({data: [configs]});
        });
      },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any) as InstanceType<typeof Octokit>;

  it('works with an installationId', async () => {
    const configsStore = new FakeConfigsStore();
    sandbox.stub(core, 'getFileContent').resolves(`
      docker:
        image: gcr.io/repo-automation-bots/nodejs-post-processor:latest
    `);
    await scanGithubForConfigs(
      configsStore,
      octokitWithRepos,
      'googleapis',
      45
    );

    assert.deepStrictEqual(
      configsStore.configs,
      new Map([
        [
          'googleapis/java-speech',
          {
            branchName: 'master',
            commitHash: '123',
            installationId: 45,
            yaml: {
              docker: {
                image:
                  'gcr.io/repo-automation-bots/nodejs-post-processor:latest',
              },
            },
          },
        ],
        [
          'googleapis/nodejs-vision',
          {
            branchName: 'main',
            commitHash: '123',
            installationId: 45,
            yaml: {
              docker: {
                image:
                  'gcr.io/repo-automation-bots/nodejs-post-processor:latest',
              },
            },
          },
        ],
        [
          'googleapis/python-iap',
          {
            branchName: 'master',
            commitHash: '123',
            installationId: 45,
            yaml: {
              docker: {
                image:
                  'gcr.io/repo-automation-bots/nodejs-post-processor:latest',
              },
            },
          },
        ],
      ])
    );
  });

  it('recovers from 404 when scanning configs', async () => {
    const configsStore = new FakeConfigsStore();
    sandbox.stub(core, 'getFileContent').resolves(`
      docker:
        image: gcr.io/repo-automation-bots/nodejs-post-processor:latest
    `);
    await scanGithubForConfigs(
      configsStore,
      octokitWith404OnBranch,
      'googleapis',
      45
    );
  });
});
