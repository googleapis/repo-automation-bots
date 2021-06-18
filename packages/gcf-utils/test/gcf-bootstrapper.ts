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

function nockListInstallations(fixture = 'app_installations.json') {
  return (
    nock('https://api.github.com/')
      .get('/app/installations')
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      .reply(200, require(`../../test/fixtures/${fixture}`))
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
    const sendStatusStub: sinon.SinonStub<[number], express.Response> =
      sinon.stub(response, 'sendStatus');

    let req: express.Request;

    const issueSpy: sinon.SinonStub = sinon.stub();
    const repositoryCronSpy: sinon.SinonStub = sinon.stub();
    const installationCronSpy: sinon.SinonStub = sinon.stub();
    const globalCronSpy: sinon.SinonStub = sinon.stub();
    const pubsubSpy: sinon.SinonStub = sinon.stub();
    let configStub: sinon.SinonStub<[boolean?], Promise<Options>>;

    let bootstrapper: GCFBootstrapper;

    let enqueueTask: sinon.SinonStub;

    async function mockBootstrapper(wrapOpts?: WrapOptions) {
      req = express.request;

      bootstrapper = new GCFBootstrapper();
      configStub = sinon.stub(bootstrapper, 'getProbotConfig').resolves({
        appId: 1234,
        secret: 'foo',
        webhookPath: 'bar',
        privateKey: 'cert',
      });
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
      }, wrapOpts);
    }

    afterEach(() => {
      sendStub.reset();
      sendStatusStub.reset();
      issueSpy.reset();
      repositoryCronSpy.reset();
      installationCronSpy.reset();
      globalCronSpy.reset();
      pubsubSpy.reset();
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
      sinon.assert.notCalled(issueSpy);
      sinon.assert.notCalled(repositoryCronSpy);
      sinon.assert.notCalled(installationCronSpy);
      sinon.assert.notCalled(globalCronSpy);
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
      sinon.assert.calledOnce(issueSpy);
      sinon.assert.notCalled(repositoryCronSpy);
      sinon.assert.notCalled(installationCronSpy);
      sinon.assert.notCalled(globalCronSpy);
      downloaded.done();
    });

    it('does not retry the task, if tmpUrl in payload cannot be found (expired)', async () => {
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
        .get('/storage/v1/b/tmp/foo/o/%2Fbucket%2Ffoo?alt=media')
        .reply(404);

      await handler(req, response);

      delete process.env.WEBHOOK_TMP;
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
        .get('/storage/v1/b/tmp/foo/o/%2Fbucket%2Ffoo?alt=media')
        .reply(500);

      await handler(req, response);

      delete process.env.WEBHOOK_TMP;
      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 500});
      sinon.assert.notCalled(issueSpy);
      sinon.assert.notCalled(repositoryCronSpy);
      sinon.assert.notCalled(installationCronSpy);
      sinon.assert.notCalled(globalCronSpy);
      downloaded.done();
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
        const listInstallationRepoRequests = nockListInstallationRepos();

        await handler(req, response);

        sinon.assert.calledTwice(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
        listInstallationRepoRequests.done();
      });

      it('ensures that task is enqueued when called by scheduler for many installations', async () => {
        await mockBootstrapper();
        req.body = {};
        req.headers = {};
        req.headers['x-github-event'] = 'schedule.repository';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = '';
        const listInstallationRequests = nockListInstallations();
        const listInstallationRepoRequests = nockListInstallationRepos();

        await handler(req, response);

        sinon.assert.calledTwice(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
        listInstallationRequests.done();
        listInstallationRepoRequests.done();
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
        const listInstallationRequests = nockListInstallations(
          'app_installations.json'
        );

        await handler(req, response);

        sinon.assert.calledOnce(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
        listInstallationRequests.done();
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
        const listInstallationRequests = nockListInstallations(
          'app_installations_multiple.json'
        );

        await handler(req, response);

        sinon.assert.calledTwice(enqueueTask);
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
        listInstallationRequests.done();
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

    describe('verification', () => {
      it('rejects unsigned task requests', async () => {
        await mockBootstrapper({
          logging: false,
          background: true,
          skipVerification: false,
        });
        req.body = {
          installation: {id: 1},
        };
        req.headers = {};
        req.headers['x-github-event'] = 'another.name';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = 'my-task';

        await handler(req, response);

        sinon.assert.calledOnce(configStub);
        sinon.assert.notCalled(sendStatusStub);
        sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 400});
        sinon.assert.notCalled(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
      });

      it('rejects invalid task request signatures', async () => {
        await mockBootstrapper({
          logging: false,
          background: true,
          skipVerification: false,
        });
        req.body = {
          installation: {id: 1},
        };
        req.headers = {};
        req.headers['x-github-event'] = 'another.name';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = 'my-task';
        req.headers['x-hub-signature'] = 'invalidsignature';

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
        req.body = {
          installation: {id: 1},
        };
        req.headers = {};
        req.headers['x-github-event'] = 'issues';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = 'my-task';
        // echo -n '{"installation":{"id":1}}' | openssl dgst -sha1 -hmac "foo"
        req.headers['x-hub-signature'] =
          'sha1=c012c260559a04cf285e05d67e1ecedcad71b931';

        await handler(req, response);

        sinon.assert.calledOnce(configStub);
        sinon.assert.notCalled(sendStatusStub);
        sinon.assert.calledOnceWithMatch(sendStub, {statusCode: 200});
        sinon.assert.calledOnce(issueSpy);
        sinon.assert.notCalled(repositoryCronSpy);
        sinon.assert.notCalled(installationCronSpy);
        sinon.assert.notCalled(globalCronSpy);
      });

      // Remove this test after https://github.com/googleapis/repo-automation-bots/issues/2092
      // is fixed.
      it('handles valid task request signatures without leading sha1', async () => {
        await mockBootstrapper({
          logging: false,
          background: true,
          skipVerification: false,
        });
        req.body = {
          installation: {id: 1},
        };
        req.headers = {};
        req.headers['x-github-event'] = 'issues';
        req.headers['x-github-delivery'] = '123';
        req.headers['x-cloudtasks-taskname'] = 'my-task';
        // echo -n '{"installation":{"id":1}}' | openssl dgst -sha1 -hmac "foo"
        req.headers['x-hub-signature'] =
          'c012c260559a04cf285e05d67e1ecedcad71b931';

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
      bootstrapper = new GCFBootstrapper();
      configStub = sinon.stub(bootstrapper, 'getProbotConfig').resolves({
        appId: 1234,
        secret: 'foo',
        webhookPath: 'bar',
        privateKey: 'cert',
      });
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

  describe('getAuthenticatedOctokit', () => {
    it('can return an Octokit instance given an installation id', async () => {
      const bootstrapper = new GCFBootstrapper();
      const configStub = sinon.stub(bootstrapper, 'getProbotConfig').resolves({
        appId: 1234,
        secret: 'foo',
        webhookPath: 'bar',
        privateKey: 'cert',
      });
      const octokit = await bootstrapper.getAuthenticatedOctokit(1234);
      assert.ok(octokit);
      sinon.assert.calledOnce(configStub);
    });

    it('can return an Octokit instance without an installation id', async () => {
      const bootstrapper = new GCFBootstrapper();
      const configStub = sinon.stub(bootstrapper, 'getProbotConfig').resolves({
        appId: 1234,
        secret: 'foo',
        webhookPath: 'bar',
        privateKey: 'cert',
      });
      const octokit = await bootstrapper.getAuthenticatedOctokit(undefined);
      assert.ok(octokit);
      sinon.assert.calledOnce(configStub);
    });
  });
});
