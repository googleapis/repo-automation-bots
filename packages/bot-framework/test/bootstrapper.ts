// Copyright 2023 Google LLC
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

import {describe, beforeEach, afterEach, it} from 'mocha';
import sinon from 'sinon';
import nock from 'nock';

import {Webhooks} from '@octokit/webhooks';
import * as express from 'express';
import fs from 'fs';
import {Bootstrapper, HandlerFunction} from '../src/bootstrapper';
import {NoopTaskEnqueuer} from '../src/background/task-enqueuer';
import {
  InstallationHandler,
  AppInstallation,
  InstalledRepository,
} from '../src/installations';
import {GCFLogger} from '../src';
// eslint-disable-next-line node/no-extraneous-import
import {RequestError} from '@octokit/request-error';
// eslint-disable-next-line node/no-extraneous-import
import {GraphqlResponseError} from '@octokit/graphql';
import * as errorLoggingModule from '../src/logging/error-logging';
import AggregateError from 'aggregate-error';
import {ServiceUnavailable} from '../src/errors';

nock.disableNetConnect();

const sandbox = sinon.createSandbox();

function mockRequest(body: object, headers: Record<string, any>) {
  const request = Object.create(
    Object.getPrototypeOf(express.request),
    Object.getOwnPropertyDescriptors(express.request)
  );
  request.rawBody = Buffer.from(JSON.stringify(body));
  request.body = body;
  request.headers = headers;
  return request;
}
function mockRequestFromFixture(fixture: string, headers: Record<string, any>) {
  const request = Object.create(
    Object.getPrototypeOf(express.request),
    Object.getOwnPropertyDescriptors(express.request)
  );
  const rawBody = fs.readFileSync(fixture);
  request.rawBody = rawBody;
  request.body = JSON.parse(rawBody.toString('utf-8'));
  request.headers = headers;
  return request;
}

function mockResponse() {
  const response = {} as any;
  response.status = sandbox.stub().returns(response);
  response.json = sandbox.stub().returns(response);
  response.send = sandbox.stub().returns(response);
  return response;
}

class MockInstallationHandler implements InstallationHandler {
  private installations: AppInstallation[] = [];
  private installedRepositoriesByInstallation: Map<
    number,
    InstalledRepository[]
  > = new Map();

  reset() {
    this.installations = [];
    this.installedRepositoriesByInstallation = new Map();
  }

  setInstallations(installations: AppInstallation[]) {
    this.installations = installations;
  }

  setInstalledRepositories(
    installationId: number,
    InstalledRepositories: InstalledRepository[]
  ) {
    this.installedRepositoriesByInstallation.set(
      installationId,
      InstalledRepositories
    );
  }

  async *eachInstallation(): AsyncGenerator<AppInstallation, void, void> {
    for (const installation of this.installations) {
      yield installation;
    }
  }
  async *eachInstalledRepository(
    installationId: number
  ): AsyncGenerator<InstalledRepository, void, void> {
    const installedRepositories =
      this.installedRepositoriesByInstallation.get(installationId) || [];
    for (const repo of installedRepositories) {
      yield repo;
    }
  }
}

