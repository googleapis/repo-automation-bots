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
import {Octokit} from '@octokit/rest';
import {scanGoogleapisGenAndCreatePullRequests} from '../src/scan-googleapis-gen-and-create-pull-requests';
import * as cc from '../src/copy-code';
import {OctokitFactory} from '../src/octokit-util';
import {DEFAULT_OWL_BOT_YAML_PATH, OwlBotYaml} from '../src/config-files';
import * as fs from 'fs';
import path from 'path';
import {GithubRepo} from '../src/github-repo';
import {FakeConfigsStore} from './fake-configs-store';
import {ConfigsStore, OwlBotYamlAndPath} from '../src/configs-store';
import {makeAbcRepo, makeRepoWithOwlBotYaml} from './make-repos';
import {newCmd} from '../src/cmd';
import {
  FakeIssues,
  FakePulls,
  newFakeOctokit,
  newFakeOctokitFactory,
} from './fake-octokit';
import tmp from 'tmp';
import {copyTagFrom} from '../src/copy-code';
import {
  EMPTY_REGENERATE_CHECKBOX_TEXT,
  WithNestedCommitDelimiters,
} from '../src/create-pr';
import {FakeCopyStateStore} from '../src/fake-copy-state-store';

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
    getShortLivedOctokit(): Promise<Octokit> {
      return Promise.resolve(octokit as Octokit);
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
function makeDestRepo(
  yaml: OwlBotYaml,
  moreYamls: OwlBotYamlAndPath[] = []
): GithubRepo {
  const destDir = makeRepoWithOwlBotYaml(yaml, moreYamls);
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
  yaml: OwlBotYaml,
  moreYamls: OwlBotYamlAndPath[] = []
): [GithubRepo, ConfigsStore] {
  const destRepo: GithubRepo = makeDestRepo(yaml, moreYamls);

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
            ...moreYamls,
          ],
        },
      ],
    ])
  );
  configsStore.githubRepos.set(destRepo.toString(), {
    repo: destRepo,
    yamls: [{path: '.github/.OwlBot.yaml', yaml}, ...moreYamls],
  });
  return [destRepo, configsStore];
}

