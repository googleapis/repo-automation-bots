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

import {describe, it, afterEach} from 'mocha';
import assert from 'assert';
import sinon from 'sinon';
import nock from 'nock';
import mockedEnv from 'mocked-env';
import {RestoreFn} from 'mocked-env';
import fs from 'fs';

import * as cli from '../src/cli';

const sandbox = sinon.createSandbox();

nock.disableNetConnect();

describe('cli', () => {
  let restore: RestoreFn;

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
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
      await cli.parser().exitProcess(false).parse('dump');
      assert.fail('should not get here');
    } catch (e) {
      assert.ok(e.toString().match('Missing required argument: github-token'));
    }
  });
  it('should save a file if token is provided', async () => {
    const writeFileSyncStub = sandbox.stub(fs, 'writeFileSync');
    restore = mockedEnv({
      GITHUB_TOKEN: 'mygithubtoken',
    });
    const scope = nock('https://api.github.com')
      .get('/orgs/googleapis/repos')
      .reply(200, [{name: 'repo1'}])
      .get('/orgs/GoogleCloudPlatform/repos')
      .reply(200, [{name: 'repo2'}]);
    await cli.parser().exitProcess(false).parse('dump -f test.json');
    sinon.assert.calledOnceWithExactly(
      writeFileSyncStub,
      'test.json',
      '[{"name":"repo1"},{"name":"repo2"}]'
    );
    scope.done();
  });
  it('should exit normally with the result', async () => {
    let log = '';
    sandbox.replace(
      console,
      'log',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
      (message?: any, ...optionalParams: any[]): void => {
        log += message;
      }
    );
    const args = {
      yamlFiles: ['recipes/nodejs.yaml'],
      file: 'test/fixtures/repos.json',
    };
    await cli.testYamlCommand(args);
    log.includes('Using selector yaml files: recipes/nodejs.yaml');
    log.includes('Using dump file: test/fixtures/repos.json');
    log.includes('The following repos are hit!');
  });
});
