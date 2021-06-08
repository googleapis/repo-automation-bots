// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable node/no-extraneous-import */

import myProbotApp from '../src/snippet-bot';
import {SNIPPET_BOT_LABELS} from '../src/labels';
import * as apiLabelsModule from '../src/api-labels';
import * as snippetsModule from '../src/snippets';
import {CONFIGURATION_FILE_PATH} from '../src/configuration';
import {Snippets} from '../src/snippets';

import * as configUtilsModule from '@google-automations/bot-config-utils';
import * as labelUtilsModule from '@google-automations/label-utils';
import {ConfigChecker} from '@google-automations/bot-config-utils';
import {resolve} from 'path';
import {Probot, ProbotOctokit} from 'probot';
import {Octokit} from '@octokit/rest';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';
import {describe, it, beforeEach, afterEach} from 'mocha';
import * as sinon from 'sinon';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

function createConfigResponse(configFile: string) {
  const config = fs.readFileSync(resolve(fixturesPath, configFile));
  const base64Config = config.toString('base64');
  return {
    sha: '',
    node_id: '',
    size: base64Config.length,
    url: '',
    content: base64Config,
    encoding: 'base64',
  };
}

describe('snippet-bot scheduler handler', () => {
  let probot: Probot;
  const sandbox = sinon.createSandbox();
  let getConfigStub: sinon.SinonStub;
  let syncLabelsStub: sinon.SinonStub;

  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      }),
    });
    probot.load(myProbotApp);
    getConfigStub = sandbox.stub(configUtilsModule, 'getConfig');
    syncLabelsStub = sandbox.stub(labelUtilsModule, 'syncLabels');
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  it('does not call syncLabels for repos without the config', async () => {
    getConfigStub.resolves(null);
    await probot.receive({
      name: 'schedule.repository' as '*',
      payload: {
        repository: {
          name: 'testRepo',
          owner: {
            login: 'testOwner',
          },
        },
        organization: {
          login: 'googleapis',
        },
      },
      id: 'abc123',
    });
    getConfigStub.calledOnceWith(
      sinon.match.instanceOf(Octokit),
      'testOwner',
      'testRepo',
      CONFIGURATION_FILE_PATH
    );
    sinon.assert.notCalled(syncLabelsStub);
  });
  it('calls syncLabels for repos with the config', async () => {
    getConfigStub.resolves({
      alwaysCreateStatusCheck: false,
      ignoreFiles: [],
    });
    await probot.receive({
      name: 'schedule.repository' as '*',
      payload: {
        repository: {
          name: 'testRepo',
          owner: {
            login: 'testOwner',
          },
        },
        organization: {
          login: 'googleapis',
        },
      },
      id: 'abc123',
    });
    getConfigStub.calledOnceWith(
      sinon.match.instanceOf(Octokit),
      'testOwner',
      'testRepo',
      CONFIGURATION_FILE_PATH
    );
    syncLabelsStub.calledOnceWith(
      sinon.match.instanceOf(Octokit),
      'testOwner',
      'testRepo',
      SNIPPET_BOT_LABELS
    );
  });
});

