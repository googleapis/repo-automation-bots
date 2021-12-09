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

function getPRsOnRepo(
  owner: string,
  repo: string,
  response: {id: number; user: {login: string}}[]
) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/pulls?state=open`)
    .reply(200, response);
}

function getFileOnARepo(
  owner: string,
  repo: string,
  path: string,
  response: {name: string; content: string}
) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/contents/${path}`)
    .reply(200, response);
}

function listCommitsOnAPR(
  owner: string,
  repo: string,
  response: {author: {login: string}}[]
) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/pulls/1/commits`)
    .reply(200, response);
}

function getFilesOnAPR(
  owner: string,
  repo: string,
  response: {filename: string; sha: string}[]
) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/pulls/1/files`)
    .reply(200, response);
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

      const scopes = [
        getFilesOnAPR('GoogleCloudPlatform', 'python-docs-samples', [
          {filename: 'requirements.txt', sha: '1234'},
        ]),
        listCommitsOnAPR('GoogleCloudPlatform', 'python-docs-samples', [
          {author: {login: 'gcf-owl-bot[bot]'}},
        ]),
        getFileOnARepo(
          'GoogleCloudPlatform',
          'python-docs-samples',
          '.repo-metadata.json',
          {
            name: '.repo-metadata.json',
            content:
              'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
          }
        ),
        getFileOnARepo(
          'GoogleCloudPlatform',
          'python-docs-samples',
          '.repo-metadata.json',
          {
            name: '.repo-metadata.json',
            content:
              'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
          }
        ),
        getPRsOnRepo('GoogleCloudPlatform', 'python-docs-samples', [
          {id: 2, user: {login: 'gcf-owl-bot[bot]'}},
        ]),
      ];

      const pr = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_fork'
      ));

      await checkPR.checkPRAgainstConfig(validPR, pr, octokit);

      scopes.forEach(scope => scope.done());
    });

    it('should return false if incoming PR does not match any of the processes', async () => {
      const pr = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened'
      ));

      const scopes = [
        getFilesOnAPR('testOwner', 'testRepo', [
          {filename: 'requirements.txt', sha: '1234'},
        ]),
        listCommitsOnAPR('testOwner', 'testRepo', [
          {author: {login: 'gcf-owl-bot[bot]'}},
        ]),
        getFileOnARepo('testOwner', 'testRepo', '.repo-metadata.json', {
          name: '.repo-metadata.json',
          content:
            'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
        }),
        getFileOnARepo('testOwner', 'testRepo', '.repo-metadata.json', {
          name: '.repo-metadata.json',
          content:
            'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
        }),
        getPRsOnRepo('testOwner', 'testRepo', [
          {id: 2, user: {login: 'gcf-owl-bot[bot]'}},
        ]),
      ];

      const prMatchesConfig = await checkPR.checkPRAgainstConfig(
        validPR,
        pr,
        octokit
      );
      assert.strictEqual(prMatchesConfig, false);
      scopes.forEach(scope => scope.done());
    });

    it('should return false if incoming PR does not have a title that matches any of the processes', async () => {
      const pr = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_right_author_wrong_title'
      ));

      const scopes = [
        getFilesOnAPR('testOwner', 'testRepo', [
          {filename: 'requirements.txt', sha: '1234'},
        ]),
        listCommitsOnAPR('testOwner', 'testRepo', [
          {author: {login: 'gcf-owl-bot[bot]'}},
        ]),
        getFileOnARepo('testOwner', 'testRepo', '.repo-metadata.json', {
          name: '.repo-metadata.json',
          content:
            'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
        }),
        getFileOnARepo('testOwner', 'testRepo', '.repo-metadata.json', {
          name: '.repo-metadata.json',
          content:
            'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
        }),
        getPRsOnRepo('testOwner', 'testRepo', [
          {id: 2, user: {login: 'gcf-owl-bot[bot]'}},
        ]),
      ];
      const prMatchesConfig = await checkPR.checkPRAgainstConfig(
        validPR,
        pr,
        octokit
      );
      assert.strictEqual(prMatchesConfig, false);
      scopes.forEach(scope => scope.done());
    });

    it('should return false if incoming PR does not have the correct filenames for any of the processes', async () => {
      const pr = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_right_author_and_title'
      ));

      const scopes = [
        getFilesOnAPR('testOwner', 'testRepo', [
          {filename: 'changedFile1', sha: '1234'},
          {filename: 'changedFile2', sha: '1234'},
        ]),
        listCommitsOnAPR('testOwner', 'testRepo', [
          {author: {login: 'gcf-owl-bot[bot]'}},
        ]),
        getFileOnARepo('testOwner', 'testRepo', '.repo-metadata.json', {
          name: '.repo-metadata.json',
          content:
            'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
        }),
        getFileOnARepo('testOwner', 'testRepo', '.repo-metadata.json', {
          name: '.repo-metadata.json',
          content:
            'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
        }),
        getPRsOnRepo('testOwner', 'testRepo', [
          {id: 2, user: {login: 'gcf-owl-bot[bot]'}},
        ]),
      ];

      const prMatchesConfig = await checkPR.checkPRAgainstConfig(
        validPR,
        pr,
        octokit
      );

      assert.strictEqual(prMatchesConfig, false);
      scopes.forEach(scope => scope.done());
    });

    it('should return false if incoming PR does not have the correct number of files changed for any of the processes', async () => {
      const pr = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_right_author_and_title'
      ));

      const scopes = [
        getFilesOnAPR('testOwner', 'testRepo', [
          {filename: 'README.md', sha: '1234'},
          {
            filename: '.github/readme/synth.metadata/synth.metadata',
            sha: '1234',
          },
          {filename: 'README.md', sha: '1234'},
        ]),
        listCommitsOnAPR('testOwner', 'testRepo', [
          {author: {login: 'gcf-owl-bot[bot]'}},
        ]),
        getFileOnARepo('testOwner', 'testRepo', '.repo-metadata.json', {
          name: '.repo-metadata.json',
          content:
            'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
        }),
        getFileOnARepo('testOwner', 'testRepo', '.repo-metadata.json', {
          name: '.repo-metadata.json',
          content:
            'ewogICAgIm5hbWUiOiAiZGxwIiwKICAgICJuYW1lX3ByZXR0eSI6ICJDbG91ZCBEYXRhIExvc3MgUHJldmVudGlvbiIsCiAgICAicHJvZHVjdF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9kbHAvZG9jcy8iLAogICAgImNsaWVudF9kb2N1bWVudGF0aW9uIjogImh0dHBzOi8vY2xvdWQuZ29vZ2xlLmNvbS9weXRob24vZG9jcy9yZWZlcmVuY2UvZGxwL2xhdGVzdCIsCiAgICAiaXNzdWVfdHJhY2tlciI6ICIiLAogICAgInJlbGVhc2VfbGV2ZWwiOiAiZ2EiLAogICAgImxhbmd1YWdlIjogInB5dGhvbiIsCiAgICAibGlicmFyeV90eXBlIjogIkdBUElDX0FVVE8iLAogICAgInJlcG8iOiAiZ29vZ2xlYXBpcy9weXRob24tZGxwIiwKICAgICJkaXN0cmlidXRpb25fbmFtZSI6ICJnb29nbGUtY2xvdWQtZGxwIiwKICAgICJhcGlfaWQiOiAiZGxwLmdvb2dsZWFwaXMuY29tIiwKICAgICJyZXF1aXJlc19iaWxsaW5nIjogdHJ1ZSwKICAgICJkZWZhdWx0X3ZlcnNpb24iOiAidjIiLAogICAgImNvZGVvd25lcl90ZWFtIjogIiIKfQ==',
        }),
        getPRsOnRepo('testOwner', 'testRepo', [
          {id: 2, user: {login: 'gcf-owl-bot[bot]'}},
        ]),
      ];

      const prMatchesConfig = await checkPR.checkPRAgainstConfig(
        validPR,
        pr,
        octokit
      );

      scopes.forEach(scope => scope.done());
      assert.strictEqual(prMatchesConfig, false);
    });

    it('should return true if the incoming PR matches one of the processes', async () => {
      const pr = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened_right_author_and_title_file_count'
      ));

      // Since this case is succeeding, it won't get to call all of the scopes for the rest
      // of the cases
      const scopes = [
        getFilesOnAPR('testOwner', 'testRepo', [
          {filename: 'README.md', sha: '1234'},
          {
            filename: '.github/readme/synth.metadata/synth.metadata',
            sha: '1234',
          },
        ]),
      ];

      const prMatchesConfig = await checkPR.checkPRAgainstConfig(
        validPR,
        pr,
        octokit
      );

      scopes.forEach(scope => scope.done());
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

      const scopes = [
        getFilesOnAPR('testOwner', 'testRepo', [
          {filename: 'README.md', sha: '1234'},
          {
            filename: '.github/readme/synth.metadata/synth.metadata',
            sha: '1234',
          },
        ]),
      ];
      const prMatchesConfig = await checkPR.checkPRAgainstConfig(
        validPR,
        pr,
        octokit
      );
      scopes.forEach(scope => scope.done());
      assert.ok(prMatchesConfig);
    });
  });
});
