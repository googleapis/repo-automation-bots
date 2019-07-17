/**
 * Copyright 2019 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { GCFBootstrapper } from '../src/gcf-utils';

import { GitHubAPI } from 'probot/lib/github';
import { ApplicationFunction, Options, Probot } from 'probot';
import * as express from 'express';
import sinon from 'sinon';


describe('gcf-utils', () => {
    let handler: (request: express.Request, response: express.Response) => Promise<void>;
    let loadProbot: (appFn: ApplicationFunction) => Promise<Probot>;

    let response: express.Response;

    let req: express.Request;

    let sendStub: sinon.SinonStub<[any?], express.Response>;
    let sendStatusStub: sinon.SinonStub<[number], express.Response>;
    let spy: sinon.SinonStub;
    let loadStub: sinon.SinonStub<[ApplicationFunction], Promise<Probot>>;
    let configStub: sinon.SinonStub<[], Promise<Options>>;

    let bootstrapper: GCFBootstrapper;

    before(async () => {
        response = express.response;
        sendStub = sinon.stub(response, "send");
        sendStatusStub = sinon.stub(response, "sendStatus");

        req = express.request;

        spy = sinon.stub();
    });

    beforeEach(async () => {
        bootstrapper = new GCFBootstrapper();
        configStub = sinon.stub(bootstrapper, "getProbotConfig").callsFake(() => {
            return Promise.resolve({ id: 1234, secret: "foo", webhookPath: "bar" })
        });

        handler = await bootstrapper.gcf(async app => {
            app.auth = () => new Promise<GitHubAPI>((resolve, reject) => {
                resolve(GitHubAPI());
            })
            app.on('issues', spy)
        })
    });

    afterEach(() => {
        sendStub.reset();
        sendStatusStub.reset();
        spy.reset();
        configStub.reset();
    });

    it('calls the event handler', async () => {
        req.body = {
            installation: { id: 1 }
        }
        req.headers = {};
        req.headers['x-github-event'] = 'issues';
        req.headers['x-github-delivery'] = '123';

        await handler(req, response)

        sinon.assert.calledOnce(configStub);
        sinon.assert.notCalled(sendStatusStub);
        sinon.assert.calledOnce(sendStub);
        sinon.assert.calledOnce(spy);
    });

    it('does nothing if there are missing headers', async () => {
        req.body = {
            installation: { id: 1 }
        };
        req.headers = {};

        await handler(req, response);

        sinon.assert.calledOnce(configStub);
        sinon.assert.notCalled(spy);
        sinon.assert.notCalled(sendStub);
        sinon.assert.calledWith(sendStatusStub, 400);
    });
});