describe('snippet-bot config validation', () => {
  let probot: Probot;
  const sandbox = sinon.createSandbox();

  let getApiLabelsStub: sinon.SinonStub<[string], Promise<{}>>;
  let getSnippetsStub: sinon.SinonStub<[string], Promise<Snippets>>;
  let getConfigStub: sinon.SinonStub;

  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      }),
    });
    probot.load(myProbotApp);
    getApiLabelsStub = sandbox.stub(apiLabelsModule, 'getApiLabels');
    const products = require(resolve(fixturesPath, './products'));
    getApiLabelsStub.resolves(products);
    const testSnippets = {};
    getSnippetsStub = sandbox.stub(snippetsModule, 'getSnippets');
    getSnippetsStub.resolves(testSnippets);
    getConfigStub = sandbox.stub(configUtilsModule, 'getConfig');
    getConfigStub.resolves({ignoreFiles: ['ignore.py']});
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  it('submits a failing check with a broken config file', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const payload = require(resolve(fixturesPath, './pr_event'));
    const files_payload = require(resolve(
      fixturesPath,
      './pr_files_config_added'
    ));

    const configBlob = createConfigResponse('broken_config.yaml');
    const requests = nock('https://api.github.com')
      .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
      .reply(200, files_payload)
      .get(
        '/repos/tmatsuo/repo-automation-bots/git/blobs/223828dbd668486411b475665ab60855ba9898f3'
      )
      .reply(200, configBlob)
      .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
        snapshot(body);
        return true;
      })
      .reply(200);

    const diffRequests = nock('https://github.com')
      .get('/tmatsuo/repo-automation-bots/pull/14.diff')
      .reply(404, {});

    await probot.receive({
      name: 'pull_request',
      payload,
      id: 'abc123',
    });

    requests.done();
    diffRequests.done();
  });
  it('does not submits a failing check with a correct config file', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const payload = require(resolve(fixturesPath, './pr_event'));
    const files_payload = require(resolve(
      fixturesPath,
      './pr_files_config_added'
    ));

    const configBlob = createConfigResponse('correct_config.yaml');
    const requests = nock('https://api.github.com')
      .get('/repos/tmatsuo/repo-automation-bots/pulls/14/files?per_page=100')
      .reply(200, files_payload)
      .get(
        '/repos/tmatsuo/repo-automation-bots/git/blobs/223828dbd668486411b475665ab60855ba9898f3'
      )
      .reply(200, configBlob);

    const diffRequests = nock('https://github.com')
      .get('/tmatsuo/repo-automation-bots/pull/14.diff')
      .reply(404, {});

    await probot.receive({
      name: 'pull_request',
      payload,
      id: 'abc123',
    });

    requests.done();
    diffRequests.done();
  });
});

describe('snippet-bot bot-config-utils integration', () => {
  let probot: Probot;

  const sandbox = sinon.createSandbox();

  let getApiLabelsStub: sinon.SinonStub<[string], Promise<{}>>;
  let getSnippetsStub: sinon.SinonStub<[string], Promise<Snippets>>;
  let validateConfigStub: sinon.SinonStub;

  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      }),
    });
    probot.load(myProbotApp);
    getApiLabelsStub = sandbox.stub(apiLabelsModule, 'getApiLabels');
    const products = require(resolve(fixturesPath, './products'));
    getApiLabelsStub.resolves(products);
    const testSnippets = {};
    getSnippetsStub = sandbox.stub(snippetsModule, 'getSnippets');
    getSnippetsStub.resolves(testSnippets);
    validateConfigStub = sandbox.stub(
      ConfigChecker.prototype,
      'validateConfigChanges'
    );
    validateConfigStub.resolves(undefined);
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  it('survives config validation with an empty config file', async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const payload = require(resolve(fixturesPath, './pr_event'));

    const scopes = [
      nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/.github%2Fsnippet-bot.yml'
        )
        .reply(200, createConfigResponse('empty.yaml')),
      nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(404, {}),
    ];

    await probot.receive({
      name: 'pull_request',
      payload,
      id: 'abc123',
    });

    sinon.assert.calledOnceWithExactly(
      validateConfigStub,
      sinon.match.instanceOf(ProbotOctokit),
      'tmatsuo',
      'repo-automation-bots',
      'ce03c1b7977aadefb5f6afc09901f106ee6ece6a',
      14
    );
    for (const scope of scopes) {
      scope.done();
    }
  });
});

