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
import {describe, it, beforeEach} from 'mocha';
import * as assert from 'assert';
import snapshot from 'snap-shot-it';
import { Runner } from '../src/release-brancher';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

function loadFixture(path: string): string {
  return fs.readFileSync(resolve(fixturesPath, path)).toString('utf-8');
}

describe('Runner', () => {
  let runner: Runner;
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
    describe('with releaseType', () => {
      beforeEach(() => {
        runner = new Runner({
          branchName: '1.x',
          targetTag: 'v1.3.0',
          gitHubToken: 'sometoken',
          upstreamOwner: 'testOwner',
          upstreamRepo: 'testRepo',
          releaseType: 'custom-releaser',
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

    it('ignores branch if repo has no branch protection enabled', () => {
      const config = loadFixture('sync-repo-settings/no-branches.yaml');
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
  });
});
