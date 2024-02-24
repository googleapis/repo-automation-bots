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
import * as http from 'http';

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
} from './helpers';
import assert from 'assert';
import {NoopPayloadCache} from '../src/background/payload-cache';
import * as gaxios from 'gaxios';
import {resolve} from 'path';
const fixturesPath = resolve(__dirname, '../../test/fixtures');

nock.disableNetConnect();
const sandbox = sinon.createSandbox();
const TEST_SERVER_PORT = 8000;

describe('Bootstrapper', () => {
  afterEach(() => {
    sandbox.restore();
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

    describe('task retries', () => {
      describe('with default retry settings', () => {
        const bootstrapper = new Bootstrapper({
          projectId: 'my-test-project',
          botName: 'my-bot-name',
          botSecrets: {
            appId: '1234',
            privateKey: 'my-private-key',
            webhookSecret: 'foo',
          },
          skipVerification: true,
        });
        it('accepts a retry task below the limit', async () => {
          const issueSpy = sandbox.stub();
          const handler = bootstrapper.handler((app: BootstrapperApp) => {
            app.onAny(issueSpy);
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
              'x-cloudtasks-taskretrycount': '1',
            }
          );
          const response = mockResponse();

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.calledOnce(issueSpy);
        });
        it('rejects a retry task above the limit', async () => {
          const issueSpy = sandbox.stub();
          const handler = bootstrapper.handler((app: BootstrapperApp) => {
            app.onAny(issueSpy);
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
              'x-cloudtasks-taskretrycount': '20',
            }
          );
          const response = mockResponse();

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.notCalled(issueSpy);
        });
        it('rejects a cron retry task', async () => {
          const issueSpy = sandbox.stub();
          const handler = bootstrapper.handler((app: BootstrapperApp) => {
            app.onAny(issueSpy);
          });

          const request = mockRequest(
            {
              installation: {id: 1},
            },
            {
              'x-github-event': 'schedule.repository',
              'x-github-delivery': '123',
              // populated once this job has been executed by cloud tasks:
              'x-cloudtasks-taskname': 'my-task',
              'x-cloudtasks-taskretrycount': '1',
            }
          );
          const response = mockResponse();

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.notCalled(issueSpy);
        });
        it('rejects a pubsub retry task', async () => {
          const issueSpy = sandbox.stub();
          const handler = bootstrapper.handler((app: BootstrapperApp) => {
            app.onAny(issueSpy);
          });

          const request = mockRequest(
            {
              installation: {id: 1},
            },
            {
              'x-github-event': 'pubsub.message',
              'x-github-delivery': '123',
              // populated once this job has been executed by cloud tasks:
              'x-cloudtasks-taskname': 'my-task',
              'x-cloudtasks-taskretrycount': '1',
            }
          );
          const response = mockResponse();

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.notCalled(issueSpy);
        });
      });
      describe('with custom retry settings', () => {
        const bootstrapper = new Bootstrapper({
          projectId: 'my-test-project',
          botName: 'my-bot-name',
          botSecrets: {
            appId: '1234',
            privateKey: 'my-private-key',
            webhookSecret: 'foo',
          },
          skipVerification: true,
          maxCronRetries: 2,
          maxPubSubRetries: 4,
          maxRetries: 10,
        });
        it('accepts a retry task below the limit', async () => {
          const issueSpy = sandbox.stub();
          const handler = bootstrapper.handler((app: BootstrapperApp) => {
            app.onAny(issueSpy);
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
              'x-cloudtasks-taskretrycount': '1',
            }
          );
          const response = mockResponse();

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.calledOnce(issueSpy);
        });
        it('rejects a retry task above the limit', async () => {
          const issueSpy = sandbox.stub();
          const handler = bootstrapper.handler((app: BootstrapperApp) => {
            app.onAny(issueSpy);
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
              'x-cloudtasks-taskretrycount': '20',
            }
          );
          const response = mockResponse();

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.notCalled(issueSpy);
        });
        it('accepts a cron retry task', async () => {
          const issueSpy = sandbox.stub();
          const handler = bootstrapper.handler((app: BootstrapperApp) => {
            app.onAny(issueSpy);
          });

          const request = mockRequest(
            {
              installation: {id: 1},
            },
            {
              'x-github-event': 'schedule.repository',
              'x-github-delivery': '123',
              // populated once this job has been executed by cloud tasks:
              'x-cloudtasks-taskname': 'my-task',
              'x-cloudtasks-taskretrycount': '2',
            }
          );
          const response = mockResponse();

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.calledOnce(issueSpy);
        });
        it('rejects a cron retry task above the limit', async () => {
          const issueSpy = sandbox.stub();
          const handler = bootstrapper.handler((app: BootstrapperApp) => {
            app.onAny(issueSpy);
          });

          const request = mockRequest(
            {
              installation: {id: 1},
            },
            {
              'x-github-event': 'schedule.repository',
              'x-github-delivery': '123',
              // populated once this job has been executed by cloud tasks:
              'x-cloudtasks-taskname': 'my-task',
              'x-cloudtasks-taskretrycount': '3',
            }
          );
          const response = mockResponse();

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.notCalled(issueSpy);
        });
        it('accepts a pubsub retry task', async () => {
          const issueSpy = sandbox.stub();
          const handler = bootstrapper.handler((app: BootstrapperApp) => {
            app.onAny(issueSpy);
          });

          const request = mockRequest(
            {
              installation: {id: 1},
            },
            {
              'x-github-event': 'pubsub.message',
              'x-github-delivery': '123',
              // populated once this job has been executed by cloud tasks:
              'x-cloudtasks-taskname': 'my-task',
              'x-cloudtasks-taskretrycount': '3',
            }
          );
          const response = mockResponse();

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.calledOnce(issueSpy);
        });
        it('rejects a pubsub retry task above the limit', async () => {
          const issueSpy = sandbox.stub();
          const handler = bootstrapper.handler((app: BootstrapperApp) => {
            app.onAny(issueSpy);
          });

          const request = mockRequest(
            {
              installation: {id: 1},
            },
            {
              'x-github-event': 'pubsub.message',
              'x-github-delivery': '123',
              // populated once this job has been executed by cloud tasks:
              'x-cloudtasks-taskname': 'my-task',
              'x-cloudtasks-taskretrycount': '5',
            }
          );
          const response = mockResponse();

          await handler(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.notCalled(issueSpy);
        });
      });
    });

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

    describe('error handling', () => {
      const bootstrapper = new Bootstrapper({
        projectId: 'my-test-project',
        botName: 'my-bot-name',
        botSecrets: {
          appId: '1234',
          privateKey: 'my-private-key',
          webhookSecret: 'foo',
        },
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

    describe('payload caching', () => {
      const payloadCache = new NoopPayloadCache();
      const taskEnqueuer = new NoopTaskEnqueuer();
      const bootstrapper = new Bootstrapper({
        projectId: 'my-test-project',
        botName: 'my-bot-name',
        botSecrets: {
          appId: '1234',
          privateKey: 'my-private-key',
          webhookSecret: 'foo',
        },
        skipVerification: true,
        payloadCache,
        taskEnqueuer,
      });
      it('attempts to store the payload on a webhook trigger', async () => {
        const saveSpy = sandbox.spy(payloadCache, 'save');
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
          }
        );
        const response = mockResponse();

        await handler(request, response);

        sinon.assert.calledWith(response.status, 200);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.calledOnce(saveSpy);
      });
      it('attempts to load the payload on a task trigger', async () => {
        const loadSpy = sandbox.spy(payloadCache, 'load');
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
        sinon.assert.calledOnce(loadSpy);
      });
    });
  });

  describe('server', () => {
    describe('without verification', () => {
      let server: http.Server;
      const taskEnqueuer = new NoopTaskEnqueuer();
      const bootstrapper = new Bootstrapper({
        projectId: 'test-project',
        botName: 'test-bot',
        botSecrets: {
          privateKey: 'some-private-key',
          appId: '1234',
          webhookSecret: 'some-secret',
        },
        skipVerification: true,
        taskEnqueuer,
      });
      let enqueueTaskStub: sinon.SinonStub;
      const issueSpy = sandbox.stub();
      before(done => {
        nock.enableNetConnect(host => {
          return host.startsWith('localhost:');
        });

        server = bootstrapper
          .server(async app => {
            app.on('issues', issueSpy);
          })
          .on('listening', () => {
            done();
          })
          .listen(TEST_SERVER_PORT);
      });
      beforeEach(() => {
        enqueueTaskStub = sandbox.stub(taskEnqueuer, 'enqueueTask');
      });

      afterEach(() => {
        issueSpy.reset();
        enqueueTaskStub.reset();
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
        sinon.assert.notCalled(enqueueTaskStub);
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
        sinon.assert.notCalled(enqueueTaskStub);
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
        sinon.assert.calledOnce(enqueueTaskStub);
        sinon.assert.notCalled(issueSpy);
      });
    });

    describe('with verification', () => {
      let server: http.Server;
      const taskEnqueuer = new NoopTaskEnqueuer();
      const bootstrapper = new Bootstrapper({
        projectId: 'test-project',
        botName: 'test-bot',
        botSecrets: {
          privateKey: 'cert',
          appId: '1234',
          webhookSecret: 'foo',
        },
        taskEnqueuer,
      });
      const issueSpy = sandbox.stub();
      let enqueueTaskStub: sinon.SinonStub;
      before(done => {
        nock.enableNetConnect(host => {
          return host.startsWith('localhost:');
        });

        server = bootstrapper
          .server(async app => {
            app.on('issues', issueSpy);
          })
          .on('listening', () => {
            done();
          })
          .listen(TEST_SERVER_PORT);
      });

      beforeEach(() => {
        enqueueTaskStub = sandbox.stub(taskEnqueuer, 'enqueueTask');
      });

      afterEach(() => {
        issueSpy.reset();
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
        sinon.assert.notCalled(enqueueTaskStub);
        sinon.assert.notCalled(issueSpy);
      });
    });
  });
});
