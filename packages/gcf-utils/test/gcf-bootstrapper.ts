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

import {
  MAX_BODY_SIZE_FOR_CLOUD_TASK,
  DEFAULT_FLOW_CONTROL_DELAY_IN_SECOND,
  GCFBootstrapper,
  WrapOptions,
  logger,
  HandlerFunction,
  RequestWithRawBody,
  getContextLogger,
  ServiceUnavailable,
} from '../src/gcf-utils';
import {describe, beforeEach, afterEach, it} from 'mocha';
import {Octokit} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import {RequestError} from '@octokit/request-error';
// eslint-disable-next-line node/no-extraneous-import
import {GraphqlResponseError} from '@octokit/graphql';
import {Options, ApplicationFunction} from 'probot';
import * as loggerModule from '../src/logging/gcf-logger';
import * as installationsModule from '../src/installations';
import * as express from 'express';
import fs from 'fs';
import sinon from 'sinon';
import nock from 'nock';
import assert from 'assert';
import {RestoreFn} from 'mocked-env';
import mockedEnv from 'mocked-env';

import {v1} from '@google-cloud/secret-manager';
import {GoogleAuth} from 'google-auth-library';
import {GCFLogger} from '../src/logging/gcf-logger';
import {InstalledRepository, AppInstallation} from '../src/installations';

nock.disableNetConnect();

const INSTALLATION_REPOS: InstalledRepository[] = [
  {
    id: 1296268,
    archived: false,
    disabled: false,
    fullName: 'octocat/Hello-World',
  },
  {
    id: 1296269,
    archived: false,
    disabled: false,
    fullName: 'octocat/Goodnight-Moon',
  },
];
const INSTALLATIONS: AppInstallation[] = [
  {
    id: 1,
    targetType: 'Organization',
    login: 'octocat',
    suspended: false,
  },
];
const MANY_INSTALLATIONS: AppInstallation[] = [
  {
    id: 1,
    targetType: 'Organization',
    login: 'octocat',
    suspended: false,
  },
  {
    id: 2,
    targetType: 'Organization',
    login: 'octocat2',
    suspended: false,
  },
];
function mockInstallationRepos(
  sandbox: sinon.SinonSandbox,
  installationRepos: InstalledRepository[]
) {
  async function* fakeGenerator() {
    for (const installationRepo of installationRepos) {
      yield installationRepo;
    }
  }
  return sandbox
    .stub(installationsModule, 'eachInstalledRepository')
    .returns(fakeGenerator());
}

function mockInstallations(
  sandbox: sinon.SinonSandbox,
  installations: AppInstallation[]
) {
  async function* fakeGenerator() {
    for (const installation of installations) {
      yield installation;
    }
  }
  return sandbox
    .stub(installationsModule, 'eachInstallation')
    .returns(fakeGenerator());
}

const sandbox = sinon.createSandbox();

