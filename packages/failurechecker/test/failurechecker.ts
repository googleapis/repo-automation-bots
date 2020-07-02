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

// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import {describe, it, beforeEach, afterEach} from 'mocha';
import * as sinon from 'sinon';
import {failureChecker} from '../src/failurechecker';

nock.disableNetConnect();

describe('failurechecker', () => {
  let probot: Probot;
  beforeEach(() => {
    // by default run within working hours (20 UTC):
    sinon.useFakeTimers(new Date(Date.UTC(2020, 1, 1, 20)));
    probot = new Probot({
      // use a bare instance of octokit, the default version
      // enables retries which makes testing difficult.
      // eslint-disable-next-line node/no-extraneous-require
      Octokit: require('@octokit/rest'),
    });
    probot.app = {
      getSignedJsonWebToken() {
        return 'abc123';
      },
      getInstallationAccessToken(): Promise<string> {
        return Promise.resolve('abc123');
      },
    };
    probot.load(failureChecker);
  });

  afterEach(() => sinon.restore());

  it('opens an issue on GitHub if there exists a pending label > threshold', async () => {
    const requests = nock('https://api.github.com')
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&per_page=16'
      )
      .reply(200, [
        {
          number: 33,
          updated_at: '2011-04-22T13:33:48Z',
        },
      ])
      .get('/repos/googleapis/nodejs-foo/pulls/33')
      .reply(200, {
        number: 33,
        merged_at: '2011-04-22T13:33:48Z',
      })
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=type%3A%20process&per_page=32'
      )
      .reply(200, [])
      .get('/rate_limit')
      .reply(200, {})
      .post('/repos/googleapis/nodejs-foo/issues', body => {
        snapshot(body);
        return true;
      })
      .reply(200);

    await probot.receive({
      name: 'schedule.repository',
      payload: {
        repository: {
          name: 'nodejs-foo',
        },
        organization: {
          login: 'googleapis',
        },
      },
      id: 'abc123',
    });
    requests.done();
  });

  it('opens an issue on GitHub if there exists a tagged label > threshold', async () => {
    const requests = nock('https://api.github.com')
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&per_page=16'
      )
      .reply(200, [
        {
          number: 33,
          updated_at: '2011-04-22T13:33:48Z',
        },
      ])
      .get('/repos/googleapis/nodejs-foo/pulls/33')
      .reply(200, {
        number: 33,
        merged_at: '2011-04-22T13:33:48Z',
      })
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=type%3A%20process&per_page=32'
      )
      .reply(200, [])
      .get('/rate_limit')
      .reply(200, {})
      .post('/repos/googleapis/nodejs-foo/issues', body => {
        snapshot(body);
        return true;
      })
      .reply(200);

    await probot.receive({
      name: 'schedule.repository',
      payload: {
        repository: {
          name: 'nodejs-foo',
        },
        organization: {
          login: 'googleapis',
        },
      },
      id: 'abc123',
    });
    requests.done();
  });

  it('does not open an issue if merged_at is < threshold', async () => {
    const date = new Date().toISOString();
    const requests = nock('https://api.github.com')
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&per_page=16'
      )
      .reply(200, [
        {
          number: 33,
          updated_at: date,
        },
      ]);

    await probot.receive({
      name: 'schedule.repository',
      payload: {
        repository: {
          name: 'nodejs-foo',
        },
        organization: {
          login: 'googleapis',
        },
      },
      id: 'abc123',
    });
    requests.done();
  });

  it('does not open an issue if a prior warning issue is still open', async () => {
    const requests = nock('https://api.github.com')
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&per_page=16'
      )
      .reply(200, [
        {
          number: 33,
          updated_at: '2011-04-22T13:33:48Z',
        },
      ])
      .get('/repos/googleapis/nodejs-foo/pulls/33')
      .reply(200, {
        number: 33,
        merged_at: '2011-04-22T13:33:48Z',
      })
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=type%3A%20process&per_page=32'
      )
      .reply(200, [
        {
          title: 'Warning: a recent release failed',
        },
      ])
      .get('/rate_limit')
      .reply(200, {});

    await probot.receive({
      name: 'schedule.repository',
      payload: {
        repository: {
          name: 'nodejs-foo',
        },
        organization: {
          login: 'googleapis',
        },
      },
      id: 'abc123',
    });
    requests.done();
  });

  it('does not run outside of working hours', async () => {
    // UTC 05:00 is outside of working hours:
    sinon.useFakeTimers(new Date(Date.UTC(2020, 1, 1, 5)));

    await probot.receive({
      name: 'schedule.repository',
      payload: {
        repository: {
          name: 'nodejs-foo',
        },
        organization: {
          login: 'googleapis',
        },
      },
      id: 'abc123',
    });
  });
});
