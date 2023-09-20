import {describe, beforeEach, afterEach, it} from 'mocha';
import sinon from 'sinon';

import {Webhooks} from '@octokit/webhooks';
import * as express from 'express';
import fs from 'fs';
import {
  WebhookHandler,
  HandlerRequest,
  HandlerResponse,
} from '../src/webhook-handler';

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

function mockResponse() {
  const response = {} as any;
  response.status = sandbox.stub().returns(response);
  response.json = sandbox.stub().returns(response);
  response.send = sandbox.stub().returns(response);
  return response;
}

describe('WebhookHandler', () => {
  afterEach(() => {
    sandbox.restore();
  })
  describe('gcf', () => {
    it('handles webhooks', async () => {
      const webhookHandler = new WebhookHandler({
        projectId: 'my-test-project',
        botName: 'my-bot-name',
        botSecrets: {
          appId: '1234',
          privateKey: 'my-private-key',
          webhookSecret: 'foo',
        },
        skipVerification: true,
      });
      const issueSpy = sandbox.stub();
      const testApp = (app: Webhooks) => {
        app.on('issues', issueSpy);
      };
      const gcf = webhookHandler.gcf(testApp);

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

      await gcf(request, mockResponse());

      sinon.assert.calledOnce(issueSpy);
    });

    it('rejects invalid signatures', async () => {

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
      });
      const issueSpy = sandbox.stub();
      const testApp = (app: Webhooks) => {
        app.on('issues', issueSpy);
      };
      const gcf = webhookHandler.gcf(testApp);

      const request = mockRequest({
        installation: {id: 1},
      }, {
        'x-github-event': 'issues',
        'x-github-delivery': '123',
        // populated once this job has been executed by cloud tasks:
        'x-cloudtasks-taskname': 'my-task',
        // cat fixtures/payload.json | openssl dgst -sha1 -hmac "foo"
        'x-hub-signature': 'sha1=fd28a625d68ef18fe9b532fd972514774fed9653'
      });

      await gcf(request, mockResponse());

      sinon.assert.calledOnce(issueSpy);
    });
  });
});
