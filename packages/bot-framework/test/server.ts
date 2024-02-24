// Copyright 2023 Google LLC
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

import nock from 'nock';
import * as http from 'http';
import {
  HandlerRequest,
  HandlerFunction,
  HandlerResponse,
} from '../src/bootstrapper';
import * as gaxios from 'gaxios';
import assert from 'assert';
import {getServer} from '../src/server';

const TEST_SERVER_PORT = 8000;

nock.disableNetConnect();

describe('getServer', () => {
  let server: http.Server;
  let handlerFunction: HandlerFunction;
  before(done => {
    nock.enableNetConnect(host => {
      return host.startsWith('localhost:');
    });
    handlerFunction = async (
      request: HandlerRequest,
      response: HandlerResponse
    ) => {
      if (request.rawBody) {
        response.send({
          status: 200,
          body: request.rawBody.toString('utf-8'),
        });
      } else {
        response.sendStatus(400);
      }
    };
    server = getServer(handlerFunction)
      .on('listening', () => {
        done();
      })
      .listen(TEST_SERVER_PORT);
  });
  after(done => {
    server.on('close', () => {
      done();
    });
    server.close();
  });

  interface TestResponse {
    body: string;
    status: number;
  }

  it('should inject rawBody into the request', async () => {
    const payload = '{  "foo": "bar"  }';
    const response = await gaxios.request<TestResponse>({
      url: `http://localhost:${TEST_SERVER_PORT}/`,
      headers: {
        'x-github-delivery': '123',
        'x-cloudtasks-taskname': 'test-bot',
        'x-github-event': 'issues',
        'content-type': 'application/json',
      },
      method: 'POST',
      body: payload,
    });
    assert.deepStrictEqual(response.status, 200);
    assert.strictEqual(response.data.body, payload);
  });
});
