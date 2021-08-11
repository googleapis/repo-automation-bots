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

import * as assert from 'assert';
import {describe, it} from 'mocha';
import {scanGoogleapisGenAndCreatePullRequests} from '../src/scan-googleapis-gen-and-create-pull-requests';
import * as cc from '../src/copy-code';
import {OctokitFactory, OctokitType} from '../src/octokit-util';
import {OwlBotYaml} from '../src/config-files';
import * as fs from 'fs';
import path from 'path';
import {GithubRepo} from '../src/github-repo';
import {FakeConfigsStore} from './fake-configs-store';
import {ConfigsStore} from '../src/configs-store';
import {makeAbcRepo, makeRepoWithOwlBotYaml} from './make-repos';
import {newCmd} from '../src/cmd';
import {
  FakeIssues,
  FakePulls,
  newFakeOctokit,
  newFakeOctokitFactory,
} from './fake-octokit';

// Use anys to mock parts of the octokit API.
// We'll still see compile time errors if in the src/ code if there's a type error
// calling the octokit APIs.
/* eslint-disable @typescript-eslint/no-explicit-any */

const cmd = newCmd();

function factory(octokit: any): OctokitFactory {
  return {
    getGitHubShortLivedAccessToken(): Promise<string> {
      return Promise.resolve('fake-token');
    },
    getShortLivedOctokit(): Promise<OctokitType> {
      return Promise.resolve(octokit as OctokitType);
    },
  };
}

const bYaml: OwlBotYaml = {
  'deep-copy-regex': [
    {
      source: '/b.txt',
      dest: '/src/b.txt',
    },
  ],
  'deep-remove-regex': ['/src'],
};

/**
 * Makes a local destination repo where files will be copied to.
 */
function makeDestRepo(yaml: OwlBotYaml): GithubRepo {
  const destDir = makeRepoWithOwlBotYaml(yaml);
  const destRepo: GithubRepo = {
    owner: 'googleapis',
    repo: 'nodejs-spell-check',
    getCloneUrl(): string {
      return destDir;
    },
    toString() {
      return `${this.owner}/${this.repo}`;
    },
  };
  return destRepo;
}

function makeDestRepoAndConfigsStore(
  yaml: OwlBotYaml
): [GithubRepo, ConfigsStore] {
  const destRepo: GithubRepo = makeDestRepo(yaml);

  const configsStore = new FakeConfigsStore(
    new Map([
      [
        destRepo.toString(),
        {
          branchName: 'main',
          commitHash: '456',
          installationId: 42,
          yaml: yaml,
        },
      ],
    ])
  );
  configsStore.githubRepos.set(destRepo.toString(), destRepo);
  return [destRepo, configsStore];
}

