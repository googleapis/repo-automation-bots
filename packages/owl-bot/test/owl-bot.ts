// Copyright 2021 Google LLC
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

import * as assert from 'assert';
import {core} from '../src/core';
import * as handlers from '../src/handlers';
import {describe, it, beforeEach} from 'mocha';
import {logger} from 'gcf-utils';
import owlBot from '../src/owl-bot';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import * as sinon from 'sinon';
import nock from 'nock';
import {owlBotLockPath} from '../src/config-files';

nock.disableNetConnect();
const sandbox = sinon.createSandbox();

describe('owlBot', () => {
  let probot: Probot;
  beforeEach(async () => {
    sandbox.stub(process, 'env').value({
      APP_ID: '1234354',
      PROJECT_ID: 'foo-project',
      CLOUD_BUILD_TRIGGER: 'aef1e540-d401-4b85-8127-b72b5993c20d',
    });
    probot = createProbot({
      overrides: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
      },
    });
    await probot.load((app: Probot) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      owlBot('abc123', app, sandbox.stub() as any);
    });
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe('post processing pull request', () => {
    it('returns early and logs if pull request opened from fork', async () => {
      const payload = {
        installation: {
          id: 12345,
        },
        pull_request: {
          head: {
            repo: {
              full_name: 'bcoe/owl-bot-testing',
            },
          },
          base: {
            repo: {
              full_name: 'SurferJeffAtGoogle/owl-bot-testing',
            },
          },
        },
      };
      const loggerStub = sandbox.stub(logger, 'info');
      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      sandbox.assert.calledWith(
        loggerStub,
        sandbox.match(/.*does not match base.*/)
      );
    });
    it('triggers build if pull request not from fork', async () => {
      const payload = {
        installation: {
          id: 12345,
        },
        pull_request: {
          number: 33,
          head: {
            repo: {
              full_name: 'bcoe/owl-bot-testing',
            },
            ref: 'abc123',
          },
          base: {
            repo: {
              full_name: 'bcoe/owl-bot-testing',
            },
          },
        },
      };
      const config = `docker:
      image: node
      digest: sha256:9205bb385656cd196f5303b03983282c95c2dfab041d275465c525b501574e5c`;
      const githubMock = nock('https://api.github.com')
        .get('/repos/bcoe/owl-bot-testing/pulls/33')
        .reply(200, payload.pull_request)
        .get(
          '/repos/bcoe/owl-bot-testing/contents/.github%2F.OwlBot.lock.yaml?ref=abc123'
        )
        .reply(200, {
          content: Buffer.from(config).toString('base64'),
          encoding: 'base64',
        })
        .get('/repos/bcoe/owl-bot-testing/pulls/33/files')
        .reply(200, [{filename: 'foo.txt'}])
        .get('/repos/bcoe/owl-bot-testing/pulls/33')
        .reply(200, payload.pull_request);
      const triggerBuildStub = sandbox
        .stub(core, 'triggerPostProcessBuild')
        .resolves({
          text: 'the text for check',
          summary: 'summary for check',
          conclusion: 'success',
          detailsURL: 'http://www.example.com',
        });
      const hasOwlBotLoopStub = sandbox
        .stub(core, 'hasOwlBotLoop')
        .resolves(false);
      const createCheckStub = sandbox.stub(core, 'createCheck');
      await probot.receive({
        name: 'pull_request.synchronize',
        payload,
        id: 'abc123',
      });
      sandbox.assert.calledOnce(triggerBuildStub);
      sandbox.assert.calledOnce(createCheckStub);
      sandbox.assert.calledOnce(hasOwlBotLoopStub);
      githubMock.done();
    });
    it('returns early and throws if postprocessor appears to be looping', async () => {
      const payload = {
        installation: {
          id: 12345,
        },
        pull_request: {
          head: {
            repo: {
              full_name: 'bcoe/owl-bot-testing',
            },
            ref: 'abc123',
          },
          base: {
            repo: {
              full_name: 'bcoe/owl-bot-testing',
            },
          },
        },
      };
      const hasOwlBotLoopStub = sandbox
        .stub(core, 'hasOwlBotLoop')
        .resolves(true);
      await assert.rejects(
        probot.receive({
          name: 'pull_request.synchronize',
          payload,
          id: 'abc123',
        }),
        /too many OwlBot updates/
      );
      sandbox.assert.calledOnce(hasOwlBotLoopStub);
    });
  });
  it('closes pull request if it has 0 files changed', async () => {
    const payload = {
      installation: {
        id: 12345,
      },
      pull_request: {
        number: 33,
        head: {
          repo: {
            full_name: 'bcoe/owl-bot-testing',
          },
          ref: 'abc123',
        },
        base: {
          repo: {
            full_name: 'bcoe/owl-bot-testing',
          },
        },
      },
    };
    const config = `docker:
    image: node
    digest: sha256:9205bb385656cd196f5303b03983282c95c2dfab041d275465c525b501574e5c`;
    const githubMock = nock('https://api.github.com')
      .get('/repos/bcoe/owl-bot-testing/pulls/33')
      .reply(200, payload.pull_request)
      .get(
        '/repos/bcoe/owl-bot-testing/contents/.github%2F.OwlBot.lock.yaml?ref=abc123'
      )
      .reply(200, {
        content: Buffer.from(config).toString('base64'),
        encoding: 'base64',
      })
      .get('/repos/bcoe/owl-bot-testing/pulls/33/files')
      // No files changed:
      .reply(200, [])
      // Update to closed state:
      .patch('/repos/bcoe/owl-bot-testing/pulls/33')
      .reply(200);
    const triggerBuildStub = sandbox
      .stub(core, 'triggerPostProcessBuild')
      .resolves({
        text: 'the text for check',
        summary: 'summary for check',
        conclusion: 'success',
        detailsURL: 'http://www.example.com',
      });
    const hasOwlBotLoopStub = sandbox
      .stub(core, 'hasOwlBotLoop')
      .resolves(false);
    const createCheckStub = sandbox.stub(core, 'createCheck');
    await probot.receive({
      name: 'pull_request.synchronize',
      payload,
      id: 'abc123',
    });
    sandbox.assert.calledOnce(triggerBuildStub);
    sandbox.assert.calledOnce(createCheckStub);
    sandbox.assert.calledOnce(hasOwlBotLoopStub);
    githubMock.done();
  });
  it('closes pull request if only lock file changed', async () => {
    const payload = {
      installation: {
        id: 12345,
      },
      pull_request: {
        number: 33,
        draft: true,
        labels: [{name: 'owl-bot-update-lock'}],
        head: {
          repo: {
            full_name: 'bcoe/owl-bot-testing',
          },
          ref: 'abc123',
        },
        base: {
          repo: {
            full_name: 'bcoe/owl-bot-testing',
          },
        },
      },
    };
    const config = `docker:
    image: node
    digest: sha256:9205bb385656cd196f5303b03983282c95c2dfab041d275465c525b501574e5c`;
    const githubMock = nock('https://api.github.com')
      .get('/repos/bcoe/owl-bot-testing/pulls/33')
      .reply(200, payload.pull_request)
      .get(
        '/repos/bcoe/owl-bot-testing/contents/.github%2F.OwlBot.lock.yaml?ref=abc123'
      )
      .reply(200, {
        content: Buffer.from(config).toString('base64'),
        encoding: 'base64',
      })
      .get('/repos/bcoe/owl-bot-testing/pulls/33/files')
      // Only the lock file changed.
      .reply(200, [{ filename: owlBotLockPath}])
      .get('/repos/bcoe/owl-bot-testing/pulls/33')
      .reply(200, payload.pull_request)
      // Update to closed state:
      .patch('/repos/bcoe/owl-bot-testing/pulls/33')
      .reply(200);
    const triggerBuildStub = sandbox
      .stub(core, 'triggerPostProcessBuild')
      .resolves({
        text: 'the text for check',
        summary: 'summary for check',
        conclusion: 'success',
        detailsURL: 'http://www.example.com',
      });
    const hasOwlBotLoopStub = sandbox
      .stub(core, 'hasOwlBotLoop')
      .resolves(false);
    const createCheckStub = sandbox.stub(core, 'createCheck');
    await probot.receive({
      name: 'pull_request.synchronize',
      payload,
      id: 'abc123',
    });
    sandbox.assert.calledOnce(triggerBuildStub);
    sandbox.assert.calledOnce(createCheckStub);
    sandbox.assert.calledOnce(hasOwlBotLoopStub);
    githubMock.done();
  });
  it('leaves PR open because it\'s not a draft', async () => {
    const payload = {
      installation: {
        id: 12345,
      },
      pull_request: {
        number: 33,
        draft: false,
        labels: [{name: 'owl-bot-update-lock'}],
        head: {
          repo: {
            full_name: 'bcoe/owl-bot-testing',
          },
          ref: 'abc123',
        },
        base: {
          repo: {
            full_name: 'bcoe/owl-bot-testing',
          },
        },
      },
    };
    const config = `docker:
    image: node
    digest: sha256:9205bb385656cd196f5303b03983282c95c2dfab041d275465c525b501574e5c`;
    const githubMock = nock('https://api.github.com')
      .get('/repos/bcoe/owl-bot-testing/pulls/33')
      .reply(200, payload.pull_request)
      .get(
        '/repos/bcoe/owl-bot-testing/contents/.github%2F.OwlBot.lock.yaml?ref=abc123'
      )
      .reply(200, {
        content: Buffer.from(config).toString('base64'),
        encoding: 'base64',
      })
      .get('/repos/bcoe/owl-bot-testing/pulls/33/files')
      // Only the lock file changed.
      .reply(200, [{ filename: owlBotLockPath}])
      .get('/repos/bcoe/owl-bot-testing/pulls/33')
      .reply(200, payload.pull_request)
    const triggerBuildStub = sandbox
      .stub(core, 'triggerPostProcessBuild')
      .resolves({
        text: 'the text for check',
        summary: 'summary for check',
        conclusion: 'success',
        detailsURL: 'http://www.example.com',
      });
    const hasOwlBotLoopStub = sandbox
      .stub(core, 'hasOwlBotLoop')
      .resolves(false);
    const createCheckStub = sandbox.stub(core, 'createCheck');
    await probot.receive({
      name: 'pull_request.synchronize',
      payload,
      id: 'abc123',
    });
    sandbox.assert.calledOnce(triggerBuildStub);
    sandbox.assert.calledOnce(createCheckStub);
    sandbox.assert.calledOnce(hasOwlBotLoopStub);
    githubMock.done();
  });
  it('loads async app before handling request', async () => {
    const probot = createProbot({
      overrides: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
      },
    });
    await probot.load(async (app: Probot) => {
      await new Promise(resolve => {
        setTimeout(() => {
          return resolve(undefined);
        }, 100);
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      owlBot('abc123', app, sandbox.stub() as any);
    });
    const loggerStub = sandbox.stub(logger, 'info');
    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'pubsub.message' as any,
      payload: {},
      id: 'abc123',
    });
    sandbox.assert.calledOnce(loggerStub);
  });
  describe('scan configs cron', () => {
    it('invokes scanGithubForConfigs', async () => {
      const payload = {
        org: 'googleapis',
        installation: {
          id: 12345,
        },
      };
      let org: string | undefined = undefined;
      let installation: number | undefined = undefined;
      sandbox.replace(
        handlers,
        'scanGithubForConfigs',
        (
          _configStore,
          _octokit,
          _org: string,
          _installation: number
        ): Promise<void> => {
          org = _org;
          installation = _installation;
          return Promise.resolve(undefined);
        }
      );
      await probot.receive({
        name: 'schedule.repository' as '*',
        payload,
        id: 'abc123',
      });
      assert.strictEqual(org, 'googleapis');
      assert.strictEqual(installation, 12345);
    });
  });
});
