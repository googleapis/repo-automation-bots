// Copyright 2022 Google LLC
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
import {describe, it, beforeEach} from 'mocha';
import nock from 'nock';
import * as fs from 'fs';
import {resolve} from 'path';
import snapshot from 'snap-shot-it';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {MultiConfigChecker} from '../src/bot-config-utils';
import schema from './test-config-schema.json';
const fetch = require('node-fetch');

nock.disableNetConnect();
const fixturesPath = resolve(__dirname, '../../test/fixtures');

// Emulate getContent and getBlob.
function createConfigResponse(configFile: string) {
  const config = fs.readFileSync(resolve(fixturesPath, configFile));
  const base64Config = config.toString('base64');
  return {
    size: base64Config.length,
    content: base64Config,
    encoding: 'base64',
  };
}

describe('MultiConfigChecker', () => {
  let scope: nock.Scope;
  const testOctokit = new Octokit({auth: 'abc123', request: {fetch}});
  describe('with config changes', () => {
    beforeEach(() => {
      scope = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/1234/files?per_page=50')
        .reply(200, [
          {
            filename: '.github/foo.json',
            sha: 'foosha',
          },
          {
            filename: '.github/bar.yml',
            sha: 'barsha',
          },
        ]);
    });
    it('validates a single JSON config', async () => {
      scope = scope
        .get('/repos/testOwner/testRepo/git/blobs/foosha')
        .reply(200, createConfigResponse('wrong.json'))
        .post('/repos/testOwner/testRepo/check-runs', body => {
          snapshot(body);
          return body;
        })
        .reply(200);
      const checker = new MultiConfigChecker({
        '.github/foo.json': schema,
      });
      const valid = await checker.validateConfigChanges(
        testOctokit,
        'testOwner',
        'testRepo',
        'def234',
        1234
      );
      assert.strictEqual(valid, false);
      scope.done();
    });
    it('validates a single YAML config', async () => {
      scope = scope
        .get('/repos/testOwner/testRepo/git/blobs/barsha')
        .reply(200, createConfigResponse('wrong.yaml'))
        .post('/repos/testOwner/testRepo/check-runs', body => {
          snapshot(body);
          return body;
        })
        .reply(200);
      const checker = new MultiConfigChecker({
        '.github/bar.yml': schema,
      });
      const valid = await checker.validateConfigChanges(
        testOctokit,
        'testOwner',
        'testRepo',
        'def234',
        1234
      );
      assert.strictEqual(valid, false);
      scope.done();
    });
    it('validates multiple configs', async () => {
      scope = scope
        .get('/repos/testOwner/testRepo/git/blobs/foosha')
        .reply(200, createConfigResponse('wrong.json'))
        .get('/repos/testOwner/testRepo/git/blobs/barsha')
        .reply(200, createConfigResponse('wrong.yaml'))
        .post('/repos/testOwner/testRepo/check-runs', body => {
          snapshot(body);
          return body;
        })
        .twice()
        .reply(200);
      const checker = new MultiConfigChecker({
        '.github/foo.json': schema,
        '.github/bar.yml': schema,
      });
      const valid = await checker.validateConfigChanges(
        testOctokit,
        'testOwner',
        'testRepo',
        'def234',
        1234
      );
      assert.strictEqual(valid, false);
      scope.done();
    });
    it('handles valid config files', async () => {
      scope = scope
        .get('/repos/testOwner/testRepo/git/blobs/foosha')
        .reply(200, createConfigResponse('config.json'))
        .get('/repos/testOwner/testRepo/git/blobs/barsha')
        .reply(200, createConfigResponse('config.yaml'));
      const checker = new MultiConfigChecker({
        '.github/bar.yml': schema,
        '.github/foo.json': schema,
      });
      const valid = await checker.validateConfigChanges(
        testOctokit,
        'testOwner',
        'testRepo',
        'def234',
        1234
      );
      assert.strictEqual(valid, true);
      scope.done();
    });
  });
  describe('without config changes', () => {
    beforeEach(() => {
      scope = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/1234/files?per_page=50')
        .reply(200, [
          {
            filename: 'src/foo.ts',
            sha: 'foosha',
          },
          {
            filename: 'src/bar.java',
            sha: 'barsha',
          },
        ]);
    });
    it('ignores non config files', async () => {
      const checker = new MultiConfigChecker({
        '.github/foo.json': schema,
        '.github/bar.yml': schema,
      });
      const valid = await checker.validateConfigChanges(
        testOctokit,
        'testOwner',
        'testRepo',
        'def234',
        1234
      );
      assert.strictEqual(valid, true);
      scope.done();
    });
  });
});
