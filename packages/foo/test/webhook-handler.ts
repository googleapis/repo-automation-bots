import {describe, beforeEach, afterEach, it} from 'mocha';
import sinon from 'sinon';
import nock from 'nock';

import {Webhooks} from '@octokit/webhooks';
import * as express from 'express';
import fs from 'fs';
import {WebhookHandler} from '../src/webhook-handler';
import {NoopTaskEnqueuer} from '../src/background/task-enqueuer';
import {
  InstallationHandler,
  AppInstallation,
  InstalledRepository,
} from '../src/installations';

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

describe('WebhookHandler', () => {
  afterEach(() => {
    sandbox.restore();
  });
  describe('gcf', () => {
    describe('webhooks', async () => {
      const webhookHandler = new WebhookHandler({
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
        const gcf = webhookHandler.gcf((app: Webhooks) => {});
        const request = mockRequest({}, {});
        const response = mockResponse();

        await gcf(request, response);

        sinon.assert.calledWith(response.status, 400);
      });
      it('routes to handler', async () => {
        const issueSpy = sandbox.stub();
        const gcf = webhookHandler.gcf((app: Webhooks) => {
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

        await gcf(request, response);

        sinon.assert.calledWith(response.status, 200);
        sinon.assert.calledOnce(issueSpy);
      });
      it('routes to multiple handlers', async () => {
        const issueSpy = sandbox.stub();
        const issueSpy2 = sandbox.stub();
        const issueOpenedSpy = sandbox.stub();
        const gcf = webhookHandler.gcf((app: Webhooks) => {
          app.on('issues', issueSpy);
          app.on('issues', issueSpy2);
          app.on('issues.opened', issueOpenedSpy);
        });

        const request = mockRequest(
          {
            installation: {id: 1},
            action: "opened",
          },
          {
            'x-github-event': 'issues',
            'x-github-delivery': '123',
            // populated once this job has been executed by cloud tasks:
            'x-cloudtasks-taskname': 'my-task',
          }
        );
        const response = mockResponse();

        await gcf(request, response);

        sinon.assert.calledWith(response.status, 200);
        sinon.assert.calledOnce(issueSpy);
        sinon.assert.calledOnce(issueSpy2);
        sinon.assert.calledOnce(issueOpenedSpy);
      });
    });

    describe('task retries', () => {});

    describe('with signatures', () => {
      it('rejects invalid signatures', async () => {
        const webhookHandler = new WebhookHandler({
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
        const gcf = webhookHandler.gcf((app: Webhooks) => {
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
        await gcf(request, response);

        sinon.assert.calledWith(response.status, 400);
        sinon.assert.notCalled(issueSpy);
      });

      it('handles valid task request signatures', async () => {
        const webhookHandler = new WebhookHandler({
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
        const gcf = webhookHandler.gcf((app: Webhooks) => {
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
        await gcf(request, response);

        sinon.assert.calledWith(response.status, 200);
        sinon.assert.calledOnce(issueSpy);
      });
    });

    describe('cron', () => {
      const installationHandler = new MockInstallationHandler();
      const taskEnqueuer = new NoopTaskEnqueuer();
      const webhookHandler = new WebhookHandler({
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
      const gcf = webhookHandler.gcf((app: Webhooks) => {
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

          await gcf(request, response);

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

          await gcf(request, response);

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

          await gcf(request, response);

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

          await gcf(request, response);

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

          await gcf(request, response);

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

          await gcf(request, response);

          sinon.assert.calledWith(response.status, 200);
          sinon.assert.notCalled(issueSpy);
          sinon.assert.calledOnce(enqueueTaskStub);
        });
      });
    });

    describe('pubsub', () => {});

    describe('error handling', () => {
      it('returns 500 on errors', async () => {

      });

      it('reports to error reporting on finaly retry', async () => {

      });

      it('logs errors for single handler error', async () => {

      });

      it('logs errors for multiple handler errors', async () => {

      })

      it('returns 503 on rate limit errors', async () => {
      });

      it('returns 503 on secondary rate limit errors', async () => {

      });

      it('returns 503 on graphql rate limit errors', async () => {

      });

      it('returns 503 on ServiceUnavailable', async () => {

      });
    });
  });
});
