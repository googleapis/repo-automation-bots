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

import { GCFBootstrapper } from '../src/gcf-utils';

import { GitHubAPI } from 'probot/lib/github';
import { Options } from 'probot';
import * as express from 'express';
import sinon from 'sinon';
import nock from 'nock';

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

    beforeEach(async () => {
      req = express.request;

      bootstrapper = new GCFBootstrapper();
      configStub = sinon.stub(bootstrapper, 'getProbotConfig').callsFake(() => {
        return Promise.resolve({ id: 1234, secret: 'foo', webhookPath: 'bar' });
      });

      handler = await bootstrapper.gcf(async app => {
        app.auth = () =>
          new Promise<GitHubAPI>((resolve, reject) => {
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
    });

    it('calls the event handler', async () => {
      req.body = {
        installation: { id: 1 },
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
      req.body = {
        installation: { id: 1 },
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
        installtion: { id: 1 },
      };
      req.headers = {};
      req.headers['x-github-event'] = 'err';
      req.headers['x-github-delivery'] = '123';

      await handler(req, response);

      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(spy);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.called(sendStub);
    });

    it('invokes scheduled event on all managed libraries', async () => {
      req.body = {
        installation: { id: 1 },
      };
      req.headers = {};
      req.headers['x-github-event'] = 'schedule.repository';
      req.headers['x-github-delivery'] = '123';
  
      nockRepoList();

      await handler(req, response);
      sinon.assert.calledOnce(configStub);
      sinon.assert.notCalled(sendStatusStub);
      sinon.assert.calledOnce(sendStub);
      // handler should get called once for each repo in repos.json.
      sinon.assert.calledThrice(spy);
    });
  });

  describe('loadProbot', () => {
    let bootstrapper: GCFBootstrapper;
    let configStub: sinon.SinonStub<[], Promise<Options>>;

    beforeEach(() => {
      bootstrapper = new GCFBootstrapper();
      configStub = sinon.stub(bootstrapper, 'getProbotConfig').callsFake(() => {
        return Promise.resolve({ id: 1234, secret: 'foo', webhookPath: 'bar' });
      });
    });

    afterEach(() => {
      configStub.reset();
    });

    it('gets the config', async () => {
      await bootstrapper.loadProbot(async app => {
        // Do nothing
      });
      sinon.assert.calledOnce(configStub);
    });

    it('caches the probot if initialized', async () => {
      await bootstrapper.loadProbot(async app => {
        // Do nothing
      });
      sinon.assert.calledOnce(configStub);
      await bootstrapper.loadProbot(async app => {
        // Do nothing again
      });
      sinon.assert.calledOnce(configStub);
    });
  });
});
