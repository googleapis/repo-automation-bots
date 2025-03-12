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
import {Probot, ProbotOctokit} from 'probot';
import {describe, it, beforeEach, afterEach} from 'mocha';
import nock from 'nock';
import * as assert from 'assert';
import {resolve} from 'path';
import * as sinon from 'sinon';
import {handler} from '../src/auto-label';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {loadConfig} from './test-helper';
import * as botConfigModule from '@google-automations/bot-config-utils';
import {ConfigChecker} from '@google-automations/bot-config-utils';
import * as gcfUtilsModule from 'gcf-utils';
const fetch = require('node-fetch');

nock.disableNetConnect();
const sandbox = sinon.createSandbox();

import * as helper from '../src/helper';
const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('language-and-path-labeling', () => {
  let probot: Probot;
  let getConfigWithDefaultStub: sinon.SinonStub;
  let validateConfigStub: sinon.SinonStub;
  let getAuthenticatedOctokitStub: sinon.SinonStub;

  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      }),
      request: {fetch},
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
    getAuthenticatedOctokitStub = sandbox.stub(
      gcfUtilsModule,
      'getAuthenticatedOctokit'
    );
    getAuthenticatedOctokitStub.resolves(new Octokit({request: {fetch}}));
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const config: any = {
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
      assert.deepStrictEqual(helper.getLabel(data, config, 'language'), [
        'javascript',
      ]);
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
      assert.deepStrictEqual(helper.getLabel(data, lang_config, 'language'), [
        'lang: typescript',
      ]);
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
      assert.deepStrictEqual(helper.getLabel(data, lang_config, 'language'), [
        'lang: c++',
      ]);
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
      assert.deepStrictEqual(helper.getLabel(data, lang_config, 'language'), [
        'lang: foo',
      ]);
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
      assert.deepStrictEqual(helper.getLabel(data, lang_config, 'language'), [
        'lang: bar',
      ]);
    });

    it('labels with user defined path according to example on README', async () => {
      const path_config = {
        pullrequest: true,
        labelprefix: 'api: ',
        paths: {
          'ai-platform': {
            '.': 'aiplatform',
          },
          appengine: {
            '.': 'appengine',
          },
          asset: {
            '.': 'cloudasset',
          },
          run: {
            '.': 'run',
          },
          vision: {
            '.': 'vision',
          },
        },
      };
      const data = [
        {
          filename: 'run/image-processing/.dockerignore',
          changes: 2,
        },
        {
          filename: 'vision/async-batch-annotate-images.js',
          changes: 1,
        },
      ];
      assert.deepStrictEqual(helper.getLabel(data, path_config, 'path'), [
        'api: run',
      ]);
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
      assert.deepStrictEqual(helper.getLabel(data, lang_config, 'language'), [
        'hello: javascript',
      ]);
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
      assert.deepStrictEqual(helper.getLabel(data, path_config, 'path'), [
        'path: my-app',
      ]);
    });

    it('labels with user defined paths when there are many', async () => {
      const path_config = {
        pullrequest: true,
        multipleLabelPaths: [
          {
            labelprefix: 'api: ',
            paths: {
              recaptcha_enterprise: 'recaptchaenterprise',
            },
          },
          {
            labelprefix: 'asset: ',
            paths: {
              recaptcha_enterprise: {
                demosite: 'flagship',
              },
            },
          },
        ],
      };
      const data = [
        {
          filename:
            'python-docs-samples/recaptcha_enterprise/demosite/README.md',
          changes: 15,
        },
      ];
      assert.deepStrictEqual(helper.getLabel(data, path_config, 'path'), [
        'api: recaptchaenterprise',
        'asset: flagship',
      ]);
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
      assert.deepStrictEqual(
        helper.getLabel(data, path_config, 'path'),
        undefined
      );
    });
  });
});
