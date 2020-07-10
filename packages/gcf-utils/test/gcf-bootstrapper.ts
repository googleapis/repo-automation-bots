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

import {GCFBootstrapper, TriggerType, TriggerInfo} from '../src/gcf-utils';
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
    let configStub: sinon.SinonStub<[], Promise<Options>>;

    let bootstrapper: GCFBootstrapper;

    let enqueueTask: sinon.SinonStub;

    beforeEach(async () => {
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
      });
    });

    afterEach(() => {
      sendStub.reset();
      sendStatusStub.reset();
      spy.reset();
      configStub.reset();
      enqueueTask.reset();
    });

    it('calls the event handler', async () => {
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'issues';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = 'my-task';

      await handler(req, response);

      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.calledOnce(sendStub);
      sinon.assert.calledOnce(spy);
    });

    it('does nothing if there are missing headers', async () => {
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
    let configStub: sinon.SinonStub<[], Promise<Options>>;

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

  describe('buildTriggerInfo', () => {
    let bootstrapper: GCFBootstrapper;

    beforeEach(() => {
      bootstrapper = new GCFBootstrapper();
    });

    it('returns correct scheduler trigger info', () => {
      const requestBody = {};
      const github_delivery_guid = '';
      const triggerType = TriggerType.SCHEDULER;
      const triggerInfo = bootstrapper.buildTriggerInfo(
        triggerType,
        github_delivery_guid,
        requestBody
      );
      const expectedInfo = {
        trigger: {
          trigger_type: 'SCHEDULER',
        },
      };
      assert.deepEqual(triggerInfo, expectedInfo);
    });

    it('returns correct task trigger info', () => {
      const requestBody = {};
      const github_delivery_guid = '1234';
      const triggerType = TriggerType.TASK;
      const triggerInfo: TriggerInfo = bootstrapper.buildTriggerInfo(
        triggerType,
        github_delivery_guid,
        requestBody
      );
      const expectedInfo: TriggerInfo = {
        trigger: {
          trigger_type: TriggerType.TASK,
          github_delivery_guid: '1234',
        },
      };
      assert.deepEqual(triggerInfo, expectedInfo);
    });

    it('returns correct Github trigger info', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const requestBody = require('../../test/fixtures/github-webhook-payload-all-info.json');
      const github_delivery_guid = '1234';
      const triggerType = TriggerType.GITHUB;
      const triggerInfo = bootstrapper.buildTriggerInfo(
        triggerType,
        github_delivery_guid,
        requestBody
      );
      const expectedInfo = {
        trigger: {
          trigger_type: 'GITHUB_WEBHOOK',
          trigger_sender: 'testUser2',
          github_delivery_guid: '1234',
          trigger_source_repo: {
            owner: 'testOwner',
            owner_type: 'User',
            repo_name: 'testRepo',
          },
        },
      };
      assert.deepEqual(triggerInfo, expectedInfo);
    });

    it('returns UNKNOWN for Github trigger info when information is unavailable', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const requestBody = require('../../test/fixtures/github-webhook-payload-missing-info.json');
      const github_delivery_guid = '';
      const triggerType = TriggerType.GITHUB;
      const triggerInfo: TriggerInfo = bootstrapper.buildTriggerInfo(
        triggerType,
        github_delivery_guid,
        requestBody
      );
      const expectedInfo: TriggerInfo = {
        trigger: {
          trigger_type: TriggerType.GITHUB,
          trigger_sender: 'UNKNOWN',
          github_delivery_guid: '',
          trigger_source_repo: {
            owner: 'UNKNOWN',
            owner_type: 'UNKNOWN',
            repo_name: 'UNKNOWN',
          },
        },
      };
      assert.deepEqual(triggerInfo, expectedInfo);
    });
  });
});