describe('snippet-bot', () => {
  let probot: Probot;

  const tarBall = fs.readFileSync(
    resolve(fixturesPath, 'tmatsuo-python-docs-samples-abcde.tar.gz')
  );

  const sandbox = sinon.createSandbox();

  let getApiLabelsStub: sinon.SinonStub<[string], Promise<{}>>;
  let getSnippetsStub: sinon.SinonStub<[string], Promise<Snippets>>;
  let invalidateCacheStub: sinon.SinonStub;
  let getConfigStub: sinon.SinonStub;
  let validateConfigStub: sinon.SinonStub;

  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      }),
    });
    probot.load(myProbotApp);
    getApiLabelsStub = sandbox.stub(apiLabelsModule, 'getApiLabels');
    const products = require(resolve(fixturesPath, './products'));
    getApiLabelsStub.resolves(products);
    const testSnippets = {};
    getSnippetsStub = sandbox.stub(snippetsModule, 'getSnippets');
    getSnippetsStub.resolves(testSnippets);
    getConfigStub = sandbox.stub(configUtilsModule, 'getConfig');
    getConfigStub.resolves({ignoreFiles: ['ignore.py']});
    validateConfigStub = sandbox.stub(
      ConfigChecker.prototype,
      'validateConfigChanges'
    );
    validateConfigStub.resolves(undefined);
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('responds to PR', () => {
    it('quits early', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(fixturesPath, './pr_event'));

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(404, {});

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      diffRequests.done();
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
      validateConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        'ce03c1b7977aadefb5f6afc09901f106ee6ece6a',
        14
      );
    });

    it('quits early for PRs with null head', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(fixturesPath, './pr_event_null_head'));

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
    });

    it('quits early if PR is closed', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(fixturesPath, './pr_event_closed'));

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
    });

    it('sets a "failure" context on PR without a warning about removal of region tags in use', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const diffResponse = fs.readFileSync(resolve(fixturesPath, 'diff.txt'));
      const payload = require(resolve(fixturesPath, './pr_event'));
      const blob = require(resolve(fixturesPath, './failure_blob'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/test.py?ref=ce03c1b7977aadefb5f6afc09901f106ee6ece6a'
        )
        .reply(200, blob)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments?per_page=50'
        )
        .reply(200, [])
        .post(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, diffResponse);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
      diffRequests.done();
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });

    it('quits early for normal labels', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(
        fixturesPath,
        './pr_event_label_ignored'
      ));
      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });

    it('responds to snippet-bot:force-run label, invalidating the Snippet cache', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      invalidateCacheStub = sandbox.stub(snippetsModule, 'invalidateCache');
      const diffResponse = fs.readFileSync(resolve(fixturesPath, 'diff.txt'));
      const payload = require(resolve(fixturesPath, './pr_event_label_added'));
      const blob = require(resolve(fixturesPath, './failure_blob'));

      const requests = nock('https://api.github.com')
        .delete(
          // For removing the label.
          '/repos/tmatsuo/repo-automation-bots/issues/14/labels/snippet-bot%3Aforce-run'
        )
        .reply(200)
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/test.py?ref=ce03c1b7977aadefb5f6afc09901f106ee6ece6a'
        )
        .reply(200, blob)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments?per_page=50'
        )
        .reply(200, [])
        .post(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, diffResponse);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(invalidateCacheStub);
      requests.done();
      diffRequests.done();
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });

    it('quits early for an irelevant issue_comment.edited event', async () => {
      const payload = require(resolve(
        fixturesPath,
        './pr_event_comment_edited_irelevant'
      ));
      await probot.receive({
        name: 'issue_comment.edited',
        payload,
        id: 'abc123',
      });
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });

    it('responds to refresh checkbox, invalidating the Snippet cache, updating without region tag changes', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      invalidateCacheStub = sandbox.stub(snippetsModule, 'invalidateCache');
      const payload = require(resolve(
        fixturesPath,
        './pr_event_comment_edited'
      ));
      const prResponse = require(resolve(fixturesPath, './pr_response'));

      const requests = nock('https://api.github.com')
        .get('/repos/tmatsuo/repo-automation-bots/pulls/14')
        .reply(200, prResponse)

        .get(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments?per_page=50'
        )
        .reply(200, [])
        .post(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, '');

      await probot.receive({
        name: 'issue_comment.edited',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(invalidateCacheStub);
      requests.done();
      diffRequests.done();
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });

    it('ignores 404 error upon label deletion', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const diffResponse = fs.readFileSync(resolve(fixturesPath, 'diff.txt'));
      const payload = require(resolve(fixturesPath, './pr_event_label_added'));
      const blob = require(resolve(fixturesPath, './failure_blob'));

      const requests = nock('https://api.github.com')
        .delete(
          // For removing the label.
          '/repos/tmatsuo/repo-automation-bots/issues/14/labels/snippet-bot%3Aforce-run'
        )
        .reply(404)
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/test.py?ref=ce03c1b7977aadefb5f6afc09901f106ee6ece6a'
        )
        .reply(200, blob)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments?per_page=50'
        )
        .reply(200, [])
        .post(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, diffResponse);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
      diffRequests.done();
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });

    it('does not submit a check for unmatched region tags on PR if there are no region tags', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const diffResponse = fs.readFileSync(resolve(fixturesPath, 'diff.txt'));
      const payload = require(resolve(fixturesPath, './pr_event'));
      const blob = require(resolve(fixturesPath, './blob_no_region_tags'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/test.py?ref=ce03c1b7977aadefb5f6afc09901f106ee6ece6a'
        )
        .reply(200, blob)
        .get(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments?per_page=50'
        )
        .reply(200, [])
        .post(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, diffResponse);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
      diffRequests.done();
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });

    it('does not submit a check on PR by ignoreFile', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const diffResponse = fs.readFileSync(resolve(fixturesPath, 'diff.txt'));
      const payload = require(resolve(fixturesPath, './pr_event'));

      getConfigStub.reset();
      getConfigStub.resolves({ignoreFiles: ['test.py']});

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments?per_page=50'
        )
        .reply(200, [])
        .post(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, diffResponse);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
      diffRequests.done();
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });

    it('submits 3 checks on PR because alwaysCreateStatusCheck is true', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const diffResponse = fs.readFileSync(
        resolve(fixturesPath, 'diff_without_regiontag_changes.txt')
      );
      const payload = require(resolve(fixturesPath, './pr_event'));

      getConfigStub.reset();
      getConfigStub.resolves({
        ignoreFiles: ['test.py'],
        alwaysCreateStatusCheck: true,
      });

      const requests = nock('https://api.github.com')
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments?per_page=50'
        )
        .reply(200, [])
        .post(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, diffResponse);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
      diffRequests.done();
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });

    it('agggregates 3 checks into one because aggregateChecks is true', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const diffResponse = fs.readFileSync(
        resolve(fixturesPath, 'diff_without_regiontag_changes.txt')
      );
      const payload = require(resolve(fixturesPath, './pr_event'));

      getConfigStub.reset();
      getConfigStub.resolves({
        ignoreFiles: ['test.py'],
        aggregateChecks: true,
      });

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments?per_page=50'
        )
        .reply(200, [])
        .post(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, diffResponse);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      requests.done();
      diffRequests.done();
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });

    it('quits early if there is no config file', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(fixturesPath, './pr_event'));
      getConfigStub.reset();
      getConfigStub.resolves(null);
      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      // Make sure we check the config schema when
      // adding the config file for the first time.
      validateConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        'ce03c1b7977aadefb5f6afc09901f106ee6ece6a',
        14
      );
    });

    it('gives warnings about removing region tag in use', async () => {
      getApiLabelsStub.reset();
      const products = require(resolve(fixturesPath, './products'));
      getApiLabelsStub.resolves(products);

      getSnippetsStub.reset();
      const snippets = require(resolve(fixturesPath, './snippets'));
      getSnippetsStub.resolves(snippets);

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const diffResponse = fs.readFileSync(resolve(fixturesPath, 'diff.txt'));
      const payload = require(resolve(fixturesPath, './pr_event'));
      const blob = require(resolve(fixturesPath, './failure_blob'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/test.py?ref=ce03c1b7977aadefb5f6afc09901f106ee6ece6a'
        )
        .reply(200, blob)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments?per_page=50'
        )
        .reply(200, [])
        .post(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, diffResponse);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(getApiLabelsStub);
      sinon.assert.calledOnce(getSnippetsStub);
      requests.done();
      diffRequests.done();
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });

    it('creates failure check with combined results', async () => {
      getApiLabelsStub.reset();
      const products = require(resolve(fixturesPath, './products'));
      getApiLabelsStub.resolves(products);

      getSnippetsStub.reset();
      const snippets = require(resolve(fixturesPath, './snippets'));
      getSnippetsStub.resolves(snippets);
      getConfigStub.reset();
      getConfigStub.resolves({aggregateChecks: true});

      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const diffResponse = fs.readFileSync(resolve(fixturesPath, 'diff.txt'));
      const payload = require(resolve(fixturesPath, './pr_event'));
      const blob = require(resolve(fixturesPath, './failure_blob'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/test.py?ref=ce03c1b7977aadefb5f6afc09901f106ee6ece6a'
        )
        .reply(200, blob)
        .get(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments?per_page=50'
        )
        .reply(200, [])
        .post(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, diffResponse);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(getApiLabelsStub);
      sinon.assert.calledOnce(getSnippetsStub);
      requests.done();
      diffRequests.done();
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });

    it('does not give warnings about wrong product prefix with snippet-bot:no-prefix-req label', async () => {
      getSnippetsStub.reset();
      const snippets = require(resolve(fixturesPath, './snippets'));
      getSnippetsStub.resolves(snippets);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const diffResponse = fs.readFileSync(resolve(fixturesPath, 'diff.txt'));
      const payload = require(resolve(
        fixturesPath,
        './pr_event_no_prefix_req'
      ));
      const blob = require(resolve(fixturesPath, './failure_blob'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/test.py?ref=ce03c1b7977aadefb5f6afc09901f106ee6ece6a'
        )
        .reply(200, blob)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments?per_page=50'
        )
        .reply(200, [])
        .post(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, diffResponse);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(getSnippetsStub);
      requests.done();
      diffRequests.done();
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });

    it('gives fyi message for removing frozen region tag', async () => {
      getApiLabelsStub.reset();
      const products = require(resolve(fixturesPath, './products'));

      getApiLabelsStub.resolves(products);

      getSnippetsStub.reset();
      const snippets = require(resolve(fixturesPath, './snippets-frozen'));
      getSnippetsStub.resolves(snippets);
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const diffResponse = fs.readFileSync(resolve(fixturesPath, 'diff.txt'));
      const payload = require(resolve(fixturesPath, './pr_event'));
      const blob = require(resolve(fixturesPath, './failure_blob'));

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/repo-automation-bots/contents/test.py?ref=ce03c1b7977aadefb5f6afc09901f106ee6ece6a'
        )
        .reply(200, blob)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments?per_page=50'
        )
        .reply(200, [])
        .post(
          '/repos/tmatsuo/repo-automation-bots/issues/14/comments',
          body => {
            snapshot(body);
            return true;
          }
        )
        .reply(200)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .post('/repos/tmatsuo/repo-automation-bots/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      const diffRequests = nock('https://github.com')
        .get('/tmatsuo/repo-automation-bots/pull/14.diff')
        .reply(200, diffResponse);

      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(getApiLabelsStub);
      sinon.assert.calledOnce(getSnippetsStub);
      requests.done();
      diffRequests.done();
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });
  });

  describe('responds to issue', () => {
    it('quits early because issue title does not contain the command', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(fixturesPath, './issue_event_no_scan'));

      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });

    it('reports failure upon download failure', async () => {
      const payload = require(resolve(fixturesPath, './issue_event'));

      const requests = nock('https://api.github.com')
        .patch('/repos/tmatsuo/python-docs-samples/issues/10', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      const tarBallRequests = nock('https://github.com')
        .get('/tmatsuo/python-docs-samples/tarball/master')
        .reply(403, 'Error');

      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });

      requests.done();
      tarBallRequests.done();
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });
    it('reports the scan result', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const payload = require(resolve(fixturesPath, './issue_event'));

      const requests = nock('https://api.github.com')
        .patch('/repos/tmatsuo/python-docs-samples/issues/10', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      const tarBallRequests = nock('https://github.com')
        .get('/tmatsuo/python-docs-samples/tarball/master')
        .reply(200, tarBall, {
          'Content-Type': 'application/tar+gzip',
        });

      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });

      requests.done();
      tarBallRequests.done();
      getConfigStub.calledOnceWith(
        sinon.match.instanceOf(Octokit),
        'tmatsuo',
        'repo-automation-bots',
        CONFIGURATION_FILE_PATH
      );
    });
  });
});
