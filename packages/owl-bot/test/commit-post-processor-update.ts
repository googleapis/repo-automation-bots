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

import {describe, it} from 'mocha';
import * as assert from 'assert';
import tmp from 'tmp';
import {makeDirTree} from './dir-tree';
import {newCmd} from '../src/cmd';
import {commitPostProcessorUpdate} from '../src/bin/commands/commit-post-processor-update';
import {copyTagFrom} from '../src/copy-code';
import sinon from 'sinon';
import nock from 'nock';
import {OWL_BOT_IGNORE, OWLBOT_RUN_LABEL} from '../src/labels';
import * as fs from 'fs';
import {OWL_BOT_COPY} from '../src/core';

export function makeOrigin(logger = console): string {
  const cmd = newCmd(logger);

  // Create a git repo.
  const dir = tmp.dirSync().name;
  logger.info(`Origin dir: ${dir}`);
  cmd('git init -b main', {cwd: dir});
  cmd('git config user.email "test@example.com"', {cwd: dir});
  cmd('git config user.name "test"', {cwd: dir});

  // One commit in the history.
  makeDirTree(dir, ['a.txt:Hello from a file.', 'b.txt:Bees make honey.']);
  cmd('git add -A', {cwd: dir});
  cmd('git commit -m a', {cwd: dir});

  return dir;
}

export function cloneRepo(dir: string, logger = console): string {
  const cmd = newCmd(logger);

  // Create a git repo.
  const clone = tmp.dirSync().name;
  cmd(`git clone ${dir} ${clone}`);
  cmd('git config user.email "test@example.com"', {cwd: clone});
  cmd('git config user.name "test"', {cwd: clone});
  cmd('git config pull.rebase false', {cwd: clone});

  // Check out another branch so we can push back to the main branch of origin.
  cmd('git checkout -b some-other-branch', {cwd: dir});

  return clone;
}

