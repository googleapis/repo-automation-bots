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

import assert from 'assert';
import {describe, it} from 'mocha';
import {createIssueIfTitleDoesntExist} from '../src/octokit-util';
import {FakeIssues, newFakeOctokit} from './fake-octokit';

describe('octokit-utils', () => {
  describe('createIssueIfTitleDoesntExist', () => {
    it('should create an issue', async function () {
      const issues = new FakeIssues();
      const octokit = newFakeOctokit(undefined, issues);

      const created = await createIssueIfTitleDoesntExist(
        octokit,
        `owner-${this.test?.title}`,
        `repo-${this.test?.title}`,
        `title-${this.test?.title}`,
        `body-${this.test?.title}`
      );

      assert.strictEqual(created, true);
      assert.strictEqual(issues.issues.length, 1);
      assert.strictEqual(issues.issues[0].title, `title-${this.test?.title}`);
    });

    it('should not create an issue if an issue with a matching title exists', async function () {
      const issues = new FakeIssues();
      const {data: sampleIssue} = await issues.create({
        owner: `owner-${this.test?.title}`,
        repo: `repo-${this.test?.title}`,
        title: `title-${this.test?.title}`,
        body: `body-${this.test?.title}`,
      });

      const octokit = newFakeOctokit(undefined, issues);

      const created = await createIssueIfTitleDoesntExist(
        octokit,
        sampleIssue.owner,
        sampleIssue.repo,
        sampleIssue.title,
        sampleIssue.body
      );

      assert.strictEqual(created, false);
      assert.strictEqual(issues.issues.length, 1);
    });
  });
});
