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
import {Probot, createProbot, ProbotOctokit} from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import {describe, it, beforeEach, afterEach} from 'mocha';
import * as sinon from 'sinon';
import {failureChecker, TimeMethods} from '../src/failurechecker';

nock.disableNetConnect();

describe('failurechecker', () => {
  let probot: Probot;

  beforeEach(() => {
    // Later versions of probot seem to have problems dealing with fake sinon timers.
    sinon.stub(TimeMethods, 'Date').returns(new Date(Date.UTC(2020, 1, 1, 20)));
    probot = createProbot({
      overrides: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
      },
    });
    probot.load(failureChecker);
  });

  afterEach(() => {
    nock.cleanAll();
    sinon.restore();
  });

  it('opens an issue on GitHub if there exists a pending label > threshold', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/nodejs-foo/contents/.github%2Frelease-please.yml')
      .reply(
        200,
        Buffer.from(
          JSON.stringify({
            releaseType: 'node',
          })
        )
      )
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [
        {
          number: 33,
          updated_at: '2020-01-30T13:33:48Z',
        },
      ])
      .get('/repos/googleapis/nodejs-foo/pulls/33')
      .reply(200, {
        number: 33,
        merged_at: '2020-01-30T13:33:48Z',
        labels: [{name: 'autorelease: pending'}],
      })
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'bcoe',
          },
        },
        organization: {
          login: 'googleapis',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
  });

  it('opens an issue on GitHub if there exists a tagged label > threshold', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/nodejs-foo/contents/.github%2Frelease-please.yml')
      .reply(
        200,
        Buffer.from(
          JSON.stringify({
            releaseType: 'node',
          })
        )
      )
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [
        {
          number: 33,
          updated_at: '2020-01-30T13:33:48Z',
        },
      ])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get('/repos/googleapis/nodejs-foo/pulls/33')
      .reply(200, {
        number: 33,
        merged_at: '2020-01-30T13:33:48Z',
        labels: [{name: 'autorelease: pending'}],
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'bcoe',
          },
        },
        organization: {
          login: 'googleapis',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
  });

  it('does not open issue for tagged label, when upstream repository of type "go-yoshi"', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/nodejs-foo/contents/.github%2Frelease-please.yml')
      .reply(
        200,
        Buffer.from(
          JSON.stringify({
            releaseType: 'go-yoshi',
          })
        )
      )
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get('/rate_limit')
      .reply(200, {})
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=type%3A%20process&per_page=32'
      )
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'bcoe',
          },
        },
        organization: {
          login: 'googleapis',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
  });

  it('does not open issue for tagged label, when upstream repository of type "go"', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/nodejs-foo/contents/.github%2Frelease-please.yml')
      .reply(
        200,
        Buffer.from(
          JSON.stringify({
            releaseType: 'go',
          })
        )
      )
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get('/rate_limit')
      .reply(200, {})
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=type%3A%20process&per_page=32'
      )
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'bcoe',
          },
        },
        organization: {
          login: 'googleapis',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
  });

  it('does not open issue for tagged label if disabled in configuration', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/nodejs-foo/contents/.github%2Frelease-please.yml')
      .reply(
        200,
        Buffer.from(
          JSON.stringify({
            releaseType: 'node',
            disableFailureChecker: true,
          })
        )
      )
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get('/rate_limit')
      .reply(200, {})
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=type%3A%20process&per_page=32'
      )
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'bcoe',
          },
        },
        organization: {
          login: 'googleapis',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
  });

  it('does not open an issue if merged_at is < threshold', async () => {
    const date = new Date().toISOString();
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/nodejs-foo/contents/.github%2Frelease-please.yml')
      .reply(
        200,
        Buffer.from(
          JSON.stringify({
            releaseType: 'node',
          })
        )
      )
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [
        {
          number: 33,
          updated_at: date,
        },
      ])
      .get('/rate_limit')
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=type%3A%20process&per_page=32'
      )
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'bcoe',
          },
        },
        organization: {
          login: 'googleapis',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
  });

  it('does not open an issue if merged_at is over the max threshold', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/nodejs-foo/contents/.github%2Frelease-please.yml')
      .reply(
        200,
        Buffer.from(
          JSON.stringify({
            releaseType: 'node',
          })
        )
      )
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [
        {
          number: 33,
          updated_at: '2019-12-25T13:33:48Z',
        },
      ])
      .get('/rate_limit')
      .reply(200, {})
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=type%3A%20process&per_page=32'
      )
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'bcoe',
          },
        },
        organization: {
          login: 'googleapis',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
  });

  it('does not open an issue if a prior warning issue is still open', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/nodejs-foo/contents/.github%2Frelease-please.yml')
      .reply(
        200,
        Buffer.from(
          JSON.stringify({
            releaseType: 'node',
          })
        )
      )
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [
        {
          number: 33,
          updated_at: '2020-01-30T13:33:48Z',
        },
      ])
      .get('/repos/googleapis/nodejs-foo/pulls/33')
      .reply(200, {
        number: 33,
        merged_at: '2020-01-30T13:33:48Z',
        labels: [{name: 'autorelease: pending'}],
      })
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=type%3A%20process&per_page=32'
      )
      .reply(200, [
        {
          title: 'Warning: a recent release failed',
          number: 44,
          body: 'The following release PRs may have failed:\n\n* #33',
        },
      ])
      .get('/rate_limit')
      .reply(200, {});

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'bcoe',
          },
        },
        organization: {
          login: 'googleapis',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
  });

  it('does not run outside of working hours', async () => {
    // UTC 05:00 is outside of working hours:
    sinon.restore();
    sinon.stub(TimeMethods, 'Date').returns(new Date(Date.UTC(2020, 1, 1, 5)));

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
        },
        organization: {
          login: 'googleapis',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
  });

  it('closes a PR once failing releases are handled', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/nodejs-foo/contents/.github%2Frelease-please.yml')
      .reply(
        200,
        Buffer.from(
          JSON.stringify({
            releaseType: 'node',
          })
        )
      )
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [
        {
          number: 33,
          updated_at: '2020-01-30T13:33:48Z',
        },
      ])
      .get('/repos/googleapis/nodejs-foo/pulls/33')
      .reply(200, {
        number: 33,
        merged_at: '2020-01-30T13:33:48Z',
        labels: [
          {name: 'autorelease: failed'},
          {name: 'autorelease: published'},
        ],
      })
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=type%3A%20process&per_page=32'
      )
      .reply(200, [
        {
          title: 'Warning: a recent release failed',
          number: 44,
        },
      ])
      .get('/rate_limit')
      .reply(200, {})
      .patch('/repos/googleapis/nodejs-foo/issues/44', body => {
        snapshot(body);
        return true;
      })
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'bcoe',
          },
        },
        organization: {
          login: 'googleapis',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
  });

  it('ignores a PR both failed and published', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/nodejs-foo/contents/.github%2Frelease-please.yml')
      .reply(
        200,
        Buffer.from(
          JSON.stringify({
            releaseType: 'node',
          })
        )
      )
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [
        {
          number: 33,
          updated_at: '2020-01-30T13:33:48Z',
        },
      ])
      .get('/repos/googleapis/nodejs-foo/pulls/33')
      .reply(200, {
        number: 33,
        merged_at: '2020-01-30T13:33:48Z',
        labels: [
          {name: 'autorelease: failed'},
          {name: 'autorelease: published'},
        ],
      })
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=type%3A%20process&per_page=32'
      )
      .reply(200, [])
      .get('/rate_limit')
      .reply(200, {});

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'bcoe',
          },
        },
        organization: {
          login: 'googleapis',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
  });

  it('updates an issue with new failures', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/nodejs-foo/contents/.github%2Frelease-please.yml')
      .reply(
        200,
        Buffer.from(
          JSON.stringify({
            releaseType: 'node',
          })
        )
      )
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [
        {
          number: 33,
          updated_at: '2020-01-30T13:33:48Z',
        },
        {
          number: 34,
          updated_at: '2020-01-30T13:33:48Z',
        },
      ])
      .get('/repos/googleapis/nodejs-foo/pulls/33')
      .reply(200, {
        number: 33,
        merged_at: '2020-01-30T13:33:48Z',
        labels: [{name: 'autorelease: failed'}],
      })
      .get('/repos/googleapis/nodejs-foo/pulls/34')
      .reply(200, {
        number: 34,
        merged_at: '2020-01-30T13:33:48Z',
        labels: [{name: 'autorelease: failed'}],
      })
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=type%3A%20process&per_page=32'
      )
      .reply(200, [
        {
          title: 'Warning: a recent release failed',
          number: 44,
          body: 'The following release PRs may have failed:\n\n* #33',
        },
      ])
      .get('/rate_limit')
      .reply(200, {})
      .patch('/repos/googleapis/nodejs-foo/issues/44', body => {
        snapshot(body);
        return true;
      })
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'bcoe',
          },
        },
        organization: {
          login: 'googleapis',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
  });

  it('opens an issue with multiple failures', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/nodejs-foo/contents/.github%2Frelease-please.yml')
      .reply(
        200,
        Buffer.from(
          JSON.stringify({
            releaseType: 'node',
          })
        )
      )
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [
        {
          number: 33,
          updated_at: '2020-01-30T13:33:48Z',
        },
        {
          number: 34,
          updated_at: '2020-01-30T13:33:48Z',
        },
      ])
      .get('/repos/googleapis/nodejs-foo/pulls/33')
      .reply(200, {
        number: 33,
        merged_at: '2020-01-30T13:33:48Z',
        labels: [{name: 'autorelease: failed'}],
      })
      .get('/repos/googleapis/nodejs-foo/pulls/34')
      .reply(200, {
        number: 34,
        merged_at: '2020-01-30T13:33:48Z',
        labels: [{name: 'autorelease: failed'}],
      })
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
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
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'bcoe',
          },
        },
        organization: {
          login: 'googleapis',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
  });
  it('does not open a failure issue if PR is missing appropriate labels', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/nodejs-foo/contents/.github%2Frelease-please.yml')
      .reply(
        200,
        Buffer.from(
          JSON.stringify({
            releaseType: 'node',
          })
        )
      )
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20pending&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [
        {
          number: 33,
          updated_at: '2020-01-30T13:33:48Z',
        },
      ])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=type%3A%20process&per_page=32'
      )
      .reply(200, [])
      .get('/rate_limit')
      .reply(200, {})
      .get('/repos/googleapis/nodejs-foo/pulls/33')
      .reply(200, {
        number: 33,
        merged_at: '2020-01-30T13:33:48Z',
        labels: [],
      });

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'bcoe',
          },
        },
        organization: {
          login: 'googleapis',
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
  });
});