describe('GCFBootstrapper', () => {
  // Save original env varas and restore after each test
  let restoreEnv: RestoreFn | null;
  afterEach(() => {
    sandbox.restore();
    if (restoreEnv) {
      restoreEnv();
      restoreEnv = null;
    }
  });

  describe('configuration', () => {
    it('requires a projectId to be set', () => {
      assert.throws(
        () => {
          new GCFBootstrapper({
            functionName: 'my-function',
            location: 'my-location',
          });
        },
        {
          message: /Missing required `projectId`/,
        }
      );
    });
    it('requires a functionName to be set', () => {
      assert.throws(
        () => {
          new GCFBootstrapper({
            projectId: 'my-project',
            location: 'my-location',
          });
        },
        {
          message: /Missing required `functionName`/,
        }
      );
    });
    it('requires a location to be set', () => {
      assert.throws(
        () => {
          new GCFBootstrapper({
            projectId: 'my-project',
            functionName: 'my-function',
          });
        },
        {
          message: /Missing required `location`/,
        }
      );
    });
    it('can be configured via constructor args', () => {
      const bootstrapper = new GCFBootstrapper({
        projectId: 'my-project',
        functionName: 'my-function',
        location: 'my-location',
      });
      assert.strictEqual(bootstrapper.projectId, 'my-project');
      assert.strictEqual(bootstrapper.functionName, 'my-function');
      assert.strictEqual(bootstrapper.location, 'my-location');
    });
    it('can be configured via environment variables', () => {
      restoreEnv = mockedEnv({
        GCF_SHORT_FUNCTION_NAME: 'fake-function',
        GCF_LOCATION: 'canada1-fake',
        PROJECT_ID: 'fake-project',
      });
      const bootstrapper = new GCFBootstrapper();
      assert.strictEqual(bootstrapper.projectId, 'fake-project');
      assert.strictEqual(bootstrapper.functionName, 'fake-function');
      assert.strictEqual(bootstrapper.location, 'canada1-fake');
    });
  });

  describe('gcf', () => {
    let handler: HandlerFunction;
    let response: express.Response;
    let req: RequestWithRawBody;
    let sendStub: sinon.SinonStub;
    let sendStatusStub: sinon.SinonStub;
    let issueSpy: sinon.SinonStub;
    let repositoryCronSpy: sinon.SinonStub;
    let installationCronSpy: sinon.SinonStub;
    let globalCronSpy: sinon.SinonStub;
    let pubsubSpy: sinon.SinonStub;
    let configStub: sinon.SinonStub<[boolean?], Promise<Options>>;
    let bootstrapper: GCFBootstrapper;
    let enqueueTask: sinon.SinonStub;

    beforeEach(() => {
      // Resource path helper used by tasks requires that the following
      // environment variables exist in the environment:
      restoreEnv = mockedEnv({
        GCF_SHORT_FUNCTION_NAME: 'fake-function',
        GCF_LOCATION: 'canada1-fake',
        PROJECT_ID: 'fake-project',
      });

      // Dup express's global request/response variables to avoid test
      // interaction
      req = Object.create(
        Object.getPrototypeOf(express.request),
        Object.getOwnPropertyDescriptors(express.request)
      );
      req.rawBody = Buffer.from('');
      response = Object.create(
        Object.getPrototypeOf(express.response),
        Object.getOwnPropertyDescriptors(express.response)
      );
      sendStub = sandbox.stub(response, 'send');
      sendStatusStub = sandbox.stub(response, 'sendStatus');
      issueSpy = sandbox.stub();
      repositoryCronSpy = sandbox.stub();
      installationCronSpy = sandbox.stub();
      globalCronSpy = sandbox.stub();
      pubsubSpy = sandbox.stub();
    });

    async function mockBootstrapper(
      wrapOpts?: WrapOptions,
      appFn?: ApplicationFunction
    ) {
      bootstrapper = new GCFBootstrapper();
      configStub = sandbox.stub(bootstrapper, 'getProbotConfig').resolves({
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

      if (!appFn) {
        appFn = async app => {
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
          app.on('err' as any, sandbox.stub().throws());
        };
      }
      handler = bootstrapper.gcf(appFn, wrapOpts);
    }

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
      sinon.assert.calledOnce(issueSpy);
    });

    describe('task retries', () => {
      describe('default wrap options', () => {
        beforeEach(async () => {
          await mockBootstrapper();
          req.body = {
            installation: {id: 1},
          };
          req.headers = {};
          req.headers['x-github-delivery'] = '123';
          req.headers['x-cloudtasks-taskname'] = 'test-bot';
          req.headers['x-cloudtasks-taskretrycount'] = '1';
        });

        it('accepts a retry task', async () => {
          req.headers['x-github-event'] = 'issues';

          await handler(req, response);

          sinon.assert.calledOnce(configStub);
          sinon.assert.notCalled(sendStatusStub);
          sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 200});
          sinon.assert.calledOnce(issueSpy);
        });

        it('does not retry cron task', async () => {
          req.headers['x-github-event'] = 'schedule.repository';

          await handler(req, response);

          sinon.assert.calledOnce(configStub);
          sinon.assert.notCalled(sendStatusStub);
          sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 200});
          sinon.assert.notCalled(repositoryCronSpy);
        });

        it('does not retry pubsub', async () => {
          req.headers['x-github-event'] = 'pubsub.message';

          await handler(req, response);

          sinon.assert.calledOnce(configStub);
          sinon.assert.notCalled(sendStatusStub);
          sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 200});
          sinon.assert.notCalled(pubsubSpy);
        });
      });

      describe('background "false"', () => {
        beforeEach(async () => {
          await mockBootstrapper({
            background: false,
          });
          req.body = {
            installation: {id: 1},
          };
          req.headers = {};
          req.headers['x-github-delivery'] = '123';
          req.headers['x-cloudtasks-taskname'] = 'test-bot';
          req.headers['x-cloudtasks-taskretrycount'] = '1';
        });

        it('does not retry task', async () => {
          req.headers['x-github-event'] = 'issues';

          await handler(req, response);

          sinon.assert.calledOnce(configStub);
          sinon.assert.notCalled(sendStatusStub);
          sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 200});
          sinon.assert.notCalled(issueSpy);
        });

        it('does not retry cron task', async () => {
          req.headers['x-github-event'] = 'schedule.repository';

          await handler(req, response);

          sinon.assert.calledOnce(configStub);
          sinon.assert.notCalled(sendStatusStub);
          sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 200});
          sinon.assert.notCalled(repositoryCronSpy);
        });

        it('does not retry pubsub', async () => {
          req.headers['x-github-event'] = 'pubsub.message';

          await handler(req, response);

          sinon.assert.calledOnce(configStub);
          sinon.assert.notCalled(sendStatusStub);
          sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 200});
          sinon.assert.notCalled(pubsubSpy);
        });
      });

      describe('custom retry settings', () => {
        beforeEach(async () => {
          await mockBootstrapper({
            maxCronRetries: 2,
            maxPubSubRetries: 4,
            maxRetries: 10,
          });
          req.body = {
            installation: {id: 1},
          };
          req.headers = {};
          req.headers['x-github-delivery'] = '123';
          req.headers['x-cloudtasks-taskname'] = 'test-bot';
        });

        it('accepts a retry task below the limit', async () => {
          req.headers['x-github-event'] = 'issues';
          req.headers['x-cloudtasks-taskretrycount'] = '8';

          await handler(req, response);

          sinon.assert.calledOnce(configStub);
          sinon.assert.notCalled(sendStatusStub);
          sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 200});
          sinon.assert.calledOnce(issueSpy);
        });

        it('rejects a retry task above the limit', async () => {
          req.headers['x-github-event'] = 'issues';
          req.headers['x-cloudtasks-taskretrycount'] = '11';

          await handler(req, response);

          sinon.assert.calledOnce(configStub);
          sinon.assert.notCalled(sendStatusStub);
          sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 200});
          sinon.assert.notCalled(issueSpy);
        });

        it('accepts a retry task cron task below the limit', async () => {
          req.headers['x-github-event'] = 'schedule.repository';
          req.headers['x-cloudtasks-taskretrycount'] = '2';

          await handler(req, response);

          sinon.assert.calledOnce(configStub);
          sinon.assert.notCalled(sendStatusStub);
          sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 200});
          sinon.assert.calledOnce(repositoryCronSpy);
        });

        it('rejects a retry task cron task above the limit', async () => {
          req.headers['x-github-event'] = 'schedule.repository';
          req.headers['x-cloudtasks-taskretrycount'] = '3';

          await handler(req, response);

          sinon.assert.calledOnce(configStub);
          sinon.assert.notCalled(sendStatusStub);
          sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 200});
          sinon.assert.notCalled(repositoryCronSpy);
        });

        it('accepts a retry task pubsub task below the limit', async () => {
          req.headers['x-github-event'] = 'pubsub.message';
          req.headers['x-cloudtasks-taskretrycount'] = '3';

          await handler(req, response);

          sinon.assert.calledOnce(configStub);
          sinon.assert.notCalled(sendStatusStub);
          sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 200});
          sinon.assert.calledOnce(pubsubSpy);
        });

        it('rejects a retry task pubsub task above the limit', async () => {
          req.headers['x-github-event'] = 'pubsub.message';
          req.headers['x-cloudtasks-taskretrycount'] = '5';

          await handler(req, response);

          sinon.assert.calledOnce(configStub);
          sinon.assert.notCalled(sendStatusStub);
          sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 200});
          sinon.assert.notCalled(pubsubSpy);
        });
      });
    });

    it('does nothing if there are missing headers', async () => {
      await mockBootstrapper();
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};

      await handler(req, response);

      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(issueSpy);
      sinon.assert.notCalled(repositoryCronSpy);
      sinon.assert.notCalled(installationCronSpy);
      sinon.assert.notCalled(globalCronSpy);
      sinon.assert.calledWith(sendStatusStub, 400);
    });

    it('returns 500 on errors', async () => {
      await mockBootstrapper();
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'err';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = 'my-task';

      await handler(req, response);

      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(issueSpy);
      sinon.assert.notCalled(repositoryCronSpy);
      sinon.assert.notCalled(installationCronSpy);
      sinon.assert.notCalled(globalCronSpy);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.called(sendStub);
      assert.strictEqual(response.statusCode, 500);
    });

    it('reports to error reporting on final retry', async () => {
      const errorStub = sandbox.stub(GCFLogger.prototype, 'error');
      const childSpy = sandbox.spy(GCFLogger.prototype, 'child');
      const fakeLogger = new GCFLogger();
      sandbox.stub(loggerModule, 'buildRequestLogger').returns(fakeLogger);
      await mockBootstrapper(undefined, async app => {
        app.on('issues', async () => {
          throw new SyntaxError('Some error message');
        });
      });
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'issues';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = 'my-task';
      req.headers['x-cloudtasks-taskretrycount'] = '10';

      await handler(req, response);

      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(issueSpy);
      sinon.assert.notCalled(repositoryCronSpy);
      sinon.assert.notCalled(installationCronSpy);
      sinon.assert.notCalled(globalCronSpy);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.called(sendStub);

      sinon.assert.calledOnce(childSpy);
      sinon.assert.calledWith(
        childSpy,
        sinon.match({
          '@type':
            'type.googleapis.com/google.devtools.clouderrorreporting.v1beta1.ReportedErrorEvent',
        })
      );
      sinon.assert.calledOnce(errorStub);
      sinon.assert.calledWith(errorStub, sinon.match.instanceOf(SyntaxError));
    });

    it('logs errors for single handler errors', async () => {
      const errorStub = sandbox.stub(GCFLogger.prototype, 'error');
      const childSpy = sandbox.spy(GCFLogger.prototype, 'child');
      const fakeLogger = new GCFLogger();
      sandbox.stub(loggerModule, 'buildRequestLogger').returns(fakeLogger);
      await mockBootstrapper(undefined, async app => {
        app.on('issues', async () => {
          throw new SyntaxError('Some error message');
        });
      });
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'issues';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = 'my-task';

      await handler(req, response);

      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(issueSpy);
      sinon.assert.notCalled(repositoryCronSpy);
      sinon.assert.notCalled(installationCronSpy);
      sinon.assert.notCalled(globalCronSpy);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.called(sendStub);

      sinon.assert.notCalled(childSpy);
      sinon.assert.calledOnce(errorStub);
      sinon.assert.calledWith(errorStub, sinon.match.instanceOf(SyntaxError));
    });

    it('logs errors for multiple handler errors', async () => {
      const errorStub = sandbox.stub(GCFLogger.prototype, 'error');
      const fakeLogger = new GCFLogger();
      sandbox.stub(loggerModule, 'buildRequestLogger').returns(fakeLogger);
      await mockBootstrapper(undefined, async app => {
        app.on('issues', async () => {
          throw new SyntaxError('Some error message');
        });
        app.on('issues', async () => {
          throw new Error('Another error message');
        });
      });
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'issues';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = 'my-task';

      await handler(req, response);

      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(issueSpy);
      sinon.assert.notCalled(repositoryCronSpy);
      sinon.assert.notCalled(installationCronSpy);
      sinon.assert.notCalled(globalCronSpy);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.called(sendStub);

      sinon.assert.calledTwice(errorStub);
      sinon.assert.calledWith(errorStub, sinon.match.instanceOf(SyntaxError));
      sinon.assert.calledWith(errorStub, sinon.match.instanceOf(Error));
    });

    it('returns 503 on rate limit errors', async () => {
      await mockBootstrapper(undefined, async app => {
        app.on('issues', async () => {
          throw new RequestError(
            'API rate limit exceeded for user ID 3456',
            403,
            {
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
            }
          );
        });
      });
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'issues';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = 'my-task';

      await handler(req, response);

      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(issueSpy);
      sinon.assert.notCalled(repositoryCronSpy);
      sinon.assert.notCalled(installationCronSpy);
      sinon.assert.notCalled(globalCronSpy);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.called(sendStub);

      assert.strictEqual(response.statusCode, 503);
    });

    it('returns 503 on secondary rate limit errors', async () => {
      await mockBootstrapper(undefined, async app => {
        app.on('issues', async () => {
          throw new RequestError(
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
          );
        });
      });
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'issues';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = 'my-task';

      await handler(req, response);

      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(issueSpy);
      sinon.assert.notCalled(repositoryCronSpy);
      sinon.assert.notCalled(installationCronSpy);
      sinon.assert.notCalled(globalCronSpy);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.called(sendStub);

      assert.strictEqual(response.statusCode, 503);
    });

    it('returns 503 on graphql rate limit errors', async () => {
      await mockBootstrapper(undefined, async app => {
        app.on('issues', async () => {
          throw new GraphqlResponseError(
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
          );
        });
      });
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'issues';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = 'my-task';

      await handler(req, response);

      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(issueSpy);
      sinon.assert.notCalled(repositoryCronSpy);
      sinon.assert.notCalled(installationCronSpy);
      sinon.assert.notCalled(globalCronSpy);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.called(sendStub);

      assert.strictEqual(response.statusCode, 503);
    });

    it('returns 503 on ServiceUnavailable', async () => {
      await mockBootstrapper(undefined, async app => {
        app.on('issues', async () => {
          throw new ServiceUnavailable('', new Error('An error happened'));
        });
      });
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'issues';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = 'my-task';

      await handler(req, response);

      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(issueSpy);
      sinon.assert.notCalled(repositoryCronSpy);
      sinon.assert.notCalled(installationCronSpy);
      sinon.assert.notCalled(globalCronSpy);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.called(sendStub);

      assert.strictEqual(response.statusCode, 503);
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
      sinon.assert.notCalled(issueSpy);
      sinon.assert.notCalled(repositoryCronSpy);
      sinon.assert.notCalled(installationCronSpy);
      sinon.assert.notCalled(globalCronSpy);
    });

    it('ensures that task is enqueued when called by scheduler for a bot opt out from background execution', async () => {
      await mockBootstrapper({
        background: false,
        logging: true,
      });
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
      sinon.assert.notCalled(issueSpy);
      sinon.assert.notCalled(repositoryCronSpy);
      sinon.assert.notCalled(installationCronSpy);
      sinon.assert.notCalled(globalCronSpy);
    });

    describe('with WEBHOOK_TMP set', () => {
      beforeEach(() => {
        restoreEnv = mockedEnv({
          GCF_SHORT_FUNCTION_NAME: 'fake-function',
          GCF_LOCATION: 'canada1-fake',
          PROJECT_ID: 'fake-project',
          WEBHOOK_TMP: '/tmp/foo',
        });
        nock('https://oauth2.googleapis.com')
          .post('/token')
          .reply(200, {access_token: 'abc123'});
      });

      it('does not store task payload in Cloud Storage even if WEBHOOK_TMP set when the body is small enough', async () => {
        await mockBootstrapper();
        req.body = {
          installation: {id: 1},
          repo: 'myRepo',
        };
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.repository';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = '';

        await handler(req, response);

        sinon.assert.calledOnce(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
      });

      it('stores task payload in Cloud Storage if WEBHOOK_TMP set and the body size is big', async () => {
        await mockBootstrapper();
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
          repo: 'x'.repeat(MAX_BODY_SIZE_FOR_CLOUD_TASK),
        };
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.repository';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = '';

        await handler(req, response);

        // We should be attempting to write req.body to Cloud Storage:
        assert.strictEqual(uploaded?.installation?.id, 1);
        sinon.assert.calledOnce(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
        upload.done();
      });

      it('fetches payload from Cloud Storage, if tmpUrl in payload', async () => {
        await mockBootstrapper();
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

        sinon.assert.calledOnce(configStub);
        sinon.assert.notCalled(sendStatusStub);
        sinon.assert.calledOnce(sendStub);
        sinon.assert.calledOnce(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
        downloaded.done();
      });

      it('does not retry the task, if tmpUrl in payload cannot be found (expired)', async () => {
        await mockBootstrapper();
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
          .get('/storage/v1/b/tmp/foo/o/%2Fbucket%2Ffoo?alt=media')
          .reply(404);

        await handler(req, response);

        sinon.assert.calledOnce(configStub);
        sinon.assert.notCalled(sendStatusStub);
        sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 200});
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
        downloaded.done();
      });

      it('retries the task, if tmpUrl in payload cannot be fetched for other reason', async () => {
        await mockBootstrapper();
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
          .get('/storage/v1/b/tmp/foo/o/%2Fbucket%2Ffoo?alt=media')
          .reply(500);

        await handler(req, response);

        sinon.assert.calledOnce(configStub);
        sinon.assert.notCalled(sendStatusStub);
        sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 500});
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
        downloaded.done();
      });
    });

    describe('per-repository cron', () => {
      it('ensures that task is enqueued when called by scheduler for many repos', async () => {
        await mockBootstrapper();
        req.body = {
          installation: {id: 1},
        };
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.repository';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = '';
        mockInstallationRepos(sandbox, INSTALLATION_REPOS);

        await handler(req, response);

        sinon.assert.calledTwice(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
      });

      it('ensures that task is enqueued with flow control when called by scheduler for many repos', async () => {
        await mockBootstrapper();
        req.body = {
          installation: {id: 1},
        };
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.repository';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = '';

        const manyInstallationRepos: InstalledRepository[] = Array.from(
          Array(31).keys()
        ).map(i => {
          return {
            id: i,
            fullName: `octokit/repo${i}`,
            archived: false,
            disabled: false,
          };
        });
        const listInstallationStub = mockInstallationRepos(
          sandbox,
          manyInstallationRepos
        );

        await handler(req, response);

        const enqueueTaskCalls = enqueueTask.getCalls();
        // We add delay for every 30 batch
        assert(enqueueTaskCalls.length === 31);
        const firstTask = enqueueTask.getCall(0).args[0];
        const lastTask = enqueueTask.getCall(30).args[0];
        const firstScheduleTime = firstTask.task.scheduleTime.seconds;
        const lastScheduleTime = lastTask.task.scheduleTime.seconds;
        assert(
          lastScheduleTime - firstScheduleTime >
            DEFAULT_FLOW_CONTROL_DELAY_IN_SECOND
        );
        assert(
          lastScheduleTime - firstScheduleTime <
            DEFAULT_FLOW_CONTROL_DELAY_IN_SECOND + 1
        );
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
        sinon.assert.calledOnce(listInstallationStub);
      });

      it('accepts a custom flow control delay', async () => {
        const customDelay = 120;
        await mockBootstrapper({
          flowControlDelayInSeconds: customDelay,
        });
        req.body = {
          installation: {id: 1},
        };
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.repository';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = '';

        const manyInstallationRepos: InstalledRepository[] = Array.from(
          Array(31).keys()
        ).map(i => {
          return {
            id: i,
            fullName: `octokit/repo${i}`,
            archived: false,
            disabled: false,
          };
        });
        const listInstallationStub = mockInstallationRepos(
          sandbox,
          manyInstallationRepos
        );

        await handler(req, response);

        const enqueueTaskCalls = enqueueTask.getCalls();
        // We add delay for every 30 batch
        assert(enqueueTaskCalls.length === 31);
        const firstTask = enqueueTask.getCall(0).args[0];
        const lastTask = enqueueTask.getCall(30).args[0];
        const firstScheduleTime = firstTask.task.scheduleTime.seconds;
        const lastScheduleTime = lastTask.task.scheduleTime.seconds;
        assert(lastScheduleTime - firstScheduleTime > customDelay);
        assert(lastScheduleTime - firstScheduleTime < customDelay + 1);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
        sinon.assert.calledOnce(listInstallationStub);
      });

      it('ensures that task is enqueued when called by scheduler for many installations', async () => {
        await mockBootstrapper();
        req.body = {};
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.repository';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = '';
        const listInstallationsStub = mockInstallations(sandbox, INSTALLATIONS);
        const listInstallationReposStub = mockInstallationRepos(
          sandbox,
          INSTALLATION_REPOS
        );

        await handler(req, response);

        sinon.assert.calledTwice(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
        sinon.assert.calledOnce(listInstallationsStub);
        sinon.assert.calledOnce(listInstallationReposStub);
      });

      it('skips suspended installations', async () => {
        await mockBootstrapper();
        req.body = {};
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.repository';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = '';
        const listInstallationStub = mockInstallations(sandbox, [
          {id: 1, targetType: 'Organization', suspended: true, login: 'my-org'},
        ]);

        await handler(req, response);

        sinon.assert.notCalled(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
        sinon.assert.calledOnce(listInstallationStub);
      });

      it('skips organizations which are not allowed', async () => {
        await mockBootstrapper();
        req.body = {
          allowed_organizations: ['googleapis'],
        };
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.repository';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = '';

        const listInstallationStub = mockInstallations(sandbox, [
          {
            id: 1,
            targetType: 'Organization',
            login: 'octocat',
            suspended: false,
          },
        ]);

        await handler(req, response);

        sinon.assert.notCalled(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
        sinon.assert.calledOnce(listInstallationStub);
      });

      it('handles the schedule.repository task', async () => {
        await mockBootstrapper();
        req.body = {
          repo: 'test-owner/test-repo',
          installation: {id: 1},
          cron_type: 'repository',
          cron_org: 'some-cron-org',
        };
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.repository';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = 'test-function';

        await handler(req, response);

        sinon.assert.notCalled(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.calledOnce(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
      });
    });

    describe('per-installation cron', () => {
      it('ensures that task is enqueued when called by scheduler', async () => {
        await mockBootstrapper();
        req.body = {
          cron_type: 'installation',
        };
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.repository';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = '';

        const listInstallationStub = mockInstallations(sandbox, INSTALLATIONS);

        await handler(req, response);

        sinon.assert.calledOnce(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
        sinon.assert.calledOnce(listInstallationStub);
      });

      it('ensures that task is enqueued when called by scheduler for many installations', async () => {
        await mockBootstrapper();
        req.body = {
          cron_type: 'installation',
        };
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.repository';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = '';
        // sandbox.stub(installationModule, 'eachInstallation')
        const listInstallationStub = mockInstallations(
          sandbox,
          MANY_INSTALLATIONS
        );

        await handler(req, response);

        sinon.assert.calledTwice(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
        sinon.assert.calledOnce(listInstallationStub);
      });

      it('ensures that task is enqueued when called by scheduler with an installation id', async () => {
        await mockBootstrapper();
        req.body = {
          cron_type: 'installation',
          installation: {
            id: 1,
          },
        };
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.repository';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = '';

        await handler(req, response);

        sinon.assert.calledOnce(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
      });

      it('handles the schedule.installation task', async () => {
        await mockBootstrapper();
        req.body = {
          installation: {id: 1},
          cron_type: 'installation',
          cron_org: 'some-cron-org',
        };
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.installation';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = 'test-function';

        await handler(req, response);

        sinon.assert.notCalled(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.calledOnce(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
      });
    });

    describe('global cron', () => {
      it('enqueues a single task for global scheduled task', async () => {
        await mockBootstrapper();
        req.body = {
          cron_type: 'global',
        };
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.repository';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = '';
        await handler(req, response);
        sinon.assert.calledOnce(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
      });

      it('handles the schedule.global task', async () => {
        await mockBootstrapper();
        req.body = {
          cron_type: 'global',
        };
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.global';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = 'test-function';

        await handler(req, response);

        sinon.assert.notCalled(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.calledOnce(globalCronSpy);
      });
    });

    it('ensures that task is enqueued when called by Github', async () => {
      await mockBootstrapper();
      req.body = {
        installation: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'another.name';
      req.headers['x-github-delivery'] = '123';

      await handler(req, response);

      sinon.assert.calledOnce(enqueueTask);
    });

    describe('logger', () => {
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
          trigger: {
            trigger_type: 'Cloud Task',
            github_delivery_guid: '123',
            github_event_type: 'issues',
            payload_hash: '99914b932bd37a50b983c5e7c90ae93b',
            trigger_sender: 'UNKNOWN',
            trigger_source_repo: {
              owner: 'UNKNOWN',
              owner_type: 'UNKNOWN',
              repo_name: 'UNKNOWN',
              url: 'UNKNOWN',
            },
          },
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
          trigger: {
            trigger_type: 'Cloud Task',
            github_delivery_guid: '123',
            github_event_type: 'issues',
            payload_hash: '99914b932bd37a50b983c5e7c90ae93b',
            trigger_sender: 'UNKNOWN',
            trigger_source_repo: {
              owner: 'UNKNOWN',
              owner_type: 'UNKNOWN',
              repo_name: 'UNKNOWN',
              url: 'UNKNOWN',
            },
          },
        };

        await mockBootstrapper();

        await handler(req, response);
        assert.deepEqual(logger.getBindings(), expectedBindings);

        await handler(req, response);
        assert.deepEqual(logger.getBindings(), expectedBindings);
      });

      it('injects a request logger on each call', async () => {
        req.body = {
          installation: {id: 1},
        };
        req.headers = {};
        req.headers['x-github-event'] = 'issues';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = 'my-task';

        const expectedBindings = {
          trigger: {
            trigger_type: 'Cloud Task',
            github_delivery_guid: '123',
            github_event_type: 'issues',
            payload_hash: '99914b932bd37a50b983c5e7c90ae93b',
            trigger_sender: 'UNKNOWN',
            trigger_source_repo: {
              owner: 'UNKNOWN',
              owner_type: 'UNKNOWN',
              repo_name: 'UNKNOWN',
              url: 'UNKNOWN',
            },
          },
        };

        let requestLogger: GCFLogger | undefined;
        await mockBootstrapper(undefined, async app => {
          app.on('issues', context => {
            requestLogger = getContextLogger(context);
          });
        });

        await handler(req, response);
        assert.ok(requestLogger);
        assert.deepEqual(requestLogger.getBindings(), expectedBindings);
      });

      it('injects the cloud trace id each call', async () => {
        req.body = {
          installation: {id: 1},
        };
        req.headers = {};
        req.headers['x-github-event'] = 'issues';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = 'my-task';
        req.headers['x-cloud-trace-context'] = 'abc123/def234;o=1';

        const expectedBindings = {
          trigger: {
            trigger_type: 'Cloud Task',
            github_delivery_guid: '123',
            github_event_type: 'issues',
            payload_hash: '99914b932bd37a50b983c5e7c90ae93b',
            trigger_sender: 'UNKNOWN',
            trigger_source_repo: {
              owner: 'UNKNOWN',
              owner_type: 'UNKNOWN',
              repo_name: 'UNKNOWN',
              url: 'UNKNOWN',
            },
          },
          'logging.googleapis.com/trace': 'projects/fake-project/traces/abc123',
        };

        let requestLogger: GCFLogger | undefined;
        await mockBootstrapper(undefined, async app => {
          app.on('issues', context => {
            requestLogger = getContextLogger(context);
          });
        });

        await handler(req, response);
        assert.ok(requestLogger);
        assert.deepEqual(requestLogger.getBindings(), expectedBindings);
      });

      it('pulls trigger information from the payload', async () => {
        // set WEBHOOK_TMP, reset in root afterEach
        restoreEnv = mockedEnv({
          GCF_SHORT_FUNCTION_NAME: 'fake-function',
          GCF_LOCATION: 'canada1-fake',
          PROJECT_ID: 'fake-project',
          WEBHOOK_TMP: '/tmp/foo',
        });
        req.body = {
          installation: {id: 1},
          tmpUrl: '/bucket/foo',
        };
        req.headers = {};
        req.headers['x-github-event'] = 'issues';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = 'my-task';

        // Fake download from Cloud Storage, again with the goal of ensuring
        // we're using the streams API appropriately:
        const downloaded = nock('https://storage.googleapis.com')
          .get('/storage/v1/b/tmp/foo/o/%2Fbucket%2Ffoo?alt=media')
          .reply(
            200,
            JSON.stringify({
              installation: {
                id: 1,
              },
              action: 'opened',
              repository: {
                name: 'repo-automation-bots',
                owner: {
                  login: 'googleapis',
                  type: 'Organization',
                },
              },
              sender: {
                login: 'some-user',
              },
            })
          );

        const expectedBindings = {
          trigger: {
            trigger_type: 'Cloud Task',
            github_delivery_guid: '123',
            github_event_type: 'issues.opened',
            payload_hash: '6708eafce0a59031b1fcd4f568a2e0cc',
            trigger_sender: 'some-user',
            trigger_source_repo: {
              owner: 'googleapis',
              owner_type: 'Organization',
              repo_name: 'repo-automation-bots',
              url: 'https://github.com/googleapis/repo-automation-bots',
            },
          },
        };

        let requestLogger: GCFLogger;
        await mockBootstrapper(undefined, async app => {
          app.on('issues', context => {
            requestLogger = getContextLogger(context);
          });
        });

        await handler(req, response);
        assert.ok(requestLogger);
        assert.deepEqual(requestLogger.getBindings(), expectedBindings);

        downloaded.done();
      });
    });

    describe('verification', () => {
      it('rejects unsigned non-task requests with 400', async () => {
        await mockBootstrapper({
          logging: false,
          background: true,
          skipVerification: false,
        });
        // req.body is a parsed json object.
        req.body = {
          installation: {id: 1},
        };
        // while req.rawBody is a raw buffer
        req.rawBody = fs.readFileSync('test/fixtures/payload.json');
        req.headers = {};
        req.headers['x-github-event'] = 'issues';
        req.headers['x-github-delivery'] = '123';

        await handler(req, response);

        sinon.assert.calledOnce(configStub);
        sinon.assert.notCalled(sendStatusStub);
        sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 400});
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
      });

      it('handles valid task request signatures', async () => {
        await mockBootstrapper({
          logging: false,
          background: true,
          skipVerification: false,
        });
        // req.body is a parsed json object.
        req.body = {
          installation: {id: 1},
        };
        // while req.rawBody is a raw buffer
        req.rawBody = fs.readFileSync('test/fixtures/payload.json');
        req.headers = {};
        req.headers['x-github-event'] = 'issues';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = 'my-task';
        // cat fixtures/payload.json | openssl dgst -sha1 -hmac "foo"
        req.headers['x-hub-signature'] =
          'sha1=fd28a625d68ef18fe9b532fd972514774fed9653';

        await handler(req, response);

        sinon.assert.calledOnce(configStub);
        sinon.assert.notCalled(sendStatusStub);
        sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 200});
        sinon.assert.calledOnce(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
      });
    });
  });

  describe('loadProbot', () => {
    let bootstrapper: GCFBootstrapper;
    let configStub: sinon.SinonStub<[boolean?], Promise<Options>>;

    beforeEach(() => {
      bootstrapper = new GCFBootstrapper({
        projectId: 'my-project',
        functionName: 'my-function',
        location: 'my-location',
      });
      configStub = sandbox.stub(bootstrapper, 'getProbotConfig').resolves({
        appId: 1234,
        secret: 'foo',
        privateKey: 'cert',
      });
    });

    it('gets the config', async () => {
      await bootstrapper.loadProbot(async () => {
        // Do nothing
      });
      console.log(configStub);
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

    beforeEach(() => {
      secretClientStub = new v1.SecretManagerServiceClient();
      bootstrapper = new GCFBootstrapper({
        projectId: 'my-project',
        functionName: 'my-function',
        location: 'my-location',
        secretsClient: secretClientStub,
      });
    });

    afterEach(() => {
      sandbox.restore();
    });

    it('gets the config', async () => {
      secretsStub = sandbox
        .stub(secretClientStub, 'accessSecretVersion')
        .resolves([
          {
            payload: {
              data: JSON.stringify({
                id: 1234,
                secret: 'foo',
              }),
            },
          },
        ]);
      await bootstrapper.getProbotConfig();
      sinon.assert.calledOnce(secretsStub);
      sinon.assert.calledOnceWithExactly(secretsStub, {
        name: 'projects/my-project/secrets/my-function/versions/latest',
      });
    });

    it('throws on empty data', async () => {
      secretsStub = sandbox
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
      secretsStub = sandbox
        .stub(secretClientStub, 'accessSecretVersion')
        .resolves([
          {
            payload: {},
          },
        ]);

      assert.rejects(bootstrapper.getProbotConfig());
    });

    it('throws on empty response', async () => {
      secretsStub = sandbox
        .stub(secretClientStub, 'accessSecretVersion')
        .resolves([{}]);

      assert.rejects(bootstrapper.getProbotConfig());
    });
  });

  describe('getAuthenticatedOctokit', () => {
    beforeEach(() => {
      // Resource path helper used by tasks requires that the following
      // environment variables exist in the environment:
      restoreEnv = mockedEnv({
        GCF_SHORT_FUNCTION_NAME: 'fake-function',
        GCF_LOCATION: 'canada1-fake',
        PROJECT_ID: 'fake-project',
      });
    });
    it('can return an Octokit instance given an installation id', async () => {
      const bootstrapper = new GCFBootstrapper();
      const configStub = sandbox
        .stub(bootstrapper, 'getProbotConfig')
        .resolves({
          appId: 1234,
          secret: 'foo',
          privateKey: 'cert',
        });
      const octokit = await bootstrapper.getAuthenticatedOctokit(1234);
      assert.ok(octokit);
      sinon.assert.calledOnce(configStub);
    });

    it('can return an Octokit instance without an installation id', async () => {
      const bootstrapper = new GCFBootstrapper();
      const configStub = sandbox
        .stub(bootstrapper, 'getProbotConfig')
        .resolves({
          appId: 1234,
          secret: 'foo',
          privateKey: 'cert',
        });
      const octokit = await bootstrapper.getAuthenticatedOctokit(undefined);
      assert.ok(octokit);
      sinon.assert.calledOnce(configStub);
    });
  });

  describe('enqueueTask', () => {
    beforeEach(() => {
      nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, {access_token: 'abc123'});
    });

    it('queues a GCF URL', async () => {
      const bootstrapper = new GCFBootstrapper({
        projectId: 'my-project',
        functionName: 'my-function-name',
        location: 'my-location',
      });
      const createTask = sandbox
        .stub(bootstrapper.cloudTasksClient, 'createTask')
        .resolves();
      await bootstrapper.enqueueTask({
        body: JSON.stringify({installation: {id: 1}}),
        id: 'some-request-id',
        name: 'event.name',
      });
      // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/36436
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sinon.assert.calledOnceWithMatch(createTask as any, {
        parent:
          'projects/my-project/locations/my-location/queues/my-function-name',
        task: {
          httpRequest: {
            httpMethod: 'POST',
            headers: sinon.match({
              'X-GitHub-Event': 'event.name',
              'X-GitHub-Delivery': 'some-request-id',
              'Content-Type': 'application/json',
            }),
            url: 'https://my-location-my-project.cloudfunctions.net/my-function-name',
          },
        },
      });
    });

    it('queues a GCF URL detected from environment', async () => {
      restoreEnv = mockedEnv({
        BOT_RUNTIME: 'functions',
      });
      const bootstrapper = new GCFBootstrapper({
        projectId: 'my-project',
        functionName: 'my-function-name',
        location: 'my-location',
      });
      const createTask = sandbox
        .stub(bootstrapper.cloudTasksClient, 'createTask')
        .resolves();
      await bootstrapper.enqueueTask({
        body: JSON.stringify({installation: {id: 1}}),
        id: 'some-request-id',
        name: 'event.name',
      });
      // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/36436
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sinon.assert.calledOnceWithMatch(createTask as any, {
        parent:
          'projects/my-project/locations/my-location/queues/my-function-name',
        task: {
          httpRequest: {
            httpMethod: 'POST',
            headers: sinon.match({
              'X-GitHub-Event': 'event.name',
              'X-GitHub-Delivery': 'some-request-id',
              'Content-Type': 'application/json',
            }),
            url: 'https://my-location-my-project.cloudfunctions.net/my-function-name',
          },
        },
      });
    });

    it('queues a GCF URL with underscored bot name', async () => {
      const bootstrapper = new GCFBootstrapper({
        projectId: 'my-project',
        functionName: 'my_function_name',
        location: 'my-location',
      });
      const createTask = sandbox
        .stub(bootstrapper.cloudTasksClient, 'createTask')
        .resolves();
      await bootstrapper.enqueueTask({
        body: JSON.stringify({installation: {id: 1}}),
        id: 'some-request-id',
        name: 'event.name',
      });
      // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/36436
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sinon.assert.calledOnceWithMatch(createTask as any, {
        parent:
          'projects/my-project/locations/my-location/queues/my-function-name',
        task: {
          httpRequest: {
            httpMethod: 'POST',
            headers: sinon.match({
              'X-GitHub-Event': 'event.name',
              'X-GitHub-Delivery': 'some-request-id',
              'Content-Type': 'application/json',
            }),
            url: 'https://my-location-my-project.cloudfunctions.net/my_function_name',
          },
        },
      });
    });

    it('queues a Cloud Run URL with caching', async () => {
      const bootstrapper = new GCFBootstrapper({
        projectId: 'my-project',
        functionName: 'my-function-name',
        location: 'my-location',
        taskTargetEnvironment: 'run',
      });
      const createTask = sandbox
        .stub(bootstrapper.cloudTasksClient, 'createTask')
        .resolves();
      const getServiceStub = sandbox
        .stub(bootstrapper.cloudRunClient, 'getService')
        .resolves([{uri: 'http://some.domain/path'}]);
      await bootstrapper.enqueueTask({
        body: JSON.stringify({installation: {id: 1}}),
        id: 'some-request-id',
        name: 'event.name',
      });
      // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/36436
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sinon.assert.calledOnceWithMatch(createTask as any, {
        parent:
          'projects/my-project/locations/my-location/queues/my-function-name',
        task: {
          httpRequest: {
            httpMethod: 'POST',
            headers: sinon.match({
              'X-GitHub-Event': 'event.name',
              'X-GitHub-Delivery': 'some-request-id',
              'Content-Type': 'application/json',
            }),
            url: 'http://some.domain/path',
          },
        },
      });
      // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/36436
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sinon.assert.calledOnceWithExactly(getServiceStub as any, {
        name: 'projects/my-project/locations/my-location/services/my-function-name',
      });
      // Make sure the Cloud Run service URL is cached.
      await bootstrapper.enqueueTask({
        body: JSON.stringify({installation: {id: 1}}),
        id: 'some-request-id',
        name: 'event.name',
      });
      const getServiceCalls = getServiceStub.getCalls();
      assert.equal(getServiceCalls.length, 1);
      const createTaskCalls = createTask.getCalls();
      assert.equal(createTaskCalls.length, 2);
    });

    it('queues a Cloud Run URL with underscored bot name', async () => {
      const bootstrapper = new GCFBootstrapper({
        projectId: 'my-project',
        functionName: 'my_function_name',
        location: 'my-location',
        taskTargetEnvironment: 'run',
      });
      const createTask = sandbox
        .stub(bootstrapper.cloudTasksClient, 'createTask')
        .resolves();
      const getServiceStub = sandbox
        .stub(bootstrapper.cloudRunClient, 'getService')
        .resolves([{uri: 'http://some.domain/path'}]);
      await bootstrapper.enqueueTask({
        body: JSON.stringify({installation: {id: 1}}),
        id: 'some-request-id',
        name: 'event.name',
      });
      // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/36436
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sinon.assert.calledOnceWithMatch(createTask as any, {
        parent:
          'projects/my-project/locations/my-location/queues/my-function-name',
        task: {
          httpRequest: {
            httpMethod: 'POST',
            headers: sinon.match({
              'X-GitHub-Event': 'event.name',
              'X-GitHub-Delivery': 'some-request-id',
              'Content-Type': 'application/json',
            }),
            url: 'http://some.domain/path',
          },
        },
      });
      // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/36436
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sinon.assert.calledOnceWithExactly(getServiceStub as any, {
        name: 'projects/my-project/locations/my-location/services/my-function-name',
      });
    });

    it('queues a Cloud Run URL detected from environment', async () => {
      restoreEnv = mockedEnv({
        BOT_RUNTIME: 'run',
      });
      const bootstrapper = new GCFBootstrapper({
        projectId: 'my-project',
        functionName: 'my-function-name',
        location: 'my-location',
      });
      const createTask = sandbox
        .stub(bootstrapper.cloudTasksClient, 'createTask')
        .resolves();
      const getServiceStub = sandbox
        .stub(bootstrapper.cloudRunClient, 'getService')
        .resolves([{uri: 'http://some.domain/path'}]);
      await bootstrapper.enqueueTask({
        body: JSON.stringify({installation: {id: 1}}),
        id: 'some-request-id',
        name: 'event.name',
      });
      // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/36436
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sinon.assert.calledOnceWithMatch(createTask as any, {
        parent:
          'projects/my-project/locations/my-location/queues/my-function-name',
        task: {
          httpRequest: {
            httpMethod: 'POST',
            headers: sinon.match({
              'X-GitHub-Event': 'event.name',
              'X-GitHub-Delivery': 'some-request-id',
              'Content-Type': 'application/json',
            }),
            url: 'http://some.domain/path',
          },
        },
      });
      // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/36436
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sinon.assert.calledOnceWithExactly(getServiceStub as any, {
        name: 'projects/my-project/locations/my-location/services/my-function-name',
      });
    });

    it('allows overriding the backend GCF bot name', async () => {
      const bootstrapper = new GCFBootstrapper({
        projectId: 'my-project',
        functionName: 'my-function-name',
        location: 'my-location',
        taskTargetName: 'my-function-name-backend',
      });
      const createTask = sandbox
        .stub(bootstrapper.cloudTasksClient, 'createTask')
        .resolves();
      await bootstrapper.enqueueTask({
        body: JSON.stringify({installation: {id: 1}}),
        id: 'some-request-id',
        name: 'event.name',
      });
      // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/36436
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sinon.assert.calledOnceWithMatch(createTask as any, {
        parent:
          'projects/my-project/locations/my-location/queues/my-function-name',
        task: {
          httpRequest: {
            httpMethod: 'POST',
            headers: sinon.match({
              'X-GitHub-Event': 'event.name',
              'X-GitHub-Delivery': 'some-request-id',
              'Content-Type': 'application/json',
            }),
            url: 'https://my-location-my-project.cloudfunctions.net/my-function-name-backend',
          },
        },
      });
    });

    it('allows overriding the backend Cloud Run bot name', async () => {
      const bootstrapper = new GCFBootstrapper({
        projectId: 'my-project',
        functionName: 'my-function-name',
        location: 'my-location',
        taskTargetEnvironment: 'run',
        taskTargetName: 'my-function-name-backend',
      });
      const createTask = sandbox
        .stub(bootstrapper.cloudTasksClient, 'createTask')
        .resolves();
      const getServiceStub = sandbox
        .stub(bootstrapper.cloudRunClient, 'getService')
        .resolves([{uri: 'http://some.domain/path'}]);
      await bootstrapper.enqueueTask({
        body: JSON.stringify({installation: {id: 1}}),
        id: 'some-request-id',
        name: 'event.name',
      });
      // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/36436
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sinon.assert.calledOnceWithMatch(createTask as any, {
        parent:
          'projects/my-project/locations/my-location/queues/my-function-name',
        task: {
          httpRequest: {
            httpMethod: 'POST',
            headers: sinon.match({
              'X-GitHub-Event': 'event.name',
              'X-GitHub-Delivery': 'some-request-id',
              'Content-Type': 'application/json',
            }),
            url: 'http://some.domain/path',
          },
        },
      });
      // https://github.com/DefinitelyTyped/DefinitelyTyped/issues/36436
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      sinon.assert.calledOnceWithExactly(getServiceStub as any, {
        name: 'projects/my-project/locations/my-location/services/my-function-name-backend',
      });
    });
  });
});
