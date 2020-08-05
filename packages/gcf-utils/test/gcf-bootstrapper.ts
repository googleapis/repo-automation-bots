// Copyright 2019 Google LLC
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

import {GCFBootstrapper, WrapOptions, logger} from '../src/gcf-utils';
import {describe, beforeEach, afterEach, it} from 'mocha';
import {GitHubAPI} from 'probot/lib/github';
import {Options} from 'probot';
import * as express from 'express';
import sinon from 'sinon';
import nock from 'nock';
import assert from 'assert';
import {v1} from '@google-cloud/secret-manager';

nock.disableNetConnect();

function nockListInstallationRepos() {
  return (
    nock('https://api.github.com/')
      .get('/installation/repositories')
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      .reply(200, require('../../test/fixtures/installations.json'))
  );
}

describe('GCFBootstrapper', () => {
  describe('gcf', () => {
    let handler: (
      request: express.Request,
      response: express.Response
    ) => Promise<void>;

    const response: express.Response = express.response;
    const sendStub: sinon.SinonStub<[object?], express.Response> = sinon.stub(
      response,
      'send'
    );
    const sendStatusStub: sinon.SinonStub<
      [number],
      express.Response
    > = sinon.stub(response, 'sendStatus');

    let req: express.Request;

    const spy: sinon.SinonStub = sinon.stub();
    let configStub: sinon.SinonStub<[boolean?], Promise<Options>>;

    let bootstrapper: GCFBootstrapper;

    let enqueueTask: sinon.SinonStub;

    async function mockBootstrapper(wrapOpts?: WrapOptions) {
      req = express.request;

      bootstrapper = new GCFBootstrapper();
      configStub = sinon
        .stub(bootstrapper, 'getProbotConfig')
        .resolves({id: 1234, secret: 'foo', webhookPath: 'bar'});

      enqueueTask = sinon.stub(bootstrapper, 'enqueueTask');
      sinon.stub(bootstrapper, 'getInstallationToken');
      handler = await bootstrapper.gcf(async app => {
        app.auth = () =>
          new Promise<GitHubAPI>(resolve => {
            resolve(GitHubAPI());
          });
        app.on('issues', spy);
        app.on('schedule.repository', spy);
        app.on('err', sinon.stub().throws());
      }, wrapOpts);
    }

    afterEach(() => {
      sendStub.reset();
      sendStatusStub.reset();
      spy.reset();
      configStub.reset();
      enqueueTask.reset();
    });

    it('calls the event handler', async () => {
      await mockBootstrapper();
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'issues';
      req.headers['x-github-delivery'] = '123';
      // populated once this job has been executed by cloud tasks:
      req.headers['x-cloudtasks-taskname'] = 'my-task';

      await handler(req, response);

      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.calledOnce(sendStub);
      sinon.assert.calledOnce(spy);
    });

    it('does not schedule task if background option is "false"', async () => {
      await mockBootstrapper({
        background: false,
        logging: true,
      });
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'issues';
      req.headers['x-github-delivery'] = '123';

      await handler(req, response);

      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.calledOnce(sendStub);
      sinon.assert.calledOnce(spy);
    });

    it('does nothing if there are missing headers', async () => {
      await mockBootstrapper();
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};

      await handler(req, response);

      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(spy);
      sinon.assert.notCalled(sendStub);
      sinon.assert.calledWith(sendStatusStub, 400);
    });

    it('returns 500 on errors', async () => {
      await mockBootstrapper();
      req.body = {
        installtion: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'err';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = 'my-task';

      await handler(req, response);

      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(spy);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.called(sendStub);
    });

    it('ensures that task is enqueued when called by scheduler for one repo', async () => {
      await mockBootstrapper();
      req.body = {
        installation: {id: 1},
        repo: 'firstRepo',
      };
      req.headers = {};
      req.headers['x-github-event'] = 'schedule.repository';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = '';

      await handler(req, response);

      sinon.assert.calledOnce(enqueueTask);
    });

    it('ensures that task is enqueued when called by scheduler for many repos', async () => {
      await mockBootstrapper();
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'schedule.repository';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = '';
      nockListInstallationRepos();

      await handler(req, response);

      sinon.assert.calledTwice(enqueueTask);
    });

    it('ensures that task is enqueued when called by Github', async () => {
      await mockBootstrapper();
      req.body = {
        installtion: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'another.name';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = '';

      await handler(req, response);

      sinon.assert.calledOnce(enqueueTask);
    });
  });

  describe('loadProbot', () => {
    let bootstrapper: GCFBootstrapper;
    let configStub: sinon.SinonStub<[boolean?], Promise<Options>>;

    beforeEach(() => {
      bootstrapper = new GCFBootstrapper();
      configStub = sinon
        .stub(bootstrapper, 'getProbotConfig')
        .resolves({id: 1234, secret: 'foo', webhookPath: 'bar'});
    });

    afterEach(() => {
      configStub.reset();
    });

    it('gets the config', async () => {
      await bootstrapper.loadProbot(async () => {
        // Do nothing
      });
      sinon.assert.calledOnce(configStub);
    });

    it('caches the probot if initialized', async () => {
      await bootstrapper.loadProbot(async () => {
        // Do nothing
      });
      sinon.assert.calledOnce(configStub);
      await bootstrapper.loadProbot(async () => {
        // Do nothing again
      });
      sinon.assert.calledOnce(configStub);
    });
  });

  describe('getProbotConfig', () => {
    let bootstrapper: GCFBootstrapper;
    let secretClientStub: v1.SecretManagerServiceClient;
    let secretsStub: sinon.SinonStub;
    let secretVersionNameStub: sinon.SinonStub;

    beforeEach(() => {
      secretClientStub = new v1.SecretManagerServiceClient();
      bootstrapper = new GCFBootstrapper(secretClientStub);

      secretVersionNameStub = sinon
        .stub(bootstrapper, 'getLatestSecretVersionName')
        .callsFake(() => {
          return 'foobar';
        });
    });

    afterEach(() => {
      secretsStub.reset();
      secretVersionNameStub.reset();
    });

    it('gets the config', async () => {
      secretsStub = sinon
        .stub(secretClientStub, 'accessSecretVersion')
        .resolves([
          {
            payload: {
              data: JSON.stringify({
                id: 1234,
                secret: 'foo',
                webhookPath: 'bar',
              }),
            },
          },
        ]);
      await bootstrapper.getProbotConfig();
      sinon.assert.calledOnce(secretsStub);
      sinon.assert.calledOnceWithExactly(secretsStub, {name: 'foobar'});
      sinon.assert.calledOnce(secretVersionNameStub);
    });

    it('throws on empty data', async () => {
      secretsStub = sinon
        .stub(secretClientStub, 'accessSecretVersion')
        .resolves([
          {
            payload: {
              data: '',
            },
          },
        ]);

      assert.rejects(bootstrapper.getProbotConfig());
    });

    it('throws on empty payload', async () => {
      secretsStub = sinon
        .stub(secretClientStub, 'accessSecretVersion')
        .resolves([
          {
            payload: {},
          },
        ]);

      assert.rejects(bootstrapper.getProbotConfig());
    });

    it('throws on empty response', async () => {
      secretsStub = sinon
        .stub(secretClientStub, 'accessSecretVersion')
        .resolves([{}]);

      assert.rejects(bootstrapper.getProbotConfig());
    });
  });

  describe('getLatestSecretVersionName', () => {
    let bootstrapper: GCFBootstrapper;
    let secretVersionNameStub: sinon.SinonStub;

    beforeEach(() => {
      bootstrapper = new GCFBootstrapper();
      secretVersionNameStub = sinon
        .stub(bootstrapper, 'getSecretName')
        .callsFake(() => {
          return 'foobar';
        });
    });

    afterEach(() => {
      secretVersionNameStub.reset();
    });

    it('appends "latest"', async () => {
      const latest = bootstrapper.getLatestSecretVersionName();
      assert.strictEqual(latest, 'foobar/versions/latest');
      sinon.assert.calledOnce(secretVersionNameStub);
    });
  });

  describe('getSecretName', () => {
    let bootstrapper: GCFBootstrapper;
    const storedEnv = process.env;

    beforeEach(() => {
      bootstrapper = new GCFBootstrapper();
    });

    afterEach(() => {
      process.env = storedEnv;
    });

    it('formats from env even with nothing', async () => {
      const latest = bootstrapper.getSecretName();
      assert.strictEqual(latest, 'projects//secrets/');
    });

    it('formats from env', async () => {
      process.env.PROJECT_ID = 'foo';
      process.env.GCF_SHORT_FUNCTION_NAME = 'bar';
      const latest = bootstrapper.getSecretName();
      assert.strictEqual(latest, 'projects/foo/secrets/bar');
    });
  });

  describe('bindPropertiesToLogger', () => {
    it('binds given properties', () => {
      const triggerInfoWithoutMessage = {
        trigger: {
          trigger_type: 'GITHUB_WEBHOOK',
          trigger_sender: 'some sender',
          payload_hash: '123456',

          trigger_source_repo: {
            owner: 'foo owner',
            owner_type: 'Org',
            repo_name: 'bar name',
            url: 'some url',
          },
        },
      };

      GCFBootstrapper['bindPropertiesToLogger'](triggerInfoWithoutMessage);
      assert.deepEqual(logger.bindings(), triggerInfoWithoutMessage);
    });
  });
});
