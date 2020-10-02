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
import snapshot from 'snap-shot-it';
import * as sinon from 'sinon';
import {handler} from '../src/auto-label';
import {logger} from 'gcf-utils';
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
  let errorStub: sinon.SinonStub;
  let repoStub: sinon.SinonStub;

  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Octokit: TestingOctokit as any,
    });
    probot.load(handler);

    // throw and fail the test if we're writing
    errorStub = sandbox.stub(logger, 'error').throwsArg(0);
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
        .get('/repos/testOwner/testRepo/contents/.github%2Fconfig.yml')
        .reply(200, config);
      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123'
      });
      ghRequests.done();
    });

    // TODO: it labels PRs with a language label



    // TODO: it doesn't label if language not found
    it('does not re-label a PR', async () => {
      // const config = fs.readFileSync(
      //     resolve(fixturesPath, 'config', 'valid-config.yml')
      // );
      // const payload = require(resolve(
      //     fixturesPath,
      //     './events/issue_opened_spanner'
      // ));
      // payload['issue']['title'] = 'spanner: this is actually about App Engine';
      //
      // const ghRequests = nock('https://api.github.com')
      //     .get(
      //         '/repos/GoogleCloudPlatform/golang-samples/contents/.github%2Fconfig.yml'
      //     )
      //     .reply(200, config)
      //     .get('/repos/GoogleCloudPlatform/golang-samples/issues/5/labels')
      //     .reply(200, [
      //       {
      //         name: 'api: spanner',
      //       },
      //     ])
      //     .post('/repos/GoogleCloudPlatform/golang-samples/labels')
      //     .reply(200, [
      //       {
      //         name: 'api: spanner',
      //       },
      //     ])
      //     .post('/repos/GoogleCloudPlatform/golang-samples/labels')
      //     .reply(200, [
      //       {
      //         name: 'sample',
      //       },
      //     ])
      //     .post('/repos/GoogleCloudPlatform/golang-samples/issues/5/labels')
      //     .reply(200, [
      //       {
      //         name: 'sample',
      //       },
      //     ]);
      //
      // await probot.receive({
      //   name: 'issues',
      //   payload,
      //   id: 'abc123',
      // });
      // ghRequests.done();
    });
  });

  describe('labels languages correctly', () => {
    it('labels the language with most changes in PR', async () => {
      const config = {
        language: {
          pullrequest: true
        }
      };
      const data = [
        {
          filename: "README.md",
          changes: 8,
        },
        {
          filename: "src/index.ts",
          changes: 15,
        }
      ];
      assert.strictEqual(langlabeler.getPRLanguage(data, config), "lang: javascript");
    });

    it('labels with user defined language mapping', async () => {
      const lang_config = {
        pullrequest: true,
        extensions: {
          typescript: ['ts']
        }
      };
      const data = [
        {
          filename: "src/index.ts",
          changes: 15,
        }
      ];
      assert.strictEqual(langlabeler.getPRLanguage(data, lang_config), "lang: typescript");
    });

    it('labels with user defined paths', async () => {
      const lang_config = {
        pullrequest: true,
        paths: {
          src: 'c++'
        }
      };
      const data = [
        {
          filename: "src/index.ts",
          changes: 15,
        }
      ];
      assert.strictEqual(langlabeler.getPRLanguage(data, lang_config), "lang: c++");
    });

    it('labels with user defined path even if upstream', async () => {
      const lang_config = {
        pullrequest: true,
        paths: {
          '.': 'foo'
        }
      };
      const data = [
        {
          filename: "src/index.ts",
          changes: 15,
        }
      ];
      assert.strictEqual(langlabeler.getPRLanguage(data, lang_config), "lang: foo");
    });


    it('labels with user defined path on the deepest path', async () => {
      const lang_config = {
        pullrequest: true,
        paths: {
          '.': 'foo',
          src: 'bar'
        }
      };
      const data = [
        {
          filename: "src/index.ts",
          changes: 15,
        }
      ];
      assert.strictEqual(langlabeler.getPRLanguage(data, lang_config), "lang: bar");
    });

    it('lets users customize label prefix', async () => {
      const lang_config = {
        pullrequest: true,
        labelprefix: 'hello: '
      };
      const data = [
        {
          filename: "src/index.ts",
          changes: 15,
        }
      ];
      assert.strictEqual(langlabeler.getPRLanguage(data, lang_config), "hello: javascript");
    });
  });
});
