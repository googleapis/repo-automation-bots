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

import nock from 'nock';
import {describe, it, afterEach} from 'mocha';
import assert from 'assert';
import sinon from 'sinon';
import mockedEnv from 'mocked-env';
import {RestoreFn} from 'mocked-env';
import * as cli from '../src/cli';
import * as yaml from 'js-yaml';
import {SyncRepoSettings} from '../src/sync-repo-settings';
import {readFileSync} from 'fs';
import {resolve} from 'path';

const sandbox = sinon.createSandbox();

nock.disableNetConnect();

describe('cli', () => {
  let restore: RestoreFn;

  afterEach(() => {
    sandbox.restore();
    if (restore) {
      restore();
    }
  });

  it('should throw if no token is available', async () => {
    restore = mockedEnv({
      GITHUB_TOKEN: undefined,
      GH_TOKEN: undefined,
    });
    try {
      await cli.parser.exitProcess(false).parse('--repo=testOwner/testRepo');
      assert.fail('should not get here');
    } catch (e) {
      assert.ok(e.toString().match('Missing required argument: github-token'));
    }
  });

  it('loads github-token from environment', async () => {
    restore = mockedEnv({
      GITHUB_TOKEN: 'some-token',
    });
    const config = readFileSync(resolve('./test/fixtures', 'localConfig.yaml'));
    nock('https://api.github.com')
      .get(
        '/repos/testOwner/testRepo/contents/.github%2Fsync-repo-settings.yaml'
      )
      .reply(200, {
        sha: 'abc123',
        content: config.toString('base64'),
      });
    const stub = sandbox
      .stub(SyncRepoSettings.prototype, 'syncRepoSettings')
      .resolves();
    await cli.parser.exitProcess(false).parse('--repo=testOwner/testRepo');
    assert.ok(
      stub.calledWith(
        sinon.match(options => {
          assert.strictEqual(options.repo, 'testOwner/testRepo');
          assert.deepStrictEqual(
            options.config,
            yaml.load(config.toString('utf-8'))
          );
          return true;
        })
      )
    );
  });

  it('should run remote configuration', async () => {
    const config = readFileSync(resolve('./test/fixtures', 'localConfig.yaml'));
    nock('https://api.github.com')
      .get(
        '/repos/testOwner/testRepo/contents/.github%2Fsync-repo-settings.yaml'
      )
      .reply(200, {
        sha: 'abc123',
        content: config.toString('base64'),
      });
    const stub = sandbox
      .stub(SyncRepoSettings.prototype, 'syncRepoSettings')
      .resolves();
    await cli.parser
      .exitProcess(false)
      .parse('--repo=testOwner/testRepo --github-token=some-token');
    assert.ok(
      stub.calledWith(
        sinon.match(options => {
          assert.strictEqual(options.repo, 'testOwner/testRepo');
          assert.deepStrictEqual(
            options.config,
            yaml.load(config.toString('utf-8'))
          );
          return true;
        })
      )
    );
  });

  it('should run local configuration', async () => {
    const config = readFileSync(resolve('./test/fixtures', 'localConfig.yaml'));
    const stub = sandbox
      .stub(SyncRepoSettings.prototype, 'syncRepoSettings')
      .resolves();
    await cli.parser
      .exitProcess(false)
      .parse(
        '--repo=testOwner/testRepo --github-token=some-token --file=./test/fixtures/localConfig.yaml'
      );
    assert.ok(
      stub.calledWith(
        sinon.match(options => {
          assert.strictEqual(options.repo, 'testOwner/testRepo');
          assert.deepStrictEqual(
            options.config,
            yaml.load(config.toString('utf-8'))
          );
          return true;
        })
      )
    );
  });
});