describe('commitPostProcessorUpdate', () => {
  const cmd = newCmd();
  const yamlPath = '.github/.OwlBot.yaml';
  const destRepo = 'test-org/test-repo';
  const gitHubToken = 'test-github-token';
  let sandbox: sinon.SinonSandbox;
  let pr = 0;

  function prepareGitHubEndpoint(options?: {
    draft?: boolean;
    labels?: {name: string}[];
  }) {
    const payload = {
      pull_request: {
        labels: [],
        ...options,
        number: pr,
        head: {
          repo: {
            full_name: destRepo,
          },
          ref: 'abc123',
        },
        base: {
          ref: 'main',
          repo: {
            full_name: destRepo,
          },
        },
      },
    };

    nock.cleanAll();
    nock('https://api.github.com')
      .get(`/repos/${destRepo}/pulls/${pr}`)
      .reply(200, payload.pull_request);
  }

  /**
   * A helper function for passing args to `commitPostProcessorUpdate`.
   * Helps keeps things DRY when the params aren't unique.
   * */
  function prepareArgs(
    repoPath: string
  ): Parameters<typeof commitPostProcessorUpdate>[0] {
    return {
      'dest-repo': destRepo,
      pr,
      'github-token': gitHubToken,
      'repo-path': repoPath,
      'new-pull-request-text-path': '',
    };
  }

  beforeEach(() => {
    sandbox = sinon.createSandbox();

    /** Increments the counter so each test can have its own unique PR */
    pr++;
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  it("adds commit when there's no Copy-Tag", async () => {
    prepareGitHubEndpoint();
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, ['a.txt:The post processor ran.']);
    assert.deepStrictEqual(
      (await commitPostProcessorUpdate(prepareArgs(clone))).shouldPromoteFromDraft,
      undefined);
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.match(log, /Updates from OwlBot/);
  });

  it('promotes pull request from draft', async () => {
    prepareGitHubEndpoint({draft: true, labels: [{name: OWL_BOT_COPY}]});
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, ['a.txt:The post processor ran.']);
    assert.deepStrictEqual(
      (await commitPostProcessorUpdate(prepareArgs(clone))).shouldPromoteFromDraft,
      {
        owner: 'test-org',
        pull_number: pr,
        repo: 'test-repo'
      }
    );
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.match(log, /Updates from OwlBot/);
  });

  it('adds commit when Copy-Tag is corrupt', async () => {
    prepareGitHubEndpoint();
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, ['c.txt:See the sea.']);
    cmd('git add c.txt', {cwd: clone});
    cmd('git commit -m "Copy-Tag: abc123"', {cwd: clone});
    makeDirTree(clone, ['a.txt:The post processor ran.']);
    await commitPostProcessorUpdate(prepareArgs(clone));
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.match(log, /Updates from OwlBot/);
  });

  it('adds commit when .OwlBot.yaml is missing', async () => {
    prepareGitHubEndpoint();
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, ['c.txt:See the sea.']);
    cmd('git add c.txt', {cwd: clone});
    const copyTag = copyTagFrom(yamlPath, 'abc123');
    cmd(`git commit -m "Copy-Tag: ${copyTag}"`, {cwd: clone});
    makeDirTree(clone, ['a.txt:The post processor ran.']);
    await commitPostProcessorUpdate(prepareArgs(clone));
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.match(log, /Updates from OwlBot/);
  });

  it('adds commit when .OwlBot.yaml is corrupt', async () => {
    prepareGitHubEndpoint();
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, [`${yamlPath}:corrupt`]);
    cmd(`git add ${yamlPath}`, {cwd: clone});
    const copyTag = copyTagFrom(yamlPath, 'abc123');
    cmd(`git commit -m "Copy-Tag: ${copyTag}"`, {cwd: clone});
    makeDirTree(clone, ['a.txt:The post processor ran.']);
    await commitPostProcessorUpdate(prepareArgs(clone));
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.match(log, /Updates from OwlBot/);
  });

  function makeRepoWithPendingCommit(): {origin: string; clone: string} {
    prepareGitHubEndpoint();
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, [`${yamlPath}:deep-remove-regex:\n  - /pasta.txt`]);
    cmd(`git add ${yamlPath}`, {cwd: clone});
    const copyTag = copyTagFrom(yamlPath, 'abc123');
    cmd(`git commit -m "Copy-Tag: ${copyTag}"`, {cwd: clone});
    makeDirTree(clone, ['a.txt:The post processor ran.']);
    return {origin, clone};
  }

  it('adds commit when .OwlBot.yaml contains no flag', async () => {
    prepareGitHubEndpoint();
    const {origin, clone} = makeRepoWithPendingCommit();
    await commitPostProcessorUpdate(prepareArgs(clone));
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.match(log, /Updates from OwlBot/);
  });

  it('updates pr title and body', async () => {
    prepareGitHubEndpoint();
    const {origin, clone} = makeRepoWithPendingCommit();
    const args = prepareArgs(clone);
    args['new-pull-request-text-path'] = tmp.fileSync().name;
    fs.writeFileSync(
      args['new-pull-request-text-path'],
      'updated title\n\nUpdated body.'
    );
    // commitPostProcessorUpdate() should issue a PATCH request to update the PR.
    const scope = nock('https://api.github.com')
      .patch(`/repos/${destRepo}/pulls/${pr}`, {
        title: 'updated title',
        body: 'Updated body.',
      })
      .reply(204);
    assert.deepStrictEqual(
      (await commitPostProcessorUpdate(args)).shouldPromoteFromDraft,
      undefined);
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.match(log, /Updates from OwlBot/);
    scope.done();
  });

  it('updates pr title and body and promotes from draft', async () => {
    const {origin, clone} = makeRepoWithPendingCommit();
    prepareGitHubEndpoint({draft: true, labels: [{name: OWL_BOT_COPY}]});
    const args = prepareArgs(clone);
    args['new-pull-request-text-path'] = tmp.fileSync().name;
    fs.writeFileSync(
      args['new-pull-request-text-path'],
      'updated title\n\nUpdated body.'
    );
    // commitPostProcessorUpdate() should issue a PATCH request to update the PR.
    const scope = nock('https://api.github.com')
      .patch(`/repos/${destRepo}/pulls/${pr}`, {
        title: 'updated title',
        body: 'Updated body.',
      })
      .reply(204);
    assert.deepStrictEqual(
      (await commitPostProcessorUpdate(args)).shouldPromoteFromDraft,
      {
        owner: 'test-org',
        pull_number: pr,
        repo: 'test-repo'
      }
    );
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.match(log, /Updates from OwlBot/);
    scope.done();
  });

  it('squashes commit when .OwlBot.yaml contains flag', async () => {
    prepareGitHubEndpoint();
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, [`${yamlPath}:squash: true`]);
    cmd(`git add ${yamlPath}`, {cwd: clone});
    const copyTag = copyTagFrom(yamlPath, 'abc123');
    cmd(`git commit -m "Copy-Tag: ${copyTag}"`, {cwd: clone});
    makeDirTree(clone, ['a.txt:The post processor ran.']);
    assert.deepStrictEqual(
      (await commitPostProcessorUpdate(prepareArgs(clone))).shouldPromoteFromDraft,
      undefined);
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.doesNotMatch(log, /Updates from OwlBot/);
    assert.match(log, /Copy-Tag/);
  });

  it('squashes commit and promotes from draft when .OwlBot.yaml contains flag', async () => {
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, [`${yamlPath}:squash: true`]);
    cmd(`git add ${yamlPath}`, {cwd: clone});
    const copyTag = copyTagFrom(yamlPath, 'abc123');
    cmd(`git commit -m "Copy-Tag: ${copyTag}"`, {cwd: clone});
    makeDirTree(clone, ['a.txt:The post processor ran.']);
    prepareGitHubEndpoint({draft: true, labels: [{name: OWL_BOT_COPY}]});
    assert.deepStrictEqual(
      (await commitPostProcessorUpdate(prepareArgs(clone))).shouldPromoteFromDraft,
      {
        owner: 'test-org',
        pull_number: pr,
        repo: 'test-repo'
      }
    );
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.doesNotMatch(log, /Updates from OwlBot/);
    assert.match(log, /Copy-Tag/);
  });

  it("doesn't create a commit when no changes are pending", async () => {
    prepareGitHubEndpoint();
    const origin = makeOrigin();
    makeDirTree(origin, [`${yamlPath}:squash: true`]);
    cmd(`git add ${yamlPath}`, {cwd: origin});
    const copyTag = copyTagFrom(yamlPath, 'abc123');
    cmd(`git commit -m "Copy-Tag: ${copyTag}"`, {cwd: origin});
    const head = cmd('git log -1 --format=%H main', {cwd: origin}).toString(
      'utf-8'
    );
    const clone = cloneRepo(origin);
    await commitPostProcessorUpdate(prepareArgs(clone));
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.doesNotMatch(log, /Updates from OwlBot/);
    assert.match(log, /Copy-Tag/);
    // No commits should have been pushed.
    assert.strictEqual(
      head,
      cmd('git log -1 --format=%H main', {cwd: origin}).toString('utf-8')
    );
  });

  it("Doesn't create a commit if the 'ignore' label is present", async () => {
    prepareGitHubEndpoint({labels: [{name: OWL_BOT_IGNORE}]});
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, ['a.txt:The post processor ran.']);
    const head = cmd('git log -1 --format=%H main', {cwd: origin}).toString(
      'utf-8'
    );

    await commitPostProcessorUpdate(prepareArgs(clone));
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.doesNotMatch(log, /Updates from OwlBot/);
    // No commits should have been pushed.
    assert.strictEqual(
      head,
      cmd('git log -1 --format=%H main', {cwd: origin}).toString('utf-8')
    );
  });

  it('Creates a commit if labels other than ignore are present', async () => {
    prepareGitHubEndpoint({labels: [{name: OWLBOT_RUN_LABEL}]});
    const origin = makeOrigin();
    const clone = cloneRepo(origin);
    makeDirTree(clone, ['a.txt:The post processor ran.']);

    await commitPostProcessorUpdate(prepareArgs(clone));
    const log = cmd('git log --format=%B main', {cwd: origin}).toString(
      'utf-8'
    );
    assert.match(log, /Updates from OwlBot/);
  });
});