describe('Bootstrapper', () => {
  afterEach(() => {
    sandbox.restore();
  });

  describe('load', () => {});

  describe('handler', () => {
    describe('webhooks', async () => {
      const bootstrapper = new Bootstrapper({
        projectId: 'my-test-project',
        botName: 'my-bot-name',
        botSecrets: {
          appId: '1234',
          privateKey: 'my-private-key',
          webhookSecret: 'foo',
        },
        location: 'us-central1',
        skipVerification: true,
      });
      it('rejects unknown trigger types', async () => {
        const handler = bootstrapper.handler((app: Webhooks) => {});
        const request = mockRequest({}, {});
        const response = mockResponse();

        await handler(request, response);

        sinon.assert.calledWith(response.status, 400);
      });
      it('routes to handler', async () => {
        const issueSpy = sandbox.stub();
        const handler = bootstrapper.handler((app: Webhooks) => {
          app.on('issues', issueSpy);
        });

        const request = mockRequest(
          {
            installation: {id: 1},
          },
          {
            'x-github-event': 'issues',
            'x-github-delivery': '123',
            // populated once this job has been executed by cloud tasks:
            'x-cloudtasks-taskname': 'my-task',
          }
        );
        const response = mockResponse();

        await handler(request, response);

        sinon.assert.calledWith(response.status, 200);
        sinon.assert.calledOnce(issueSpy);
      });
      it('routes to multiple handlers', async () => {
        const issueSpy = sandbox.stub();
        const issueSpy2 = sandbox.stub();
        const issueOpenedSpy = sandbox.stub();
        const handler = bootstrapper.handler((app: Webhooks) => {
          app.on('issues', issueSpy);
          app.on('issues', issueSpy2);
          app.on('issues.opened', issueOpenedSpy);
        });

        const request = mockRequest(
          {
            installation: {id: 1},
            action: 'opened',
          },
          {
            'x-github-event': 'issues',
            'x-github-delivery': '123',
            // populated once this job has been executed by cloud tasks:
            'x-cloudtasks-taskname': 'my-task',
          }
        );
        const response = mockResponse();

        await handler(request, response);

        sinon.assert.calledWith(response.status, 200);
        sinon.assert.calledOnce(issueSpy);
        sinon.assert.calledOnce(issueSpy2);
        sinon.assert.calledOnce(issueOpenedSpy);
      });
    });

    describe('task retries', () => {});

    describe('with signatures', () => {
      it('rejects invalid signatures', async () => {
        const bootstrapper = new Bootstrapper({
          projectId: 'my-test-project',
          botName: 'my-bot-name',
          botSecrets: {
            appId: '1234',
            privateKey: 'my-private-key',
            webhookSecret: 'foo',
          },
          location: 'us-central1',
        });
        const issueSpy = sandbox.stub();
        const handler = bootstrapper.handler((app: Webhooks) => {
          app.on('issues', issueSpy);
        });

        const request = mockRequestFromFixture('test/fixtures/payload.json', {
          'x-github-event': 'issues',
          'x-github-delivery': '123',
          // populated once this job has been executed by cloud tasks:
          'x-cloudtasks-taskname': 'my-task',
          // cat fixtures/payload.json | openssl dgst -sha1 -hmac "foo"
          'x-hub-signature': 'sha1=badsig',
        });

        const response = mockResponse();
        await handler(request, response);

        sinon.assert.calledWith(response.status, 400);
        sinon.assert.notCalled(issueSpy);
      });

      it('handles valid task request signatures', async () => {
        const bootstrapper = new Bootstrapper({
          projectId: 'my-test-project',
          botName: 'my-bot-name',
          botSecrets: {
            appId: '1234',
            privateKey: 'my-private-key',
            webhookSecret: 'foo',
          },
          location: 'us-central1',
        });
        const issueSpy = sandbox.stub();
        const handler = bootstrapper.handler((app: Webhooks) => {
          app.on('issues', issueSpy);
        });

        const request = mockRequestFromFixture('test/fixtures/payload.json', {
          'x-github-event': 'issues',
          'x-github-delivery': '123',
          // populated once this job has been executed by cloud tasks:
          'x-cloudtasks-taskname': 'my-task',
          // cat fixtures/payload.json | openssl dgst -sha1 -hmac "foo"
          'x-hub-signature': 'sha1=a7b6d3cd0f5aa7233de433790d9a3a90f7195c76',
        });

        const response = mockResponse();
        await handler(request, response);

        sinon.assert.calledWith(response.status, 200);
        sinon.assert.calledOnce(issueSpy);
      });
    });

    describe('cron', () => {
      const installationHandler = new MockInstallationHandler();
      const taskEnqueuer = new NoopTaskEnqueuer();
      const bootstrapper = new Bootstrapper({
        projectId: 'my-test-project',
        botName: 'my-bot-name',
        botSecrets: {
          appId: '1234',
          privateKey: 'my-private-key',
          webhookSecret: 'foo',
        },
        location: 'us-central1',
        skipVerification: true,
        taskEnqueuer,
        installationHandler,
      });
      const issueSpy = sandbox.stub();
      const handler = bootstrapper.handler((app: Webhooks) => {
        app.on('issues', issueSpy);
      });
      beforeEach(() => {
        installationHandler.reset();
      });
      describe('per-repository cron', () => {
        it('eneueues tasks for a single installation', async () => {
          const request = mockRequest(
            {
              installation: {id: 1},
            },
            {
              'x-github-event': 'schedule.repository',
              'x-github-delivery': '123',
            }
          );
          const enqueueTaskStub = sandbox.stub(taskEnqueuer, 'enqueueTask');
          const response = mockResponse();
          installationHandler.setInstalledRepositories(1, [
            {
              id: 1,
              fullName: 'test-owner/test-repo',
              archived: false,
              disabled: false,
            },
            {
              id: 2,
              fullName: 'test-owner/another-test-repo',
              archived: false,
              disabled: false,
            },
          ]);

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.notCalled(issueSpy);
          sinon.assert.calledTwice(enqueueTaskStub);
        });
        it('enqueues tasks for all installations', async () => {
          const request = mockRequest(
            {},
            {
              'x-github-event': 'schedule.repository',
              'x-github-delivery': '123',
            }
          );
          const enqueueTaskStub = sandbox.stub(taskEnqueuer, 'enqueueTask');
          const response = mockResponse();
          installationHandler.setInstallations([
            {
              id: 1,
              targetType: 'Organization',
            },
            {
              id: 2,
              targetType: 'Organization',
            },
          ]);
          installationHandler.setInstalledRepositories(1, [
            {
              id: 1,
              fullName: 'test-owner/test-repo',
              archived: false,
              disabled: false,
            },
            {
              id: 2,
              fullName: 'test-owner/another-test-repo',
              archived: false,
              disabled: false,
            },
          ]);
          installationHandler.setInstalledRepositories(2, [
            {
              id: 3,
              fullName: 'another-owner/test-repo',
              archived: false,
              disabled: false,
            },
          ]);

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.notCalled(issueSpy);
          sinon.assert.calledThrice(enqueueTaskStub);
        });
        it('enqueues task for a single repository', async () => {
          const request = mockRequest(
            {
              installation: {id: 1},
              repo: 'test-owner/test-repo',
            },
            {
              'x-github-event': 'schedule.repository',
              'x-github-delivery': '123',
            }
          );
          const enqueueTaskStub = sandbox.stub(taskEnqueuer, 'enqueueTask');
          const response = mockResponse();

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.notCalled(issueSpy);
          sinon.assert.calledOnce(enqueueTaskStub);
        });
      });
      describe('per-installation cron', () => {
        it('enqueues task for a single installation', async () => {
          const request = mockRequest(
            {
              installation: {id: 1},
              cron_type: 'installation',
            },
            {
              'x-github-event': 'schedule.repository',
              'x-github-delivery': '123',
            }
          );
          const enqueueTaskStub = sandbox.stub(taskEnqueuer, 'enqueueTask');
          const response = mockResponse();

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.notCalled(issueSpy);
          sinon.assert.calledOnce(enqueueTaskStub);
        });
        it('enqueues tasks for all installations', async () => {
          const request = mockRequest(
            {
              cron_type: 'installation',
            },
            {
              'x-github-event': 'schedule.repository',
              'x-github-delivery': '123',
            }
          );
          const enqueueTaskStub = sandbox.stub(taskEnqueuer, 'enqueueTask');
          const response = mockResponse();
          installationHandler.setInstallations([
            {
              id: 1,
              targetType: 'Organization',
            },
            {
              id: 2,
              targetType: 'Organization',
            },
          ]);

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.notCalled(issueSpy);
          sinon.assert.calledTwice(enqueueTaskStub);
        });
      });
      describe('global cron', () => {
        it('enqueues a single task', async () => {
          const request = mockRequest(
            {
              cron_type: 'global',
            },
            {
              'x-github-event': 'schedule.repository',
              'x-github-delivery': '123',
            }
          );
          const enqueueTaskStub = sandbox.stub(taskEnqueuer, 'enqueueTask');
          const response = mockResponse();

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.notCalled(issueSpy);
          sinon.assert.calledOnce(enqueueTaskStub);
        });
      });
    });

    describe('pubsub', () => {});

    describe('error handling', () => {
      const bootstrapper = new Bootstrapper({
        projectId: 'my-test-project',
        botName: 'my-bot-name',
        botSecrets: {
          appId: '1234',
          privateKey: 'my-private-key',
          webhookSecret: 'foo',
        },
        location: 'us-central1',
        skipVerification: true,
      });
      let handler: HandlerFunction;
      let issueSpy: sinon.SinonStub;
      let pullSpy1: sinon.SinonStub;
      let pullSpy2: sinon.SinonStub;
      let logErrorsStub: sinon.SinonStub;
      beforeEach(() => {
        issueSpy = sandbox.stub();
        pullSpy1 = sandbox.stub();
        pullSpy2 = sandbox.stub();
        handler = bootstrapper.handler((app: Webhooks) => {
          app.on('issues', issueSpy);
          app.on('pull_request', pullSpy1);
          app.on('pull_request', pullSpy2);
        });
        logErrorsStub = sandbox.stub(errorLoggingModule, 'logErrors');
      });
      it('returns 500 on errors', async () => {
        issueSpy.throws();
        const request = mockRequest(
          {
            installation: {id: 1},
          },
          {
            'x-github-event': 'issues',
            'x-github-delivery': '123',
            // populated once this job has been executed by cloud tasks:
            'x-cloudtasks-taskname': 'my-task',
          }
        );
        const response = mockResponse();
        await handler(request, response);

        sinon.assert.calledOnce(issueSpy);
        sinon.assert.calledWith(response.status, 500);
        sinon.assert.calledWith(
          logErrorsStub,
          sinon.match.instanceOf(GCFLogger),
          sinon.match.instanceOf(Error),
          false
        );
      });

      it('reports to error reporting on final retry', async () => {
        issueSpy.throws();
        const request = mockRequest(
          {
            installation: {id: 1},
          },
          {
            'x-github-event': 'issues',
            'x-github-delivery': '123',
            // populated once this job has been executed by cloud tasks:
            'x-cloudtasks-taskname': 'my-task',
            'x-cloudtasks-taskretrycount': '10',
          }
        );
        const response = mockResponse();
        await handler(request, response);

        sinon.assert.calledOnce(issueSpy);
        sinon.assert.calledWith(response.status, 500);
        sinon.assert.calledWith(
          logErrorsStub,
          sinon.match.instanceOf(GCFLogger),
          sinon.match.any,
          true
        );
      });

      it('logs errors for multiple handler errors', async () => {
        pullSpy1.throws(new SyntaxError('Some message'));
        pullSpy2.throws(new Error('Another message'));
        const request = mockRequest(
          {
            installation: {id: 1},
          },
          {
            'x-github-event': 'pull_request',
            'x-github-delivery': '123',
            // populated once this job has been executed by cloud tasks:
            'x-cloudtasks-taskname': 'my-task',
          }
        );
        const response = mockResponse();
        await handler(request, response);

        sinon.assert.calledOnce(pullSpy1);
        sinon.assert.calledOnce(pullSpy2);
        sinon.assert.calledWith(response.status, 500);
        sinon.assert.calledWith(
          logErrorsStub,
          sinon.match.instanceOf(GCFLogger),
          sinon.match.instanceOf(AggregateError),
          false
        );
      });

      it('returns 503 on rate limit errors', async () => {
        issueSpy.throws(
          new RequestError('API rate limit exceeded for user ID 3456', 403, {
            response: {
              headers: {
                'x-ratelimit-remaining': '0',
                'x-ratelimit-reset': '1653880306',
                'x-ratelimit-limit': '5000',
                'x-ratelimit-resource': 'core',
              },
              status: 403,
              url: '',
              data: '',
            },
            request: {
              headers: {},
              method: 'POST',
              url: '',
            },
          })
        );
        const request = mockRequest(
          {
            installation: {id: 1},
          },
          {
            'x-github-event': 'issues',
            'x-github-delivery': '123',
            // populated once this job has been executed by cloud tasks:
            'x-cloudtasks-taskname': 'my-task',
          }
        );
        const response = mockResponse();
        await handler(request, response);

        sinon.assert.calledOnce(issueSpy);
        sinon.assert.calledWith(response.status, 503);
      });

      it('returns 503 on secondary rate limit errors', async () => {
        issueSpy.throws(
          new RequestError(
            'You have exceeded a secondary rate limit. Please wait a few minutes before you try again.',
            403,
            {
              response: {
                headers: {},
                status: 403,
                url: '',
                data: '',
              },
              request: {
                headers: {},
                method: 'POST',
                url: '',
              },
            }
          )
        );
        const request = mockRequest(
          {
            installation: {id: 1},
          },
          {
            'x-github-event': 'issues',
            'x-github-delivery': '123',
            // populated once this job has been executed by cloud tasks:
            'x-cloudtasks-taskname': 'my-task',
          }
        );
        const response = mockResponse();
        await handler(request, response);

        sinon.assert.calledOnce(issueSpy);
        sinon.assert.calledWith(response.status, 503);
      });

      it('returns 503 on graphql rate limit errors', async () => {
        issueSpy.throws(
          new GraphqlResponseError(
            {
              method: 'GET',
              url: 'fake',
            },
            {
              'x-ratelimit-remaining': '0',
              'x-ratelimit-reset': '1653880306',
              'x-ratelimit-limit': '12500',
              'x-ratelimit-resource': 'graphql',
            },
            {
              data: {},
              errors: [
                {
                  type: 'RATE_LIMITED',
                  message:
                    'API rate limit exceeded for installation ID 1848216',
                  path: ['fake'],
                  extensions: {},
                  locations: [{line: 1, column: 2}],
                },
              ],
            }
          )
        );
        const request = mockRequest(
          {
            installation: {id: 1},
          },
          {
            'x-github-event': 'issues',
            'x-github-delivery': '123',
            // populated once this job has been executed by cloud tasks:
            'x-cloudtasks-taskname': 'my-task',
          }
        );
        const response = mockResponse();
        await handler(request, response);

        sinon.assert.calledOnce(issueSpy);
        sinon.assert.calledWith(response.status, 503);
      });

      it('returns 503 on ServiceUnavailable', async () => {
        issueSpy.throws(
          new ServiceUnavailable('', new Error('An error happened'))
        );
        const request = mockRequest(
          {
            installation: {id: 1},
          },
          {
            'x-github-event': 'issues',
            'x-github-delivery': '123',
            // populated once this job has been executed by cloud tasks:
            'x-cloudtasks-taskname': 'my-task',
          }
        );
        const response = mockResponse();
        await handler(request, response);

        sinon.assert.calledOnce(issueSpy);
        sinon.assert.calledWith(response.status, 503);
      });
    });
  });
});
