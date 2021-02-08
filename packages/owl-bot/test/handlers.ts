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
import * as assert from 'assert';
import {describe, it, afterEach} from 'mocha';

import {createOnePullRequestForUpdatingLock} from '../src/handlers';
import {ConfigsStore} from '../src/database';
import {dump} from 'js-yaml';
import * as suggester from 'code-suggester';
import {Octokit} from '@octokit/rest';

import * as sinon from 'sinon';
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
      const fakeConfigStore = ({
        findPullRequestForUpdatingLock: () => undefined,
        recordPullRequestForUpdatingLock: (
          _repo: string,
          _lock: object,
          uri: string
        ) => {
          recordedURI = uri;
        },
      } as unknown) as ConfigsStore;
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
        lock,
        new Date()
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
      const fakeConfigStore = ({
        findPullRequestForUpdatingLock: () =>
          'https://github.com/owl/test/pull/99',
      } as unknown) as ConfigsStore;
      const expectedURI = await createOnePullRequestForUpdatingLock(
        fakeConfigStore,
        new Octokit(), // Not actually used.
        'owl/test',
        lock,
        new Date()
      );
      assert.strictEqual(expectedURI, 'https://github.com/owl/test/pull/99');
    });
  });
});
