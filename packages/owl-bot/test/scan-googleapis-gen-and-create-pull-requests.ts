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
import {CopyStateStore} from '../src/copy-state-store';
import tmp from 'tmp';
import {copyTagFrom} from '../src/copy-code';
import {EMPTY_REGENERATE_CHECKBOX_TEXT} from '../src/create-pr';

// Use anys to mock parts of the octokit API.
// We'll still see compile time errors if in the src/ code if there's a type error
// calling the octokit APIs.
/* eslint-disable @typescript-eslint/no-explicit-any */

const cmd = newCmd();

class FakeCopyStateStore implements CopyStateStore {
  readonly store: Map<string, string> = new Map();

  makeKey(repo: {owner: string; repo: string}, copyTag: string) {
    return `${repo.owner}+${repo.repo}+${copyTag}`;
  }
  recordBuildForCopy(
    repo: {owner: string; repo: string},
    copyTag: string,
    buildId: string
  ): Promise<void> {
    this.store.set(this.makeKey(repo, copyTag), buildId);
    return Promise.resolve();
  }
  findBuildForCopy(
    repo: {owner: string; repo: string},
    copyTag: string
  ): Promise<string | undefined> {
    return Promise.resolve(this.store.get(this.makeKey(repo, copyTag)));
  }
}

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
          yamls: [
            {
              yaml: yaml,
              path: '.github/.OwlBot.yaml',
            },
          ],
        },
      ],
    ])
  );
  configsStore.githubRepos.set(destRepo.toString(), {
    repo: destRepo,
    yamlPath: '.github/.OwlBot.yaml',
  });
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
        {
          getGitHubShortLivedAccessToken: () => Promise.resolve(''),
        } as OctokitFactory,
        new FakeConfigsStore(),
        1000,
        new FakeCopyStateStore()
      ),
      0
    );
  });

  it('skips pull requests that were already created', async () => {
    const [dest, configsStore] = makeDestRepoAndConfigsStore(bYaml);
    const copyTag = cc.copyTagFrom('.github/.OwlBot.yaml', abcCommits[1]);
    const pulls = new FakePulls();
    pulls.create({body: `Copy-Tag: ${copyTag}`});
    const issues = new FakeIssues();
    const octokit = newFakeOctokit(pulls, issues);
    const copyStateStore = new FakeCopyStateStore();
    await copyStateStore.recordBuildForCopy(dest, copyTag, 'x');
    const prCount = await scanGoogleapisGenAndCreatePullRequests(
      abcRepo,
      factory(octokit),
      configsStore,
      undefined,
      copyStateStore
    );
    assert.strictEqual(prCount, 0);
  });

  it('copies files and creates a pull request (multicommit)', async () => {
    const [destRepo, configsStore] = makeDestRepoAndConfigsStore(bYaml);

    const pulls = new FakePulls();
    const issues = new FakeIssues();
    const octokit = newFakeOctokit(pulls, issues);
    const copyStateStore = new FakeCopyStateStore();
    await scanGoogleapisGenAndCreatePullRequests(
      abcRepo,
      factory(octokit),
      configsStore,
      undefined,
      copyStateStore
    );

    // Confirm it created one pull request.
    assert.strictEqual(pulls.pulls.length, 1);
    const pull = pulls.pulls[0];
    assert.strictEqual(pull.owner, 'googleapis');
    assert.strictEqual(pull.repo, 'nodejs-spell-check');
    assert.strictEqual(pull.title, 'b');
    assert.strictEqual(pull.base, 'main');
    const copyTag = cc.copyTagFrom('.github/.OwlBot.yaml', abcCommits[1]);
    assert.strictEqual(
      pull.body,
      `- [ ] Regenerate this pull request now.

Source-Link: https://github.com/googleapis/googleapis-gen/commit/${abcCommits[1]}
Copy-Tag: ${copyTag}`
    );

    // Confirm the pull request body contains a properly formatted Copy-Tag footer.
    assert.strictEqual(true, cc.bodyIncludesCopyTagFooter(pull.body));

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

    // Confirm the PR was recorded in firestore.
    assert.ok(await copyStateStore.findBuildForCopy(destRepo, copyTag));

    // Because the PR is recorded in firestore, a second call should skip
    // creating a new one.
    const prCount = await scanGoogleapisGenAndCreatePullRequests(
      abcRepo,
      factory(octokit),
      configsStore,
      undefined,
      copyStateStore
    );
    assert.strictEqual(prCount, 0);
  });

  it('copies files and appends a pull request', async () => {
    const [destRepo, configsStore] = makeDestRepoAndConfigsStore(bYaml);

    // Create a branch in the dest dir for the existing pull request.
    const destDir = destRepo.getCloneUrl();
    cmd('git branch owl-bot-copy', {cwd: destDir});

    // Create an existing pull request to be appended.
    const pullBody = 'This is the greatest pull request ever.';
    const pulls = new FakePulls();
    pulls.create({
      owner: 'googleapis',
      repo: 'nodejs-spell-check',
      title: 'q',
      body: pullBody,
      head: 'owl-bot-copy',
    });

    const issues = new FakeIssues();
    const octokit = newFakeOctokit(pulls, issues);
    const copyStateStore = new FakeCopyStateStore();
    await scanGoogleapisGenAndCreatePullRequests(
      abcRepo,
      factory(octokit),
      configsStore,
      undefined,
      copyStateStore
    );

    // Confirm it updated the body.
    const copyTag = cc.copyTagFrom('.github/.OwlBot.yaml', abcCommits[1]);
    assert.strictEqual(pulls.updates.length, 1);
    assert.deepStrictEqual(pulls.updates, [
      {
        owner: 'googleapis',
        repo: 'nodejs-spell-check',
        pull_number: 1,
        body:
          '- [ ] Regenerate this pull request now.\n\n' +
          `Source-Link: https://github.com/googleapis/googleapis-gen/commit/${abcCommits[1]}\n` +
          `Copy-Tag: ${copyTag}\n\nq\nThis is the greatest pull request ever.`,
        title: 'b',
      },
    ]);

    // Confirm the pull request branch contains the new file.
    cmd(`git checkout ${pulls.pulls[0].head}`, {cwd: destDir});
    const bpath = path.join(destDir, 'src', 'b.txt');
    assert.strictEqual(fs.readFileSync(bpath).toString('utf8'), '2');

    // But of course the main branch doesn't have it until the PR is merged.
    cmd('git checkout main', {cwd: destDir});
    assert.ok(!cc.stat(bpath));

    // Confirm the PR was recorded in firestore.
    assert.ok(await copyStateStore.findBuildForCopy(destRepo, copyTag));

    // Because the PR is recorded in firestore, a second call should skip
    // creating a new one.
    const prCount = await scanGoogleapisGenAndCreatePullRequests(
      abcRepo,
      factory(octokit),
      configsStore,
      undefined,
      copyStateStore
    );
    assert.strictEqual(prCount, 0);
  });

  it('creates 1 pull requests for 3 matching commits', async () => {
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
      configsStore,
      1000,
      new FakeCopyStateStore()
    );

    // Confirm it created one pull request.
    assert.strictEqual(pulls.pulls.length, 1);
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
      configsStore,
      1000,
      new FakeCopyStateStore()
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
      configsStore,
      1000,
      new FakeCopyStateStore()
    );

    // Confirm it created one pull request.
    assert.strictEqual(pulls.pulls.length, 1);
  });
});