describe('scanGoogleapisGenAndCreatePullRequests', function () {
  // These tests use git locally and read and write a lot to the file system,
  // so a slow file system will slow them down.
  this.timeout(60000); // 1 minute.
  const abcRepo = makeAbcRepo();
  const abcCommits = cmd('git log --format=%H', {cwd: abcRepo})
    .toString('utf8')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s);

  beforeEach(() => {
    cmd('git checkout main', {cwd: abcRepo});
  });

  it('does nothing with zero repos affected', async () => {
    assert.strictEqual(
      await scanGoogleapisGenAndCreatePullRequests(
        abcRepo,
        {} as OctokitFactory,
        new FakeConfigsStore()
      ),
      0
    );
  });

  it('copies files and creates a pull request', async () => {
    const [destRepo, configsStore] = makeDestRepoAndConfigsStore(bYaml);

    const pulls = new FakePulls();
    const issues = new FakeIssues();
    const octokit = newFakeOctokit(pulls, issues);
    await scanGoogleapisGenAndCreatePullRequests(
      abcRepo,
      factory(octokit),
      configsStore
    );

    // Confirm it created one pull request.
    assert.strictEqual(pulls.pulls.length, 1);
    const pull = pulls.pulls[0];
    assert.strictEqual(pull.owner, 'googleapis');
    assert.strictEqual(pull.repo, 'nodejs-spell-check');
    assert.strictEqual(pull.title, 'b');
    assert.strictEqual(pull.base, 'main');
    assert.strictEqual(
      pull.body,
      `Source-Link: https://github.com/googleapis/googleapis-gen/commit/${abcCommits[1]}`
    );

    // Confirm it set the label.
    assert.deepStrictEqual(issues.updates[0].labels, ['owl-bot-copy']);

    // Confirm the pull request branch contains the new file.
    const destDir = destRepo.getCloneUrl();
    cmd(`git checkout ${pull.head}`, {cwd: destDir});
    const bpath = path.join(destDir, 'src', 'b.txt');
    assert.strictEqual(fs.readFileSync(bpath).toString('utf8'), '2');

    // But of course the main branch doesn't have it until the PR is merged.
    cmd('git checkout main', {cwd: destDir});
    assert.ok(!cc.stat(bpath));
  });

  it('creates 3 pull requests for 3 matching commits', async () => {
    const myYaml = JSON.parse(JSON.stringify(bYaml)) as OwlBotYaml;
    myYaml['deep-copy-regex']?.push({
      source: '/.*',
      dest: '/$1',
    });

    const [, configsStore] = makeDestRepoAndConfigsStore(myYaml);

    const pulls = new FakePulls();
    const octokit = newFakeOctokit(pulls);
    await scanGoogleapisGenAndCreatePullRequests(
      abcRepo,
      factory(octokit),
      configsStore
    );

    // Confirm it created one pull request.
    assert.strictEqual(pulls.pulls.length, 3);
  });

  it('ignores pull requests older than begin', async () => {
    const myYaml = JSON.parse(JSON.stringify(bYaml)) as OwlBotYaml;
    myYaml['deep-copy-regex']?.push({
      source: '/.*',
      dest: '/$1',
    });
    myYaml['begin-after-commit-hash'] = abcCommits[1];

    const [, configsStore] = makeDestRepoAndConfigsStore(myYaml);

    const pulls = new FakePulls();
    const octokit = newFakeOctokit(pulls);
    await scanGoogleapisGenAndCreatePullRequests(
      abcRepo,
      factory(octokit),
      configsStore
    );

    // Confirm it created one pull request.
    assert.strictEqual(pulls.pulls.length, 1);
  });

  it('ignores no pull requests when begin not found', async () => {
    const myYaml = JSON.parse(JSON.stringify(bYaml)) as OwlBotYaml;
    myYaml['begin-after-commit-hash'] = 'bogus-commit-hash';

    const [, configsStore] = makeDestRepoAndConfigsStore(myYaml);

    const pulls = new FakePulls();
    const octokit = newFakeOctokit(pulls);
    await scanGoogleapisGenAndCreatePullRequests(
      abcRepo,
      factory(octokit),
      configsStore
    );

    // Confirm it created one pull request.
    assert.strictEqual(pulls.pulls.length, 1);
  });
});

describe('copyCodeIntoPullRequest', function () {
  // These tests use git locally and read and write a lot to the file system,
  // so a slow file system will slow them down.
  this.timeout(60000); // 1 minute.
  const abcRepo = makeAbcRepo();
  const abcCommits = cmd('git log --format=%H', {cwd: abcRepo})
    .toString('utf8')
    .split(/\r?\n/)
    .map(s => s.trim())
    .filter(s => s);

  beforeEach(() => {
    cmd('git checkout main', {cwd: abcRepo});
  });

  it('copies files into a pull request', async () => {
    const destRepo = makeDestRepo(bYaml);
    const pulls = new FakePulls();
    const issues = new FakeIssues();
    const octokit = newFakeOctokit(pulls, issues);
    const factory = newFakeOctokitFactory(octokit, 'test-token');
    const sourceHash = abcCommits[1];

    await cc.copyCodeIntoPullRequest(
      abcRepo,
      sourceHash,
      destRepo,
      'test-branch',
      factory
    );
    // Confirm new pull request was pushed to test-branch.
    const destDir = destRepo.getCloneUrl();
    const gitLog = cmd('git log test-branch', {cwd: destDir}).toString('utf-8');
    assert.match(
      gitLog,
      RegExp(
        `.*Source-Link: https://github.com/googleapis/googleapis-gen/commit/${sourceHash}.*`
      )
    );
  });
});