describe('scanGoogleapisGenAndCreatePullRequests', function () {
  // These tests use git locally and read and write a lot to the file system,
  // so a slow file system will slow them down.
  this.timeout(3600000); // 1 hour.

  let abcRepo = '';
  let abcCommits: string[] = [];
  before(() => {
    abcRepo = makeAbcRepo();
    abcCommits = cmd('git log --format=%H', {cwd: abcRepo})
      .toString('utf8')
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(s => s);
  });

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

  it('copies files and creates a pull request', async () => {
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

  it('copies files and creates 2 pull requests when combinePulls=false', async () => {
    const anotherYaml: OwlBotYaml = {
      'deep-copy-regex': [
        {
          source: '/b.txt',
          dest: '/another/b.txt',
        },
      ],
    };
    const [, configsStore] = makeDestRepoAndConfigsStore(bYaml, [
      {
        yaml: anotherYaml,
        path: 'SpellCheck/.OwlBot.yaml',
      },
    ]);

    const pulls = new FakePulls();
    pulls.list = () => {
      return Promise.resolve({data: []});
    };
    const issues = new FakeIssues();
    const octokit = newFakeOctokit(pulls, issues);
    const copyStateStore = new FakeCopyStateStore();
    await scanGoogleapisGenAndCreatePullRequests(
      abcRepo,
      factory(octokit),
      configsStore,
      undefined,
      copyStateStore,
      Number.MAX_SAFE_INTEGER
    );

    // Confirm it created two pull requests.
    assert.strictEqual(pulls.pulls.length, 2);

    // Confirm both were recorded in the copy state store.
    assert.strictEqual(copyStateStore.store.size, 2);
  });

  it('copies files and creates 1 pull request when combinePulls=true', async () => {
    const anotherYaml: OwlBotYaml = {
      'deep-copy-regex': [
        {
          source: '/b.txt',
          dest: '/another/b.txt',
        },
      ],
    };
    const [, configsStore] = makeDestRepoAndConfigsStore(bYaml, [
      {
        yaml: anotherYaml,
        path: 'SpellCheck/.OwlBot.yaml',
      },
    ]);

    const pulls = new FakePulls();
    pulls.list = () => {
      return Promise.resolve({data: []});
    };
    const issues = new FakeIssues();
    const octokit = newFakeOctokit(pulls, issues);
    const copyStateStore = new FakeCopyStateStore();
    await scanGoogleapisGenAndCreatePullRequests(
      abcRepo,
      factory(octokit),
      configsStore,
      undefined,
      copyStateStore,
      1
    );

    // Confirm it created one combined pull request.
    assert.strictEqual(pulls.pulls.length, 1);

    // The pull request should have both copy tags.
    assert.strictEqual(cc.findCopyTags(pulls.pulls[0].body).length, 2);

    // Confirm both were recorded in the copy state store.
    assert.strictEqual(copyStateStore.store.size, 2);
  });

  it('copies files and creates 2 pull requests when maxYamlCountPerPullRequest=1', async () => {
    const anotherYaml: OwlBotYaml = {
      'deep-copy-regex': [
        {
          source: '/b.txt',
          dest: '/another/b.txt',
        },
      ],
    };
    const [, configsStore] = makeDestRepoAndConfigsStore(bYaml, [
      {
        yaml: anotherYaml,
        path: 'SpellCheck/.OwlBot.yaml',
      },
    ]);

    const pulls = new FakePulls();
    pulls.list = () => {
      return Promise.resolve({data: []});
    };
    const issues = new FakeIssues();
    const octokit = newFakeOctokit(pulls, issues);
    const copyStateStore = new FakeCopyStateStore();
    await scanGoogleapisGenAndCreatePullRequests(
      abcRepo,
      factory(octokit),
      configsStore,
      undefined,
      copyStateStore,
      1, // combinePullsThreshold
      undefined,
      undefined,
      1 // maxYamlCountPerPullRequest
    );

    // Confirm it created two pull requests.
    assert.strictEqual(pulls.pulls.length, 2);

    // Confirm both were recorded in the copy state store.
    assert.strictEqual(copyStateStore.store.size, 2);
  });

  it('updates a bulk PR', async () => {
    const anotherYaml: OwlBotYaml = {
      'deep-copy-regex': [
        {
          source: '/b.txt',
          dest: '/another/b.txt',
        },
      ],
    };
    const [destRepo, configsStore] = makeDestRepoAndConfigsStore(bYaml, [
      {
        yaml: anotherYaml,
        path: 'SpellCheck/.OwlBot.yaml',
      },
    ]);

    // Create a branch in the dest dir for the existing pull request.
    const destDir = destRepo.getCloneUrl();
    const headBranch = cc.branchNameForCopies([
      '.github/.OwlBot.yaml',
      'SpellCheck/.OwlBot.yaml',
    ]);
    cmd(`git branch ${headBranch}`, {cwd: destDir});

    const pulls = new FakePulls();
    pulls.list = ({head}) => {
      if (
        head === 'googleapis:owl-bot-copy' ||
        head === 'googleapis:owl-bot-copy-SpellCheck'
      ) {
        return Promise.resolve({data: []});
      }
      const pullBody = 'This is the greatest pull request ever.';
      return Promise.resolve({
        data: [
          {
            owner: 'googleapis',
            repo: 'nodejs-spell-check',
            title: 'q',
            body: pullBody,
            head: headBranch,
          },
        ],
      });
    };
    const issues = new FakeIssues();
    const octokit = newFakeOctokit(pulls, issues);
    const copyStateStore = new FakeCopyStateStore();
    await scanGoogleapisGenAndCreatePullRequests(
      abcRepo,
      factory(octokit),
      configsStore,
      undefined,
      copyStateStore,
      1, // combinePullsThreshold
      undefined,
      undefined,
      5 // maxYamlCountPerPullRequest
    );

    // Confirm it created two pull requests.
    assert.strictEqual(pulls.updates.length, 1);

    // Confirm both were recorded in the copy state store.
    assert.strictEqual(copyStateStore.store.size, 2);
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

  it('copies files and appends a pull request with nested commit tags', async () => {
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
      copyStateStore,
      undefined,
      undefined,
      WithNestedCommitDelimiters.Yes
    );
    assert.strictEqual(prCount, 0);
  });

  it('reports error for corrupt yaml in new pull request', async () => {
    const [destRepo, configsStore] = makeDestRepoAndConfigsStore(bYaml);

    // Corrupt the yaml.
    const destDir = destRepo.getCloneUrl();
    fs.writeFileSync(path.join(destDir, DEFAULT_OWL_BOT_YAML_PATH), 'corrupt');
    cmd('git commit --amend --no-edit -a', {cwd: destDir});

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

    // Confirm it created no pull request.
    assert.strictEqual(pulls.pulls.length, 0);

    // Confirm it created an issue.
    assert.strictEqual(issues.issues.length, 1);

    // Confirm the PR was recorded in firestore.
    const copyTag = cc.copyTagFrom('.github/.OwlBot.yaml', abcCommits[1]);
    assert.ok(await copyStateStore.findBuildForCopy(destRepo, copyTag));
  });

  it('reports error for corrupt yaml while appending PR', async () => {
    const [destRepo, configsStore] = makeDestRepoAndConfigsStore(bYaml);

    // Create a branch in the dest dir for the existing pull request.
    const destDir = destRepo.getCloneUrl();
    cmd('git checkout -b owl-bot-copy', {cwd: destDir});
    fs.writeFileSync(path.join(destDir, DEFAULT_OWL_BOT_YAML_PATH), 'corrupt');
    cmd('git commit --amend --no-edit -a', {cwd: destDir});
    cmd('git checkout main', {cwd: destDir});

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

    // Confirm it didn't add commits to the exiting pull request.
    assert.strictEqual(pulls.updates.length, 0);

    // Confirm it created a comment on the open pull request.
    assert.strictEqual(pulls.reviewComments.length, 1);

    // Confirm the PR was recorded in firestore.
    const copyTag = cc.copyTagFrom('.github/.OwlBot.yaml', abcCommits[1]);
    assert.ok(await copyStateStore.findBuildForCopy(destRepo, copyTag));
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

  it('skips a repo when path is in CONFIG_PATHS_TO_SKIP', async () => {
    const skipPath =
      'packages/gapic-node-processing/templates/bootstrap-templates/.OwlBot.yaml';
    const [destRepo, configsStore] = makeDestRepoAndConfigsStore(bYaml);

    // Override the yaml path in the config store to be one of the skipped paths
    const config = (configsStore as FakeConfigsStore).configs.get(
      destRepo.toString()
    );
    if (config && config.yamls) {
      config.yamls[0].path = skipPath;
    }

    const pulls = new FakePulls();
    const octokit = newFakeOctokit(pulls);
    const copyStateStore = new FakeCopyStateStore();

    const prCount = await scanGoogleapisGenAndCreatePullRequests(
      abcRepo,
      factory(octokit),
      configsStore,
      1000,
      copyStateStore
    );

    // Should be 0 because we skipped it
    assert.strictEqual(prCount, 0);
  });
});

describe('regenerate pull requests', function () {
  // These tests use git locally and read and write a lot to the file system,
  // so a slow file system will slow them down.
  this.timeout(60000); // 1 minute.

  let abcRepo = '';
  let abcCommits: string[] = [];
  before(() => {
    abcRepo = makeAbcRepo();
    abcCommits = cmd('git log --format=%H', {cwd: abcRepo})
      .toString('utf8')
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(s => s);
  });

  let destRepo!: GithubRepo;
  let pulls!: FakePulls;
  let issues!: FakeIssues;
  let octokit!: Octokit;
  let factory!: OctokitFactory;
  let commitMessage1 = '';
  let commitMessage2 = '';
  let destDir = '';
  beforeEach(() => {
    cmd('git checkout main', {cwd: abcRepo});
    destRepo = makeDestRepo(bYaml);
    pulls = new FakePulls();
    issues = new FakeIssues();
    octokit = newFakeOctokit(pulls, issues);
    factory = newFakeOctokitFactory(octokit, 'test-token');

    // Create the pull request.
    pulls.create({});

    // Create a pull request branch with three more commits.
    destDir = destRepo.getCloneUrl();
    cmd('git checkout -b pull-branch', {cwd: destDir});
    const f1 = tmp.fileSync();
    commitMessage1 = `pull-commit-1

Copy-Tag: ${copyTagFrom('.github/.OwlBot.yaml', abcCommits[1])}`;
    fs.writeSync(f1.fd, commitMessage1);
    fs.close(f1.fd);
    cmd(`git commit --allow-empty -F ${f1.name}`, {cwd: destDir});

    // This commit doesn't have a copy tag and shouldn't be included in
    // the body of the regenerated pull request.
    cmd('git commit --allow-empty -m "Updates from OwlBot"', {cwd: destDir});

    const f2 = tmp.fileSync();
    commitMessage2 = `pull-commit-2

Copy-Tag: ${copyTagFrom('.github/.OwlBot.yaml', abcCommits[2])}`;
    fs.writeSync(f2.fd, commitMessage2);
    fs.close(f2.fd);
    cmd(`git commit --allow-empty -F ${f2.name}`, {cwd: destDir});

    // Switch back to the main branch.
    cmd('git checkout main', {cwd: destDir});
  });

  it('regenerates a pull request', async () => {
    await cc.copyCodeIntoPullRequest(abcRepo, destRepo, 'pull-branch', factory);

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
        body: `${EMPTY_REGENERATE_CHECKBOX_TEXT}\n\n${body2}\n\n${commitMessage1}`,
        owner: 'googleapis',
        pull_number: 1,
        repo: 'nodejs-spell-check',
        title: 'pull-commit-2',
      },
    ]);
  });

  it('appends a pull request', async () => {
    await cc.copyCodeIntoPullRequest(
      abcRepo,
      destRepo,
      'pull-branch',
      factory,
      'append'
    );

    // Confirm new commit message.
    const gitLog = cmd('git log -1 --format=%B pull-branch', {
      cwd: destDir,
    }).toString('utf-8');
    const expected = `Owl Bot copied code from https://github.com/${abcRepo}/commit/${abcCommits[2]}\n\n`;
    assert.strictEqual(gitLog, expected);

    // Confirm we didn't call github API to change pull request.
    assert.deepStrictEqual(pulls.updates, []);
  });
});
