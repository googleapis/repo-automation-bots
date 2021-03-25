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
import {Octokit} from '@octokit/rest';
import {Options} from 'probot';
import * as express from 'express';
import sinon from 'sinon';
import nock from 'nock';
import assert from 'assert';

import {v1} from '@google-cloud/secret-manager';
import {GoogleAuth} from 'google-auth-library';
import {InMemorySpanExporter} from '@opentelemetry/tracing';

// Resource path helper used by tasks requires that the following
// environment variables exist in the environment:
process.env.GCF_SHORT_FUNCTION_NAME = 'fake-function';
process.env.GCF_LOCATION = 'canada1-fake';
process.env.PROJECT_ID = 'fake-projet';

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
    let traceExporter: InMemorySpanExporter;

    async function mockBootstrapper(wrapOpts?: WrapOptions) {
      req = express.request;

      traceExporter = new InMemorySpanExporter();
      bootstrapper = new GCFBootstrapper(undefined, traceExporter);
      configStub = sinon
        .stub(bootstrapper, 'getProbotConfig')
        .resolves({appId: 1234, secret: 'foo', webhookPath: 'bar'});
      // This replaces the authClient with an auth client that uses an
      // API Key, this ensures that we will not attempt to lookup application
      // default credentials:
      bootstrapper.storage.authClient.request = async (opts: object) => {
        const auth = new GoogleAuth();
        const client = await auth.fromAPIKey('abc123');
        return client.request(opts);
      };

      enqueueTask = sinon.stub();
      bootstrapper.cloudTasksClient.createTask = enqueueTask;

      sinon
        .stub(bootstrapper, 'getAuthenticatedOctokit')
        .resolves(new Octokit());
      handler = bootstrapper.gcf(async app => {
        app.on('issues', spy);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app.on('schedule.repository' as any, spy);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        app.on('err' as any, sinon.stub().throws());
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

    it('stores task payload in Cloud Storage if WEBHOOK_TMP set', async () => {
      await mockBootstrapper();
      process.env.WEBHOOK_TMP = '/tmp/foo';
      let uploaded: {[key: string]: {[key: string]: number}} | undefined;
      // Fake an upload to Cloud Storage. It seemed worthwhile mocking this
      // entire flow, to ensure that we're using the streaming API
      // appropriately.
      const upload = nock('https://storage.googleapis.com')
        // Create a resumble upload URL:
        .defaultReplyHeaders({
          Location: 'https://storage.googleapis.com/bucket/foo',
        })
        .post(/.*/)
        .reply(200)
        // Upload the contents:
        .put(
          '/bucket/foo',
          (body: {[key: string]: {[key: string]: number}} | undefined) => {
            uploaded = body;
            return true;
          }
        )
        .reply(200, {});
      req.body = {
        installation: {id: 1},
        repo: 'firstRepo',
      };
      req.headers = {};
      req.headers['x-github-event'] = 'schedule.repository';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = '';

      await handler(req, response);

      delete process.env.WEBHOOK_TMP;
      // We should be attempting to write req.body to Cloud Storage:
      assert.strictEqual(uploaded?.installation?.id, 1);
      sinon.assert.calledOnce(enqueueTask);
      upload.done();
    });

    it('fetches payload from Cloud Storage, if tmpUrl in payload', async () => {
      await mockBootstrapper();
      process.env.WEBHOOK_TMP = '/tmp/foo';
      req.body = {
        tmpUrl: '/bucket/foo',
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'issues';
      req.headers['x-github-delivery'] = '123';
      // populated once this job has been executed by cloud tasks:
      req.headers['x-cloudtasks-taskname'] = 'my-task';
      // Fake download from Cloud Storage, again with the goal of ensuring
      // we're using the streams API appropriately:
      const downloaded = nock('https://storage.googleapis.com')
        .get('/storage/v1/b/tmp/foo/o/%2Fbucket%2Ffoo?')
        .reply(200, {
          metadata: {
            contentEncoding: 'text/plain',
          },
        })
        .get('/storage/v1/b/tmp/foo/o/%2Fbucket%2Ffoo?alt=media')
        .reply(
          200,
          JSON.stringify({
            installation: {
              id: 1,
            },
          })
        );

      await handler(req, response);

      delete process.env.WEBHOOK_TMP;
      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.calledOnce(sendStub);
      sinon.assert.calledOnce(spy);
      downloaded.done();
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

    it('binds the trigger information to the logger', async () => {
      await mockBootstrapper();
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'issues';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = 'my-task';

      await handler(req, response);

      const expectedBindings = {
        trigger: {trigger_type: 'Cloud Task', github_delivery_guid: '123'},
      };
      assert.deepEqual(logger.getBindings(), expectedBindings);
    });

    it('resets the logger on each call', async () => {
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'issues';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = 'my-task';

      const expectedBindings = {
        trigger: {trigger_type: 'Cloud Task', github_delivery_guid: '123'},
      };

      await mockBootstrapper();

      await handler(req, response);
      assert.deepEqual(logger.getBindings(), expectedBindings);

      await handler(req, response);
      assert.deepEqual(logger.getBindings(), expectedBindings);
    });
  });

  describe('loadProbot', () => {
    let bootstrapper: GCFBootstrapper;
    let configStub: sinon.SinonStub<[boolean?], Promise<Options>>;

    beforeEach(() => {
      bootstrapper = new GCFBootstrapper();
      configStub = sinon
        .stub(bootstrapper, 'getProbotConfig')
        .resolves({appId: 1234, secret: 'foo', webhookPath: 'bar'});
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
      delete process.env.PROJECT_ID;
      delete process.env.GCF_SHORT_FUNCTION_NAME;
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
});
