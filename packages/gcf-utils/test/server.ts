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

import sinon from 'sinon';
import nock from 'nock';
import * as http from 'http';
import * as express from 'express';
import {
  GCFBootstrapper,
  RequestWithRawBody,
  HandlerFunction,
} from '../src/gcf-utils';
import {GoogleAuth} from 'google-auth-library';
import {Octokit} from '@octokit/rest';
import * as gaxios from 'gaxios';
import assert from 'assert';
import {resolve} from 'path';
import {getServer} from '../src/server/server';

const fixturesPath = resolve(__dirname, '../../test/fixtures');

const TEST_SERVER_PORT = 8000;

nock.disableNetConnect();

const sandbox = sinon.createSandbox();

describe('GCFBootstrapper', () => {
  describe('server', () => {
    describe('without verification', () => {
      let server: http.Server;
      const bootstrapper = new GCFBootstrapper({
        projectId: 'test-project',
        functionName: 'test-bot',
        location: 'some-location',
      });
      const issueSpy = sandbox.stub();
      const repositoryCronSpy = sandbox.stub();
      const installationCronSpy = sandbox.stub();
      const globalCronSpy = sandbox.stub();
      const pubsubSpy = sandbox.stub();
      let enqueueTask: sinon.SinonStub = sandbox.stub();
      before(done => {
        nock.enableNetConnect(host => {
          return host.startsWith('localhost:');
        });

        sandbox.stub(bootstrapper, 'getProbotConfig').resolves({
          appId: 1234,
          secret: 'foo',
          privateKey: 'cert',
        });

        // This replaces the authClient with an auth client that uses an
        // API Key, this ensures that we will not attempt to lookup application
        // default credentials:
        sandbox.replace(
          bootstrapper.storage.authClient,
          'request',
          async (opts: object) => {
            const auth = new GoogleAuth();
            const client = await auth.fromAPIKey('abc123');
            return client.request(opts);
          }
        );
        enqueueTask = sandbox.stub(bootstrapper.cloudTasksClient, 'createTask');
        sandbox
          .stub(bootstrapper, 'getAuthenticatedOctokit')
          .resolves(new Octokit());

        server = bootstrapper
          .server(async app => {
            app.on('issues', issueSpy);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            app.on('schedule.repository' as any, repositoryCronSpy);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            app.on('schedule.installation' as any, installationCronSpy);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            app.on('schedule.global' as any, globalCronSpy);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            app.on('pubsub.message' as any, pubsubSpy);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            app.on('err' as any, sinon.stub().throws());
          })
          .on('listening', () => {
            done();
          })
          .listen(TEST_SERVER_PORT);
      });

      afterEach(() => {
        issueSpy.reset();
        repositoryCronSpy.reset();
        installationCronSpy.reset();
        globalCronSpy.reset();
        pubsubSpy.reset();
      });

      after(done => {
        server.on('close', () => {
          done();
        });
        server.close();
      });

      it('should handle requests', async () => {
        const response = await gaxios.request({
          url: `http://localhost:${TEST_SERVER_PORT}/`,
          headers: {
            'x-github-delivery': '123',
            'x-cloudtasks-taskname': 'test-bot',
            'x-github-event': 'issues',
          },
        });
        assert.deepStrictEqual(response.status, 200);
        sinon.assert.notCalled(enqueueTask);
        sinon.assert.calledOnce(issueSpy);
      });

      it('should handle payloads', async () => {
        const payload = require(resolve(fixturesPath, './issue_event'));
        const response = await gaxios.request({
          url: `http://localhost:${TEST_SERVER_PORT}/`,
          headers: {
            'x-github-delivery': '123',
            'x-cloudtasks-taskname': 'test-bot',
            'x-github-event': 'issues',
            'content-type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify(payload),
        });
        assert.deepStrictEqual(response.status, 200);
        sinon.assert.notCalled(enqueueTask);
        sinon.assert.calledOnceWithMatch(
          issueSpy,
          sinon.match.has(
            'payload',
            sinon.match({
              action: 'opened',
              issue: {
                number: 10,
              },
            })
          )
        );
      });

      it('should queue requests', async () => {
        const payload = require(resolve(fixturesPath, './issue_event'));
        const response = await gaxios.request({
          url: `http://localhost:${TEST_SERVER_PORT}/`,
          headers: {
            'x-github-delivery': '123',
            'x-github-event': 'issues',
            'content-type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify(payload),
        });
        assert.deepStrictEqual(response.status, 200);
        sinon.assert.calledOnce(enqueueTask);
        sinon.assert.notCalled(issueSpy);
      });
    });

    describe('with verification', () => {
      let server: http.Server;
      const bootstrapper = new GCFBootstrapper({
        projectId: 'test-project',
        functionName: 'test-bot',
        location: 'some-location',
      });
      const issueSpy = sandbox.stub();
      const repositoryCronSpy = sandbox.stub();
      const installationCronSpy = sandbox.stub();
      const globalCronSpy = sandbox.stub();
      const pubsubSpy = sandbox.stub();
      let enqueueTask: sinon.SinonStub = sandbox.stub();
      before(done => {
        nock.enableNetConnect(host => {
          return host.startsWith('localhost:');
        });

        sandbox.stub(bootstrapper, 'getProbotConfig').resolves({
          appId: 1234,
          secret: 'foo',
          privateKey: 'cert',
        });

        // This replaces the authClient with an auth client that uses an
        // API Key, this ensures that we will not attempt to lookup application
        // default credentials:
        sandbox.replace(
          bootstrapper.storage.authClient,
          'request',
          async (opts: object) => {
            const auth = new GoogleAuth();
            const client = await auth.fromAPIKey('abc123');
            return client.request(opts);
          }
        );
        enqueueTask = sandbox.stub(bootstrapper.cloudTasksClient, 'createTask');
        sandbox
          .stub(bootstrapper, 'getAuthenticatedOctokit')
          .resolves(new Octokit());

        server = bootstrapper
          .server(
            async app => {
              app.on('issues', issueSpy);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              app.on('schedule.repository' as any, repositoryCronSpy);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              app.on('schedule.installation' as any, installationCronSpy);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              app.on('schedule.global' as any, globalCronSpy);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              app.on('pubsub.message' as any, pubsubSpy);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              app.on('err' as any, sinon.stub().throws());
            },
            {
              skipVerification: false,
            }
          )
          .on('listening', () => {
            done();
          })
          .listen(TEST_SERVER_PORT);
      });

      afterEach(() => {
        issueSpy.reset();
        repositoryCronSpy.reset();
        installationCronSpy.reset();
        globalCronSpy.reset();
        pubsubSpy.reset();
      });

      after(done => {
        server.on('close', () => {
          done();
        });
        server.close();
      });

      it('should reject bad signatures with 400 on webhooks', async () => {
        const response = await gaxios.request({
          url: `http://localhost:${TEST_SERVER_PORT}/`,
          headers: {
            'x-github-delivery': '123',
            'x-github-event': 'issues',
            'x-hub-signature': 'bad-signature',
          },
          // don't throw on non-success error codes
          validateStatus: () => {
            return true;
          },
        });
        assert.deepStrictEqual(response.status, 400);
        sinon.assert.notCalled(enqueueTask);
        sinon.assert.notCalled(issueSpy);
      });
    });
  });
});

describe('getServer', () => {
  let server: http.Server;
  let handlerFunction: HandlerFunction;
  before(done => {
    nock.enableNetConnect(host => {
      return host.startsWith('localhost:');
    });
    handlerFunction = async (
      request: RequestWithRawBody,
      response: express.Response
    ) => {
      if (request.rawBody) {
        response.send({
          status: 200,
          body: request.rawBody.toString('utf-8'),
        });
      } else {
        response.sendStatus(400);
      }
    };
    server = getServer(handlerFunction)
      .on('listening', () => {
        done();
      })
      .listen(TEST_SERVER_PORT);
  });
  after(done => {
    server.on('close', () => {
      done();
    });
    server.close();
  });

  interface TestResponse {
    body: string;
    status: number;
  }

  it('should inject rawBody into the request', async () => {
    const payload = '{  "foo": "bar"  }';
    const response = await gaxios.request<TestResponse>({
      url: `http://localhost:${TEST_SERVER_PORT}/`,
      headers: {
        'x-github-delivery': '123',
        'x-cloudtasks-taskname': 'test-bot',
        'x-github-event': 'issues',
        'content-type': 'application/json',
      },
      method: 'POST',
      body: payload,
    });
    assert.deepStrictEqual(response.status, 200);
    assert.strictEqual(response.data.body, payload);
  });
});