describe('regenerate pull requests', function () {
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

  it('regenerates a pull request', async () => {
    const destRepo = makeDestRepo(bYaml);
    const pulls = new FakePulls();
    const issues = new FakeIssues();
    const octokit = newFakeOctokit(pulls, issues);
    const factory = newFakeOctokitFactory(octokit, 'test-token');

    // Create the pull request.
    pulls.create({});

    // Create a pull request branch with two more commits.
    const destDir = destRepo.getCloneUrl();
    cmd('git checkout -b pull-branch', {cwd: destDir});
    const f1 = tmp.fileSync();
    const commitMessage1 = `pull-commit-1

Copy-Tag: ${copyTagFrom('.github/.OwlBot.yaml', abcCommits[1])}`;
    fs.writeSync(f1.fd, commitMessage1);
    fs.close(f1.fd);
    cmd(`git commit --allow-empty -F ${f1.name}`, {cwd: destDir});
    const f2 = tmp.fileSync();
    const commitMessage2 = `pull-commit-2

Copy-Tag: ${copyTagFrom('.github/.OwlBot.yaml', abcCommits[2])}`;
    fs.writeSync(f2.fd, commitMessage2);
    fs.close(f2.fd);
    cmd(`git commit --allow-empty -F ${f2.name}`, {cwd: destDir});

    // Switch back to the main branch.
    cmd('git checkout main', {cwd: destDir});

    await cc.regeneratePullRequest(
      abcRepo,
      {repo: destRepo, yamlPath: '.github/.OwlBot.yaml'},
      'pull-branch',
      factory
    );

    // Confirm commit messages were merged and pushed to pull-branch.
    const gitLog = cmd('git log -1 --format=%B pull-branch', {
      cwd: destDir,
    }).toString('utf-8');
    assert.strictEqual(gitLog, `${commitMessage2}\n\n${commitMessage1}\n\n`);

    // Confirm the pull request body was updated.
    // The first line of commitMessage2 becomes PR title.
    const newline = commitMessage2.indexOf('\n');
    const body2 = commitMessage2.slice(newline).trim();
    assert.deepStrictEqual(pulls.updates, [
      {
        body: `${EMPTY_REGENERATE_CHECKBOX_TEXT}\n\n${body2}\n\n${commitMessage1}\n\n`,
        owner: 'googleapis',
        pull_number: 1,
        repo: 'nodejs-spell-check',
        title: 'pull-commit-2',
      },
    ]);
  });
});
