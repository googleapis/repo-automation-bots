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
import {
  PullRequestOpenedEvent,
  PullRequestLabeledEvent,
  PullRequestSynchronizeEvent,
} from '@octokit/webhooks-types';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import nock from 'nock';
import sinon from 'sinon';
import * as fs from 'fs';
import yaml from 'js-yaml';
import {logger} from 'gcf-utils';
import * as botConfigModule from '@google-automations/bot-config-utils';
import * as gcfUtils from 'gcf-utils';
// addOrUpdateIssueComment is exported from the primary module, but is defined in this module
import * as issueUtilsModule from '@google-automations/issue-utils/build/src/issue-comments';

import {WELL_KNOWN_CONFIGURATION_FILE} from '../src/config';
import myProbotApp from '../src/trusted-contribution';
import * as utilsModule from '../src/utils';
import schema from '../src/config-schema.json';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

function loadConfig(configFile: string) {
  return yaml.load(fs.readFileSync(resolve(fixturesPath, configFile), 'utf-8'));
}

describe('TrustedContributionTestRunner', () => {
  const sandbox = sinon.createSandbox();
  let probot: Probot;
  let requests: nock.Scope;
  let getConfigStub: sinon.SinonStub;
  let validateConfigStub: sinon.SinonStub;
  let addOrUpdateCommentStub: sinon.SinonStub;

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
    getConfigStub = sandbox.stub(botConfigModule, 'getConfig');
    validateConfigStub = sandbox.stub(
      botConfigModule.ConfigChecker.prototype,
      'validateConfigChanges'
    );
    sandbox.stub(gcfUtils, 'getAuthenticatedOctokit').resolves(new Octokit());
    addOrUpdateCommentStub = sandbox.stub(
      issueUtilsModule,
      'addOrUpdateIssueComment'
    );
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  describe('without configuration file', () => {
    beforeEach(() => {
      getConfigStub.resolves(null);
    });
    describe('opened pull request', () => {
      it('sets a label on PR, if PR author is a trusted contributor', async () => {
        requests = requests
          .get(
            '/repos/chingor13/google-auth-library-java/contents/.github%2F.OwlBot.lock.yaml'
          )
          .reply(200, 'foo')
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
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
          id: 'abc123',
        });
        requests.done();
        sinon.assert.calledOnceWithExactly(
          getConfigStub,
          sinon.match.instanceOf(Octokit),
          'chingor13',
          'google-auth-library-java',
          WELL_KNOWN_CONFIGURATION_FILE,
          {schema: schema}
        );
        sinon.assert.calledOnceWithExactly(
          validateConfigStub,
          sinon.match.instanceOf(Octokit),
          'chingor13',
          'google-auth-library-java',
          'testsha',
          3
        );
      });

      it('does not set a label on PR, if PR author is not a trusted contributor', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
          id: 'abc123',
        });
        requests.done();
      });
    });

    describe('updated pull request', () => {
      it('sets a label on PR, if PR author is a trusted contributor', async () => {
        requests = requests
          .get(
            '/repos/chingor13/google-auth-library-java/contents/.github%2F.OwlBot.lock.yaml'
          )
          .reply(200, 'foo')
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
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
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
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
          id: 'abc123',
        });
        requests.done();
      });
    });
  });

  describe('with a configuration file with disabled: true', () => {
    beforeEach(() => {
      getConfigStub.resolves(loadConfig('disabled.yml'));
    });
    describe('opened pull request', () => {
      it('quits even if PR author is a trusted contributor', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
          id: 'abc123',
        });
        requests.done();
      });
    });
  });
  describe('with a custom configuration file', () => {
    beforeEach(() => {
      getConfigStub.resolves(loadConfig('custom.yml'));
    });

    describe('opened pull request', () => {
      it('sets a label on PR, if PR author is a trusted contributor', async () => {
        requests = requests
          .get(
            '/repos/chingor13/google-auth-library-java/contents/.github%2F.OwlBot.lock.yaml'
          )
          .reply(404, 'foo')
          .post(
            '/repos/chingor13/google-auth-library-java/issues/3/labels',
            (body: object) => {
              assert.deepStrictEqual(body, {
                labels: ['kokoro:force-run'],
              });
              return true;
            }
          )
          .reply(200);

        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
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
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
          id: 'abc123',
        });
        requests.done();
      });
    });

    describe('updated pull request', () => {
      it('sets a label on PR, if PR author is a trusted contributor', async () => {
        requests = requests
          .get(
            '/repos/chingor13/google-auth-library-java/contents/.github%2F.OwlBot.lock.yaml'
          )
          .reply(200, 'foo')
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
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
          id: 'abc123',
        });
        requests.done();
      });

      it('adds owlbot:run label if OwlBot config found', async () => {
        requests = requests
          .get(
            '/repos/chingor13/google-auth-library-java/contents/.github%2F.OwlBot.lock.yaml'
          )
          .reply(200, 'foo')
          .post(
            '/repos/chingor13/google-auth-library-java/issues/3/labels',
            (body: object) => {
              assert.deepStrictEqual(body, {
                labels: ['kokoro:force-run', 'owlbot:run'],
              });
              return true;
            }
          )
          .reply(200);

        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
          id: 'abc123',
        });
        requests.done();
      });

      it('does not add owlbot:run label if OwlBot config not found', async () => {
        requests = requests
          .get(
            '/repos/chingor13/google-auth-library-java/contents/.github%2F.OwlBot.lock.yaml'
          )
          .reply(404, 'foo')
          .post(
            '/repos/chingor13/google-auth-library-java/issues/3/labels',
            (body: object) => {
              assert.deepStrictEqual(body, {
                labels: ['kokoro:force-run'],
              });
              return true;
            }
          )
          .reply(200);

        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
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
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
          id: 'abc123',
        });
        requests.done();
      });
    });
  });

  describe('with an empty configuration file', () => {
    beforeEach(() => {
      getConfigStub.resolves(loadConfig('empty.yml'));
    });

    describe('opened pull request', () => {
      it('sets a label on PR, if PR author is a trusted contributor', async () => {
        requests = requests
          .get(
            '/repos/chingor13/google-auth-library-java/contents/.github%2F.OwlBot.lock.yaml'
          )
          .reply(200, 'foo')
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
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
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
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
          id: 'abc123',
        });
        requests.done();
      });
    });

    describe('updated pull request', () => {
      it('sets a label on PR, if PR author is a trusted contributor', async () => {
        requests = requests
          .get(
            '/repos/chingor13/google-auth-library-java/contents/.github%2F.OwlBot.lock.yaml'
          )
          .reply(200, 'foo')
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
              head: {
                sha: 'testsha',
              },
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
            sender: {
              login: 'bcoe',
            },
            installation: {id: 1234},
          } as PullRequestSynchronizeEvent,
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
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestSynchronizeEvent,
          id: 'abc123',
        });
        requests.done();
      });
    });
  });

  describe('with an empty list of contributors file', () => {
    beforeEach(() => {
      getConfigStub.resolves(loadConfig('no-contributors.yml'));
    });

    describe('opened pull request', () => {
      it('does not set a label on PR, even if PR author is a default trusted contributor', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
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
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
          id: 'abc123',
        });
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
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestSynchronizeEvent,
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
              head: {
                sha: 'testsha',
              },
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
            installation: {id: 1234},
          } as PullRequestSynchronizeEvent,
          id: 'abc123',
        });
        requests.done();
      });
    });
  });

  describe('with commenting', () => {
    beforeEach(() => {
      getConfigStub.resolves(loadConfig('comments.yml'));
    });

    describe('opened pull request', () => {
      it('comments on PR, if PR author is not a trusted contributor', async () => {
        addOrUpdateCommentStub.resolves();
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              head: {
                sha: 'testsha',
              },
              user: {
                login: 'random-person',
              },
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
          id: 'abc123',
        });
        requests.done();
        sinon.assert.calledOnce(addOrUpdateCommentStub);
      });
      it('skips commenting on PR, if PR author is a collaborator', async () => {
        await probot.receive({
          name: 'pull_request',
          payload: {
            action: 'opened',
            pull_request: {
              number: 3,
              head: {
                sha: 'testsha',
              },
              user: {
                login: 'random-person',
              },
              author_association: 'COLLABORATOR',
            },
            repository: {
              name: 'google-auth-library-java',
              owner: {
                login: 'chingor13',
              },
            },
            installation: {id: 1234},
          } as PullRequestOpenedEvent,
          id: 'abc123',
        });
        requests.done();
        sinon.assert.notCalled(addOrUpdateCommentStub);
      });
    });
  });

  it('should add a comment if configured with annotations', async () => {
    getConfigStub.resolves(loadConfig('gcbrun.yml'));
    const sandbox = sinon.createSandbox();
    const getAuthenticatedOctokitStub = sandbox.stub(
      utilsModule,
      'getAuthenticatedOctokit'
    );
    const testOctokit = new Octokit();
    getAuthenticatedOctokitStub.resolves(testOctokit);
    requests
      .get(
        '/repos/chingor13/google-auth-library-java/contents/.github%2F.OwlBot.lock.yaml'
      )
      .reply(200, 'foo')
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
          head: {
            sha: 'testsha',
          },
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
        installation: {id: 1234},
      } as PullRequestOpenedEvent,
      id: 'abc123',
    });
    requests.done();
    sandbox.restore();
    sinon.assert.calledOnceWithExactly(
      getAuthenticatedOctokitStub,
      process.env.PROJECT_ID || '',
      utilsModule.SECRET_NAME_FOR_COMMENT_PERMISSION
    );
  });

  it('should log an error if the config cannot be fetched', async () => {
    getConfigStub.rejects(new Error('500'));
    const errorStub = sinon.stub(logger, 'error');

    await probot.receive({
      name: 'pull_request',
      payload: {
        action: 'opened',
        pull_request: {
          number: 3,
          head: {
            sha: 'testsha',
          },
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
        installation: {id: 1234},
      } as PullRequestOpenedEvent,
      id: 'abc123',
    });
    assert.ok(errorStub.calledOnce);
    requests.done();
  });

  describe('with alternate labels configured', () => {
    beforeEach(() => {
      getConfigStub.resolves(loadConfig('labels.yml'));
    });

    it('sets alternate labels on PR, if PR author is a trusted contributor', async () => {
      requests = requests
        .get(
          '/repos/chingor13/google-auth-library-java/contents/.github%2F.OwlBot.lock.yaml'
        )
        .reply(200, 'foo')
        .post(
          '/repos/chingor13/google-auth-library-java/issues/3/labels',
          (body: object) => {
            assert.deepStrictEqual(body, {
              labels: ['kokoro:force-run'],
            });
            return true;
          }
        )
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload: {
          action: 'opened',
          pull_request: {
            number: 3,
            head: {
              sha: 'testsha',
            },
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
          installation: {id: 1234},
        } as PullRequestOpenedEvent,
        id: 'abc123',
      });
      requests.done();
    });
  });

  describe('pull_request.labeled', () => {
    it('logs metric for pull_request.labeled, if run label is present', async () => {
      const metricStub = sandbox.stub(logger, 'metric');
      await probot.receive({
        name: 'pull_request',
        payload: {
          action: 'labeled',
          pull_request: {
            number: 3,
            head: {
              sha: 'testsha',
              repo: {
                full_name: 'googleapis/foo',
              },
            },
            base: {
              sha: 'testsha',
              repo: {
                full_name: 'googleapis/foo',
              },
            },
            user: {
              login: 'renovate-bot',
            },
            labels: [{name: 'kokoro:run'}],
          },
          repository: {
            name: 'google-auth-library-java',
            owner: {
              login: 'chingor13',
            },
          },
          sender: {
            login: 'bcoe',
          },
          installation: {id: 1234},
        } as PullRequestLabeledEvent,
        id: 'abc123',
      });
      assert.ok(metricStub.calledOnce);
    });

    it('does not log metric for pull_request.labeled, if no run label', async () => {
      const metricStub = sandbox.stub(logger, 'metric');
      await probot.receive({
        name: 'pull_request',
        payload: {
          action: 'labeled',
          pull_request: {
            number: 3,
            head: {
              sha: 'testsha',
              repo: {
                full_name: 'googleapis/foo',
              },
            },
            base: {
              sha: 'testsha',
              repo: {
                full_name: 'googleapis/foo',
              },
            },
            user: {
              login: 'renovate-bot',
            },
            labels: [{name: 'cla: yes'}],
          },
          repository: {
            name: 'google-auth-library-java',
            owner: {
              login: 'chingor13',
            },
          },
          sender: {
            login: 'bcoe',
          },
          installation: {id: 1234},
        } as PullRequestLabeledEvent,
        id: 'abc123',
      });
      assert.ok(metricStub.notCalled);
    });

    it('does not log metric for pull_request.labeled, of label added to external PR', async () => {
      const metricStub = sandbox.stub(logger, 'metric');
      await probot.receive({
        name: 'pull_request',
        payload: {
          action: 'labeled',
          pull_request: {
            number: 3,
            head: {
              sha: 'testsha',
              repo: {
                full_name: 'googleapis/foo',
              },
            },
            base: {
              sha: 'testsha',
              repo: {
                full_name: 'external/foo',
              },
            },
            user: {
              login: 'renovate-bot',
            },
            labels: [{name: 'kokoro:run'}],
          },
          repository: {
            name: 'google-auth-library-java',
            owner: {
              login: 'chingor13',
            },
          },
          sender: {
            login: 'bcoe',
          },
          installation: {id: 1234},
        } as PullRequestLabeledEvent,
        id: 'abc123',
      });
      assert.ok(metricStub.notCalled);
    });
  });
});
