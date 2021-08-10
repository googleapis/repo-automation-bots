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

import {CloudBuildClient} from '@google-cloud/cloudbuild';
import * as assert from 'assert';
import sinon from 'sinon';
import {sourceLinkFrom, sourceLinkLineFrom} from '../src/copy-code';
import {core, RegenerateArgs} from '../src/core';
import {newFakeCloudBuildClient} from './fake-cloud-build-client';
import {
  FakeIssues,
  newFakeOctokit,
  newFakeOctokitFactory,
} from './fake-octokit';

const sandbox = sinon.createSandbox();

describe('triggerPostProcessBuild()', () => {
  afterEach(() => {
    sandbox.restore();
  });

  const args: RegenerateArgs = {
    branch: 'test-branch',
    gcpProjectId: 'test-project',
    buildTriggerId: '42',
    owner: 'test-owner',
    prBody:
      'Nice pull request.\n' + sourceLinkLineFrom(sourceLinkFrom('abc123')),
    prNumber: 5,
    repo: 'nodejs-stapler',
  };

  it('creates a comment on the pull request when the pull request body is missing a source commit hash', async () => {
    const issues = new FakeIssues();
    const octokit = newFakeOctokit(undefined, issues);
    await core.triggerRegeneratePullRequest(newFakeOctokitFactory(octokit), {
      ...args,
      prBody: 'Nice pull request',
    });
    assert.strictEqual(issues.comments.length, 1);
    const comment = issues.comments[0];
    assert.strictEqual(comment.owner, 'test-owner');
    assert.strictEqual(comment.repo, 'nodejs-stapler');
    assert.strictEqual(comment.issue_number, 5);
    assert.match(comment.body, /.*missing.*hash.*/);
  });

  it('triggers a cloud build', async () => {
    const issues = new FakeIssues();
    const octokit = newFakeOctokit(undefined, issues);
    const fakeCloudBuild = newFakeCloudBuildClient();
    sandbox.replace(core, 'getCloudBuildInstance', (): CloudBuildClient => {
      return fakeCloudBuild;
    });
    await core.triggerRegeneratePullRequest(
      newFakeOctokitFactory(octokit),
      args
    );
    assert.strictEqual(issues.comments.length, 1);
    const comment = issues.comments[0];
  });
});
