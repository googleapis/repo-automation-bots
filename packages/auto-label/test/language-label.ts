// Copyright 2020 Google LLC
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

/* eslint-disable @typescript-eslint/no-var-requires */

// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
import {describe, it, beforeEach, afterEach} from 'mocha';
import nock from 'nock';
import * as assert from 'assert';
import {resolve} from 'path';
import fs from 'fs';
import * as sinon from 'sinon';
import {handler} from '../src/auto-label';
nock.disableNetConnect();
const sandbox = sinon.createSandbox();

const langlabeler = require('../src/language');

// We provide our own GitHub instance, similar to
// the one used by gcf-utils, this allows us to turn off
// methods like retry, and to use @octokit/rest
// as the base class:
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import {config} from '@probot/octokit-plugin-config';
const TestingOctokit = Octokit.plugin(config);
const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('language-label', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Octokit: TestingOctokit as any,
    });
    probot.load(handler);
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('responds to pull request events', () => {
    it('does not label if configs are turned off', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'invalid-config.yml')
      );
      const payload = require(resolve(fixturesPath, './events/pr_opened'));
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-label.yaml')
        .reply(200, config);
      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      ghRequests.done();
    });

    it('labels PR with a language label', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'valid-config.yml')
      );
      const pr_opened_payload = require(resolve(
        fixturesPath,
        './events/pr_opened.json'
      ));
      const pr_files_payload = require(resolve(
        fixturesPath,
        './events/pr_opened_files.json'
      ));
      const expected_labels = {
        labels: ['language:JSON'],
      };
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-label.yaml')
        .reply(200, config)

        //  Mock pulls.listfiles
        .get('/repos/testOwner/testRepo/pulls/12/files')
        .reply(200, pr_files_payload)

        // Mock issues.addlabels
        .post('/repos/testOwner/testRepo/issues/12/labels', body => {
          assert.notStrictEqual(body, expected_labels);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload: pr_opened_payload,
        id: 'abc123',
      });

      ghRequests.done();
    });

    it('does not label when no language found', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'simple-config.yml')
      );
      const pr_opened_payload = require(resolve(
        fixturesPath,
        './events/pr_opened.json'
      ));
      const pr_files_payload = require(resolve(
        fixturesPath,
        './events/pr_opened_files_no_lang_match.json'
      ));
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-label.yaml')
        .reply(200, config)

        //  Mock pulls.listfiles
        .get('/repos/testOwner/testRepo/pulls/12/files')
        .reply(200, pr_files_payload);

      await probot.receive({
        name: 'pull_request',
        payload: pr_opened_payload,
        id: 'abc123',
      });

      ghRequests.done();
    });

    it('does not label when label already exists', async () => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'config', 'simple-config.yml')
      );
      // PR already contains a "javascript" label
      const pr_opened_payload = require(resolve(
        fixturesPath,
        './events/pr_opened_labeled.json'
      ));
      const pr_files_payload = require(resolve(
        fixturesPath,
        './events/pr_opened_files.json'
      ));
      const ghRequests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fauto-label.yaml')
        .reply(200, config)

        //  Mock pulls.listfiles
        .get('/repos/testOwner/testRepo/pulls/12/files')
        .reply(200, pr_files_payload);

      await probot.receive({
        name: 'pull_request',
        payload: pr_opened_payload,
        id: 'abc123',
      });

      ghRequests.done();
    });
  });

  describe('labels languages correctly', () => {
    it('labels the language with most changes in PR', async () => {
      const config = {
        language: {
          pullrequest: true,
        },
      };
      const data = [
        {
          filename: 'README.md',
          changes: 8,
        },
        {
          filename: 'src/index.ts',
          changes: 15,
        },
      ];
      assert.strictEqual(langlabeler.getPRLanguage(data, config), 'javascript');
    });

    it('labels with user defined language mapping', async () => {
      const lang_config = {
        pullrequest: true,
        labelprefix: 'lang: ',
        extensions: {
          typescript: ['ts'],
        },
      };
      const data = [
        {
          filename: 'src/index.ts',
          changes: 15,
        },
      ];
      assert.strictEqual(
        langlabeler.getPRLanguage(data, lang_config),
        'lang: typescript'
      );
    });

    it('labels with user defined paths', async () => {
      const lang_config = {
        pullrequest: true,
        labelprefix: 'lang: ',
        paths: {
          src: 'c++',
        },
      };
      const data = [
        {
          filename: 'src/index.ts',
          changes: 15,
        },
      ];
      assert.strictEqual(
        langlabeler.getPRLanguage(data, lang_config),
        'lang: c++'
      );
    });

    it('labels with user defined path even if upstream', async () => {
      const lang_config = {
        pullrequest: true,
        labelprefix: 'lang: ',
        paths: {
          '.': 'foo',
        },
      };
      const data = [
        {
          filename: 'src/index.ts',
          changes: 15,
        },
      ];
      assert.strictEqual(
        langlabeler.getPRLanguage(data, lang_config),
        'lang: foo'
      );
    });

    it('labels with user defined path on the deepest path', async () => {
      const lang_config = {
        pullrequest: true,
        labelprefix: 'lang: ',
        paths: {
          '.': 'foo',
          src: 'bar',
        },
      };
      const data = [
        {
          filename: 'src/index.ts',
          changes: 15,
        },
      ];
      assert.strictEqual(
        langlabeler.getPRLanguage(data, lang_config),
        'lang: bar'
      );
    });

    it('lets users customize label prefix', async () => {
      const lang_config = {
        pullrequest: true,
        labelprefix: 'hello: ',
      };
      const data = [
        {
          filename: 'src/index.ts',
          changes: 15,
        },
      ];
      assert.strictEqual(
        langlabeler.getPRLanguage(data, lang_config),
        'hello: javascript'
      );
    });
  });
});
