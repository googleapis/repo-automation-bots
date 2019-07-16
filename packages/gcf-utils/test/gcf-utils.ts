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
