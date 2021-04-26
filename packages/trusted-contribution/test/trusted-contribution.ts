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

import {describe, it, afterEach, beforeEach} from 'mocha';
import assert from 'assert';
import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import nock from 'nock';
import sinon from 'sinon';
import * as fs from 'fs';
import {logger} from 'gcf-utils';

import myProbotApp from '../src/trusted-contribution';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('TrustedContributionTestRunner', () => {
  let probot: Probot;
  let requests: nock.Scope;

  beforeEach(() => {
    probot = createProbot({
      overrides: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
      },
    });
    probot.load(myProbotApp);
    requests = nock('https://api.github.com');
  });

  afterEach(() => {
    nock.cleanAll();
    sinon.restore();
  });

  describe('without configuration file', () => {
    beforeEach(() => {
      requests = requests
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Ftrusted-contribution.yml'
        )
        .reply(404)
        .get(
          '/repos/chingor13/.github/contents/.github%2Ftrusted-contribution.yml'
        )
        .reply(404);
    });

    describe('opened pull request', () => {
      it('sets a label on PR, if PR author is a trusted contributor', async () => {
        requests = requests
          .post(
            '/repos/chingor13/google-auth-library-java/issues/3/labels',
            () => true
          )
          .reply(200);

        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              user: {
                login: 'renovate-bot',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
      });

      it('does not set a label on PR, if PR author is not a trusted contributor', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              user: {
                login: 'notauthorized',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
      });
    });

    describe('updated pull request', () => {
      it('sets a label on PR, if PR author is a trusted contributor', async () => {
        requests = requests
          .post(
            '/repos/chingor13/google-auth-library-java/issues/3/labels',
            () => true
          )
          .reply(200);

        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              user: {
                login: 'renovate-bot',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
      });

      it('does not set a label on PR, if PR author is not a trusted contributor', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              user: {
                login: 'notauthorized',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
        requests.done();
      });
    });
  });

  describe('with a custom configuration file', () => {
    beforeEach(() => {
      const config = fs.readFileSync(resolve(fixturesPath, 'custom.yml'));
      requests = requests
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Ftrusted-contribution.yml'
        )
        .reply(200, config);
    });

    describe('opened pull request', () => {
      it('sets a label on PR, if PR author is a trusted contributor', async () => {
        requests = requests
          .post(
            '/repos/chingor13/google-auth-library-java/issues/3/labels',
            () => true
          )
          .reply(200);

        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              user: {
                login: 'custom-user',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
      });

      it('does not set a label on PR, if PR author is not a trusted contributor', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              user: {
                login: 'release-please[bot]',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
      });
    });

    describe('updated pull request', () => {
      it('sets a label on PR, if PR author is a trusted contributor', async () => {
        requests = requests
          .post(
            '/repos/chingor13/google-auth-library-java/issues/3/labels',
            () => true
          )
          .reply(200);

        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              user: {
                login: 'custom-user',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
      });

      it('does not set a label on PR, if PR author is not a trusted contributor', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              user: {
                login: 'release-please[bot]',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
      });
    });
  });

  describe('with an empty configuration file', () => {
    beforeEach(() => {
      const config = fs.readFileSync(resolve(fixturesPath, 'empty.yml'));
      requests = requests
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Ftrusted-contribution.yml'
        )
        .reply(200, config);
    });

    describe('opened pull request', () => {
      it('sets a label on PR, if PR author is a trusted contributor', async () => {
        requests = requests
          .post(
            '/repos/chingor13/google-auth-library-java/issues/3/labels',
            () => true
          )
          .reply(200);

        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              user: {
                login: 'renovate-bot',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
      });

      it('does not set a label on PR, if PR author is not a trusted contributor', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              user: {
                login: 'unauthorized',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
      });
    });

    describe('updated pull request', () => {
      it('sets a label on PR, if PR author is a trusted contributor', async () => {
        requests = requests
          .post(
            '/repos/chingor13/google-auth-library-java/issues/3/labels',
            () => true
          )
          .reply(200);

        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'synchronize',
            pull_request: {
              number: 3,
              user: {
                login: 'renovate-bot',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
      });

      it('does not set a label on PR, if PR author is not a trusted contributor', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'synchronize',
            pull_request: {
              number: 3,
              user: {
                login: 'unauthorized',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
      });
    });
  });

  describe('with an empty list of contributors file', () => {
    beforeEach(() => {
      const config = fs.readFileSync(
        resolve(fixturesPath, 'no-contributors.yml')
      );
      requests = requests
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2Ftrusted-contribution.yml'
        )
        .reply(200, config);
    });

    describe('opened pull request', () => {
      it('does not set a label on PR, even if PR author is a default trusted contributor', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              user: {
                login: 'renovate-bot',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
      });

      it('does not set a label on PR, if PR author is not a trusted contributor', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              user: {
                login: 'custom-user',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
        requests.done();
      });
    });

    describe('updated pull request', () => {
      it('does not set a label on PR, even if PR author is a default trusted contributor', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'synchronize',
            pull_request: {
              number: 3,
              user: {
                login: 'renovate-bot',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
      });

      it('does not set a label on PR, if PR author is not a trusted contributor', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'synchronize',
            pull_request: {
              number: 3,
              user: {
                login: 'renovate-bot',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
          },
          id: 'abc123',
        });
        requests.done();
      });
    });
  });

  it('should add a comment if configured with annotations', async () => {
    requests
      .get(
        '/repos/chingor13/google-auth-library-java/contents/.github%2Ftrusted-contribution.yml'
      )
      .replyWithFile(200, './test/fixtures/gcbrun.yml')
      .post(
        '/repos/chingor13/google-auth-library-java/issues/3/comments',
        () => true
      )
      .reply(200);

    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'opened',
        pull_request: {
          number: 3,
          user: {
            login: 'renovate-bot',
          },
        },
        repository: {
          name: 'google-auth-library-java',
          owner: {
            login: 'chingor13',
          },
        },
      },
      id: 'abc123',
    });
    requests.done();
  });

  it('should log an error if the config cannot be fetched', async () => {
    requests = requests
      .get(
        '/repos/chingor13/google-auth-library-java/contents/.github%2Ftrusted-contribution.yml'
      )
      .reply(500);
    const errorStub = sinon.stub(logger, 'error');

    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'opened',
        pull_request: {
          number: 3,
          user: {
            login: 'not-real',
          },
        },
        repository: {
          name: 'google-auth-library-java',
          owner: {
            login: 'chingor13',
          },
        },
      },
      id: 'abc123',
    });
    assert.ok(errorStub.calledOnce);
    requests.done();
  });
});
