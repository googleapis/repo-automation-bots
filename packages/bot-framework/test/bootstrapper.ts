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

import {
  Bootstrapper,
  HandlerFunction,
  BootstrapperApp,
} from '../src/bootstrapper';
import {NoopTaskEnqueuer} from '../src/background/task-enqueuer';
import {GCFLogger} from '../src/logging/gcf-logger';
// eslint-disable-next-line node/no-extraneous-import
import {RequestError} from '@octokit/request-error';
// eslint-disable-next-line node/no-extraneous-import
import {GraphqlResponseError} from '@octokit/graphql';
import * as errorLoggingModule from '../src/logging/error-logging';
import AggregateError from 'aggregate-error';
import {ServiceUnavailable} from '../src/errors';
import {
  mockRequest,
  mockResponse,
  mockRequestFromFixture,
  MockInstallationHandler,
  MockSecretLoader,
} from './helpers';
import {RestoreFn} from 'mocked-env';
import mockedEnv from 'mocked-env';
import assert from 'assert';
import {GoogleSecretLoader} from '../src/secrets/google-secret-loader';
import {Octokit} from '@octokit/rest';

nock.disableNetConnect();
const sandbox = sinon.createSandbox();

describe('Bootstrapper', () => {
  let restoreEnv: RestoreFn | null;
  afterEach(() => {
    sandbox.restore();
    if (restoreEnv) {
      restoreEnv();
      restoreEnv = null;
    }
  });

  describe('load', () => {
    it('requires a project id', async () => {
      await assert.rejects(
        async () => {
          await Bootstrapper.load({});
        },
        e => {
          return (e as Error).message.includes('PROJECT_ID');
        }
      );
    });
    it('requires a bot name', async () => {
      await assert.rejects(
        async () => {
          await Bootstrapper.load({
            projectId: 'my-project',
          });
        },
        e => {
          return (e as Error).message.includes('GCF_SHORT_FUNCTION_NAME');
        }
      );
    });
    it('requires a location', async () => {
      await assert.rejects(
        async () => {
          await Bootstrapper.load({
            projectId: 'my-project',
            botName: 'my-bot-name',
          });
        },
        e => {
          return (e as Error).message.includes('GCF_LOCATION');
        }
      );
    });
    it('detects from env var', async () => {
      restoreEnv = mockedEnv({
        GCF_SHORT_FUNCTION_NAME: 'my-bot-name',
        GCF_LOCATION: 'my-location',
        PROJECT_ID: 'my-project',
      });
      const bootstrapper = await Bootstrapper.load({
        secretLoader: new MockSecretLoader(),
      });
      assert.ok(bootstrapper);
    });
    it('loads secrets from Secret Manager', async () => {
      sandbox.stub(GoogleSecretLoader.prototype, 'load').resolves({
        privateKey: 'my-private-key',
        webhookSecret: 'my-webhook-secret',
        appId: '123456',
      });
      const bootstrapper = await Bootstrapper.load({
        projectId: 'my-project',
        botName: 'my-bot-name',
        location: 'my-location',
      });
      assert.ok(bootstrapper);
    });
  });

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
        const handler = bootstrapper.handler((app: BootstrapperApp) => {});
        const request = mockRequest({}, {});
        const response = mockResponse();

        await handler(request, response);

        sinon.assert.calledWith(response.status, 400);
      });
      it('routes to handler', async () => {
        const issueSpy = sandbox.stub();
        const handler = bootstrapper.handler((app: BootstrapperApp) => {
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
        const handler = bootstrapper.handler((app: BootstrapperApp) => {
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
      it('provides an authenticated octokit instance', async () => {
        const handler = bootstrapper.handler((app: BootstrapperApp) => {
          app.on('issues', context => {
            assert.ok(context.octokit);
          });
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
      });
      it('provides a context logger', async () => {
        const handler = bootstrapper.handler((app: BootstrapperApp) => {
          app.on('issues', context => {
            assert.ok(context.logger);
            assert.ok((context.logger.getBindings() as any).trigger);
          });
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
        const handler = bootstrapper.handler((app: BootstrapperApp) => {
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
        const handler = bootstrapper.handler((app: BootstrapperApp) => {
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
      const handler = bootstrapper.handler((app: BootstrapperApp) => {
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
        handler = bootstrapper.handler((app: BootstrapperApp) => {
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
