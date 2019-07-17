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

import commonutils from '../src/gcf-utils';

import { GitHubAPI } from 'probot/lib/github';
import { ApplicationFunction, Probot } from 'probot';
import * as express from 'express';
import sinon from 'sinon';


describe('gcf-utils', () => {
    let handler: (request: express.Request, response: express.Response) => Promise<void>;
    let loadProbot: (appFn: ApplicationFunction) => Promise<Probot>;

    let response: express.Response;

    let req: express.Request;
    let reqStub: sinon.SinonStubbedInstance<express.Request>;

    let sendStub: sinon.SinonStub<[any?], express.Response>;
    let sendStatusStub: sinon.SinonStub<[number], express.Response>;
    let spy: sinon.SinonStub;
    let loadStub: sinon.SinonStub<[ApplicationFunction], Promise<Probot>>;

    before(async () => {
        response = express.response;
        sendStub = sinon.stub(response, "send");
        sendStatusStub = sinon.stub(response, "sendStatus");

        req = express.request;
        reqStub = sinon.stub(req);

        spy = sinon.stub();

        loadStub = sinon.stub(commonutils, "loadProbot");
    });

    beforeEach(async () => {
        handler = await commonutils.gcf(async app => {
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
    });

    it('calls the event handler', async () => {
        reqStub.body = {
            installation: { id: 1 }
        }
        reqStub.headers = {};
        reqStub.headers['x-github-event'] = 'issues';
        reqStub.headers['x-github-delivery'] = '123';


        await handler(req, response)

        sinon.assert.called(reqStub.get);
        sinon.assert.called(reqStub.body);
        sinon.assert.calledOnce(sendStub);
        sinon.assert.calledOnce(spy);
    });

    it('does nothing if there are missing headers', async () => {
        reqStub.body = {
            installation: { id: 1 }
        };
        reqStub.headers = {};

        await handler(req, response);

        sinon.assert.called(reqStub.get);
        sinon.assert.called(reqStub.body);
        sinon.assert.notCalled(spy);
        sinon.assert.calledWith(sendStatusStub, 400);
    });
});
