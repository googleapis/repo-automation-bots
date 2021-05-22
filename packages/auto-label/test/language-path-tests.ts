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
import * as sinon from 'sinon';
import {handler} from '../src/auto-label';
import {createProbotAuth} from 'octokit-auth-probot';
import {loadConfig} from './test-helper';
import * as botConfigModule from '@google-automations/bot-config-utils';
import {ConfigChecker} from '@google-automations/bot-config-utils';

nock.disableNetConnect();
const sandbox = sinon.createSandbox();

const helper = require('../src/helper');

// We provide our own GitHub instance, similar to
// the one used by gcf-utils, this allows us to turn off
// methods like retry, and to use @octokit/rest
// as the base class:
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import {config} from '@probot/octokit-plugin-config';
const TestingOctokit = Octokit.plugin(config).defaults({
  authStrategy: createProbotAuth,
});
const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('language-and-path-labeling', () => {
  let probot: Probot;
  let getConfigWithDefaultStub: sinon.SinonStub;
  let validateConfigStub: sinon.SinonStub;

  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Octokit: TestingOctokit as any,
    });
    probot.load(handler);
    getConfigWithDefaultStub = sandbox.stub(
      botConfigModule,
      'getConfigWithDefault'
    );
    validateConfigStub = sandbox.stub(
      ConfigChecker.prototype,
      'validateConfigChanges'
    );
    // We test the config schema compatibility in config-compatibility.ts
    validateConfigStub.resolves();
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('responds to pull request events', () => {
    it('does not label if configs are turned off', async () => {
      const config = loadConfig('invalid-config.yml');
      getConfigWithDefaultStub.resolves(config);
      const payload = require(resolve(fixturesPath, './events/pr_opened'));
      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
    });

    it('labels PR with respective labels', async () => {
      const config = loadConfig('valid-config-no-product.yml');
      getConfigWithDefaultStub.resolves(config);
      const pr_opened_payload = require(resolve(
        fixturesPath,
        './events/pr_opened.json'
      ));
      const pr_files_payload = require(resolve(
        fixturesPath,
        './events/pr_opened_files.json'
      ));
      const expected_labels = {
        labels: ['some_label'],
      };
      const ghRequests = nock('https://api.github.com')
        //  Mock pulls.listfiles
        .get('/repos/testOwner/testRepo/pulls/12/files')
        .reply(200, pr_files_payload)

        // Mock issues.addlabels adding path_label
        .post('/repos/testOwner/testRepo/issues/12/labels', body => {
          assert.notStrictEqual(body, expected_labels);
          return true;
        })
        .reply(200)

        // Mock issues.addlabels adding language_label
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
      const config = loadConfig('simple-config.yml');
      getConfigWithDefaultStub.resolves(config);
      const pr_opened_payload = require(resolve(
        fixturesPath,
        './events/pr_opened.json'
      ));
      const pr_files_payload = require(resolve(
        fixturesPath,
        './events/pr_opened_files_no_lang_match.json'
      ));
      const ghRequests = nock('https://api.github.com')
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
      const config = loadConfig('simple-config.yml');
      getConfigWithDefaultStub.resolves(config);
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
      assert.strictEqual(
        helper.getLabel(data, config, 'language'),
        'javascript'
      );
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
        helper.getLabel(data, lang_config, 'language'),
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
        helper.getLabel(data, lang_config, 'language'),
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
        helper.getLabel(data, lang_config, 'language'),
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
        helper.getLabel(data, lang_config, 'language'),
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
        helper.getLabel(data, lang_config, 'language'),
        'hello: javascript'
      );
    });
  });

  describe('labels paths correctly', () => {
    it('labels with user defined paths', async () => {
      const path_config = {
        pullrequest: true,
        labelprefix: 'path: ',
        paths: {
          src: 'my-app',
        },
      };
      const data = [
        {
          filename: 'src/index.ts',
          changes: 15,
        },
      ];
      assert.strictEqual(
        helper.getLabel(data, path_config, 'path'),
        'path: my-app'
      );
    });

    it('label is nil if path is not user defined', async () => {
      const path_config = {
        pullrequest: true,
        labelprefix: 'path: ',
      };
      const data = [
        {
          filename: 'src/index.ts',
          changes: 15,
        },
      ];
      assert.strictEqual(helper.getLabel(data, path_config, 'path'), undefined);
    });
  });
});
