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

import {GCFBootstrapper} from '../src/gcf-utils';
import {describe, beforeEach, afterEach, it} from 'mocha';
import {GitHubAPI} from 'probot/lib/github';
import {Options} from 'probot';
import * as express from 'express';
import sinon from 'sinon';
import nock from 'nock';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const repos = require('../../test/fixtures/repos.json');

nock.disableNetConnect();

function nockRepoList() {
  return nock('https://raw.githubusercontent.com')
    .get('/googleapis/sloth/master/repos.json')
    .reply(200, repos);
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
      configStub = sinon.stub(bootstrapper, 'getProbotConfig').callsFake(() => {
        return Promise.resolve({id: 1234, secret: 'foo', webhookPath: 'bar'});
      });

      enqueueTask = sinon.stub(bootstrapper, 'enqueueTask');

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
        installtion: {id: 1},
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
        installtion: {id: 1},
      };
      req.headers = {};
      req.headers['x-github-event'] = 'schedule.repository';
      req.headers['x-github-delivery'] = '123';
      req.headers['x-cloudtasks-taskname'] = '';
      nockRepoList();

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
      configStub = sinon.stub(bootstrapper, 'getProbotConfig').callsFake(() => {
        return Promise.resolve({id: 1234, secret: 'foo', webhookPath: 'bar'});
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
});
