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

import {describe, it} from 'mocha';
import assert from 'assert';
import * as fs from 'fs';
import * as checkPR from '../src/check-pr-v2';
import nock from 'nock';
import {resolve} from 'path';
import yaml from 'js-yaml';
import sinon from 'sinon';
import {ConfigurationV2, File} from '../src/interfaces';

const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
});
const fixturesPath = resolve(__dirname, '../../test/fixtures');

function listChangedFilesPR(status: number, response: File[]) {
  return nock('https://api.github.com')
    .get('/repos/testOwner/testRepo/pulls/1/files')
    .reply(status, response);
}

describe('check pr against config', async () => {
  beforeEach(() => {
    sinon.stub(Date, 'now').returns(1623280558000);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('main pr functioning', async () => {
    const validPR = yaml.load(
      fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-schemasV2', 'valid-schema1.yml'),
        'utf8'
      )
    ) as ConfigurationV2;

    it('should get the base repo info to do its checking, not the head repo', async () => {
      const validPR = yaml.load(
        fs.readFileSync(
          resolve(
            fixturesPath,
            'config',
            'valid-schemasV2',
            'valid-schema1.yml'
          ),
          'utf8'
        )
      ) as ConfigurationV2;

      const fileRequest = nock('https://api.github.com')
        .get('/repos/GoogleCloudPlatform/python-docs-samples/pulls/1/files')
        .reply(200, [{filename: 'requirements.txt', sha: '1234'}]);

      const pr = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_fork'
      ));

      await checkPR.checkPRAgainstConfig(validPR, pr, octokit);

      fileRequest.done();
    });

    it('should return false if incoming PR does not have an author that matches any of the processes', async () => {
      const pr = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened'
      ));

      const fileRequest = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/1/files')
        .reply(200);

      const prMatchesConfig = await checkPR.checkPRAgainstConfig(
        validPR,
        pr,
        octokit
      );
      assert.strictEqual(prMatchesConfig, false);
      fileRequest.done();
    });

    it('should return false if incoming PR does not have a title that matches any of the processes', async () => {
      const pr = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_right_author_wrong_title'
      ));

      const fileRequest = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/1/files')
        .reply(200);

      const prMatchesConfig = await checkPR.checkPRAgainstConfig(
        validPR,
        pr,
        octokit
      );
      assert.strictEqual(prMatchesConfig, false);
      fileRequest.done();
    });

    it('should return false if incoming PR does not have the correct filenames for any of the processes', async () => {
      const pr = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_right_author_and_title'
      ));

      const scopes = listChangedFilesPR(200, [
        {filename: 'changedFile1', sha: '1234'},
        {filename: 'changedFile2', sha: '1234'},
      ]);

      const prMatchesConfig = await checkPR.checkPRAgainstConfig(
        validPR,
        pr,
        octokit
      );

      scopes.done();
      assert.strictEqual(prMatchesConfig, false);
    });

    it('should return false if incoming PR does not have the correct number of files changed for any of the processes', async () => {
      const pr = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_right_author_and_title'
      ));

      const scopes = listChangedFilesPR(200, [
        {filename: 'README.md', sha: '1234'},
        {filename: '.github/readme/synth.metadata/synth.metadata', sha: '1234'},
        {filename: 'README.md', sha: '1234'},
      ]);

      const prMatchesConfig = await checkPR.checkPRAgainstConfig(
        validPR,
        pr,
        octokit
      );

      scopes.done();
      assert.strictEqual(prMatchesConfig, false);
    });

    it('should return true if the incoming PR matches one of the processes', async () => {
      const pr = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_right_author_and_title_file_count'
      ));

      const scopes = listChangedFilesPR(200, [
        {filename: 'README.md', sha: '1234'},
        {filename: '.github/readme/synth.metadata/synth.metadata', sha: '1234'},
      ]);

      const prMatchesConfig = await checkPR.checkPRAgainstConfig(
        validPR,
        pr,
        octokit
      );

      scopes.done();
      assert.ok(prMatchesConfig);
    });

    it('should return true if all elements of PR match, and some are left blank in the config', async () => {
      const validPR = yaml.load(
        fs.readFileSync(
          resolve(
            fixturesPath,
            'config',
            'valid-schemasV2',
            'valid-schema3.yml'
          ),
          'utf8'
        )
      ) as ConfigurationV2;

      const pr = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_right_author_and_title_partial_schema'
      ));

      const scopes = listChangedFilesPR(200, [
        {filename: 'README.md', sha: '1234'},
        {filename: '.github/readme/synth.metadata/synth.metadata', sha: '1234'},
      ]);

      const prMatchesConfig = await checkPR.checkPRAgainstConfig(
        validPR,
        pr,
        octokit
      );
      scopes.done();
      assert.ok(prMatchesConfig);
    });
  });
});
