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
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import {describe, it, beforeEach, afterEach} from 'mocha';
import * as sinon from 'sinon';
import {failureChecker, TimeMethods} from '../src/failurechecker';
import * as issueModule from '@google-automations/issue-utils';
import * as gcfUtilsModule from 'gcf-utils';
const fetch = require('node-fetch');

nock.disableNetConnect();

const sandbox = sinon.createSandbox();

describe('failurechecker', () => {
  let probot: Probot;
  let addIssueStub: sinon.SinonStub;
  let closeIssueStub: sinon.SinonStub;
  let getAuthenticatedOctokitStub: sinon.SinonStub;

  beforeEach(() => {
    // Later versions of probot seem to have problems dealing with fake sinon timers.
    sandbox
      .stub(TimeMethods, 'Date')
      .returns(new Date(Date.UTC(2020, 1, 1, 20)));
    addIssueStub = sandbox.stub(issueModule, 'addOrUpdateIssue').resolves();
    closeIssueStub = sandbox.stub(issueModule, 'closeIssue').resolves();
    getAuthenticatedOctokitStub = sandbox.stub(
      gcfUtilsModule,
      'getAuthenticatedOctokit'
    );
    getAuthenticatedOctokitStub.resolves(new Octokit({request: {fetch}}));
    probot = createProbot({
      overrides: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
        request: {fetch},
      },
    });
    probot.load(failureChecker);
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  it('opens an issue on GitHub if there exists a pending label > threshold', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/googleapis/nodejs-foo/contents/.github%2Frelease-please.yml')
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
          pull_request: {
            merged_at: '2020-01-30T13:33:48Z',
          },
          labels: [{name: 'autorelease: pending'}],
        },
      ])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'googleapis',
          },
        },
        organization: {
          login: 'googleapis',
        },
        installation: {id: 123},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
    sinon.assert.calledOnce(addIssueStub);
    snapshot(addIssueStub.getCall(0).args[4]);
  });

  it('opens an issue on GitHub if there exists a tagged label > threshold', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/googleapis/nodejs-foo/contents/.github%2Frelease-please.yml')
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
          pull_request: {
            merged_at: '2020-01-30T13:33:48Z',
          },
          labels: [{name: 'autorelease: pending'}],
        },
      ])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'googleapis',
          },
        },
        organization: {
          login: 'googleapis',
        },
        installation: {id: 123},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
    sinon.assert.calledOnce(addIssueStub);
    snapshot(addIssueStub.getCall(0).args[4]);
  });

  it('does not open issue for tagged label, when upstream repository of type "go-yoshi"', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/googleapis/nodejs-foo/contents/.github%2Frelease-please.yml')
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
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'googleapis',
          },
        },
        organization: {
          login: 'googleapis',
        },
        installation: {id: 123},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
    sinon.assert.notCalled(addIssueStub);
  });

  it('does not open issue for tagged label, when upstream repository of type "go"', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/googleapis/nodejs-foo/contents/.github%2Frelease-please.yml')
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
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'googleapis',
          },
        },
        organization: {
          login: 'googleapis',
        },
        installation: {id: 123},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
    sinon.assert.notCalled(addIssueStub);
  });

  it('does not open issue for tagged label if disabled in configuration', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/googleapis/nodejs-foo/contents/.github%2Frelease-please.yml')
      .reply(
        200,
        Buffer.from(
          JSON.stringify({
            releaseType: 'node',
            disableFailureChecker: true,
          })
        )
      );

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'googleapis',
          },
        },
        organization: {
          login: 'googleapis',
        },
        installation: {id: 123},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
    sinon.assert.notCalled(addIssueStub);
  });

  it('does not open an issue if merged_at is < threshold', async () => {
    const date = new Date().toISOString();
    const requests = nock('https://api.github.com')
      .get('/repos/googleapis/nodejs-foo/contents/.github%2Frelease-please.yml')
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
          pull_request: {
            merged_at: date,
          },
          labels: [{name: 'autorelease: pending'}],
        },
      ]);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'googleapis',
          },
        },
        organization: {
          login: 'googleapis',
        },
        installation: {id: 123},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
    sinon.assert.notCalled(addIssueStub);
  });

  it('does not open an issue if merged_at is over the max threshold', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/googleapis/nodejs-foo/contents/.github%2Frelease-please.yml')
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
          pull_request: {
            merged_at: '2019-12-25T13:33:48Z',
          },
          labels: [{name: 'autorelease: pending'}],
        },
      ]);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'googleapis',
          },
        },
        organization: {
          login: 'googleapis',
        },
        installation: {id: 123},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
    sinon.assert.notCalled(addIssueStub);
  });

  it('does not open an issue if a prior warning issue is still open', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/googleapis/nodejs-foo/contents/.github%2Frelease-please.yml')
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
          pull_request: {
            merged_at: '2020-01-30T13:33:48Z',
          },
          labels: [{name: 'autorelease: pending'}],
        },
      ]);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'googleapis',
          },
        },
        organization: {
          login: 'googleapis',
        },
        installation: {id: 123},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
    sinon.assert.calledOnce(addIssueStub);
    snapshot(addIssueStub.getCall(0).args[4]);
  });

  it('does not run outside of working hours', async () => {
    // UTC 05:00 is outside of working hours:
    sandbox.restore();
    sandbox
      .stub(TimeMethods, 'Date')
      .returns(new Date(Date.UTC(2020, 1, 1, 5)));

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'googleapis',
          },
        },
        organization: {
          login: 'googleapis',
        },
        installation: {id: 123},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    sinon.assert.notCalled(addIssueStub);
  });

  it('ignores a PR both failed and published', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/googleapis/nodejs-foo/contents/.github%2Frelease-please.yml')
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
          labels: [
            {name: 'autorelease: failed'},
            {name: 'autorelease: published'},
          ],
        },
      ])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'googleapis',
          },
        },
        organization: {
          login: 'googleapis',
        },
        installation: {id: 123},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
    sinon.assert.notCalled(addIssueStub);
  });

  it('updates an issue with new failures', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/googleapis/nodejs-foo/contents/.github%2Frelease-please.yml')
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
          labels: [{name: 'autorelease: failed'}],
          pull_request: {
            merged_at: '2020-01-30T13:33:48Z',
          },
        },
        {
          number: 34,
          updated_at: '2020-01-30T13:33:48Z',
          labels: [{name: 'autorelease: failed'}],
          pull_request: {
            merged_at: '2020-01-30T13:33:48Z',
          },
        },
      ])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'googleapis',
          },
        },
        organization: {
          login: 'googleapis',
        },
        installation: {id: 123},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
    sinon.assert.calledOnce(addIssueStub);
    snapshot(addIssueStub.getCall(0).args[4]);
  });

  it('opens an issue with multiple failures', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/googleapis/nodejs-foo/contents/.github%2Frelease-please.yml')
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
          labels: [{name: 'autorelease: failed'}],
          pull_request: {
            merged_at: '2020-01-30T13:33:48Z',
          },
        },
        {
          number: 34,
          updated_at: '2020-01-30T13:33:48Z',
          labels: [{name: 'autorelease: failed'}],
          pull_request: {
            merged_at: '2020-01-30T13:33:48Z',
          },
        },
      ])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20tagged&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, [])
      .get(
        '/repos/googleapis/nodejs-foo/issues?labels=autorelease%3A%20failed&state=closed&sort=updated&direction=desc&per_page=16'
      )
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'googleapis',
          },
        },
        organization: {
          login: 'googleapis',
        },
        installation: {id: 123},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
    sinon.assert.calledOnce(addIssueStub);
    snapshot(addIssueStub.getCall(0).args[4]);
  });
  it('does not open a failure issue if PR is missing appropriate labels', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/googleapis/nodejs-foo/contents/.github%2Frelease-please.yml')
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
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'googleapis',
          },
        },
        organization: {
          login: 'googleapis',
        },
        installation: {id: 123},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
    sinon.assert.notCalled(addIssueStub);
  });

  it('closes an issue if the issue is resolved', async () => {
    const requests = nock('https://api.github.com')
      .get('/repos/googleapis/nodejs-foo/contents/.github%2Frelease-please.yml')
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
      .reply(200, []);

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        repository: {
          name: 'nodejs-foo',
          owner: {
            login: 'googleapis',
          },
        },
        organization: {
          login: 'googleapis',
        },
        installation: {id: 123},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });
    requests.done();
    sinon.assert.calledOnce(closeIssueStub);
  });
});
