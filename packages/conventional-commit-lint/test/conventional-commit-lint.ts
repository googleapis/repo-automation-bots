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

/* eslint-disable @typescript-eslint/no-var-requires */

import * as configUtilsModule from '@google-automations/bot-config-utils';
import * as issueUtilsModule from '@google-automations/issue-utils';
import {ConfigChecker} from '@google-automations/bot-config-utils';
import {logger} from 'gcf-utils';
import {readFileSync} from 'fs';
import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, ProbotOctokit} from 'probot';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {describe, it, beforeEach, afterEach} from 'mocha';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as assert from 'assert';
import * as gcfUtilsModule from 'gcf-utils';
import * as sinon from 'sinon';
import yaml from 'js-yaml';

import myProbotApp from '../src/conventional-commit-lint';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');
function loadConfig(configFile: string) {
  return yaml.load(
    readFileSync(resolve(fixturesPath, 'config', configFile), 'utf-8')
  );
}

describe('ConventionalCommitLint', () => {
  let probot: Probot;
  const sandbox = sinon.createSandbox();
  let addOrUpdateIssueCommentStub: sinon.SinonStub;
  let getAuthenticatedOctokitStub: sinon.SinonStub;
  const pr11 = require(resolve(fixturesPath, './pr11'));

  function stubConfig(config_file = 'valid.yaml') {
    // Stub loading valid config from repository:
    const getConfigWithDefaultStub = sandbox.stub(
      configUtilsModule,
      'getConfigWithDefault'
    );
    getConfigWithDefaultStub.resolves(loadConfig(config_file));
    // Stub a valid config update in the PR:
    const validateConfigStub = sandbox.stub(
      ConfigChecker.prototype,
      'validateConfigChanges'
    );
    validateConfigStub.resolves(true);
  }

  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      }),
    });
    probot.load(myProbotApp);
    addOrUpdateIssueCommentStub = sandbox.stub(
      issueUtilsModule,
      'addOrUpdateIssueComment'
    );
    getAuthenticatedOctokitStub = sandbox.stub(
      gcfUtilsModule,
      'getAuthenticatedOctokit'
    );
    getAuthenticatedOctokitStub.resolves(new Octokit());
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  it('sets a "failure" context on PR, if commits fail linting', async () => {
    stubConfig();
    addOrUpdateIssueCommentStub.resolves(null);
    const pr11WithBadMessage = require(resolve(
      fixturesPath,
      './pr11WithBadMessage'
    ));
    const payload = require(resolve(
      fixturesPath,
      './pull_request_synchronize_bad_message'
    ));
    const invalidCommits = [
      ...require(resolve(fixturesPath, './invalid_commit')),
    ];
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
      .reply(200, invalidCommits)
      .get('/repos/bcoe/test-release-please/pulls/11')
      .reply(200, pr11WithBadMessage)
      .post('/repos/bcoe/test-release-please/check-runs', body => {
        snapshot(body);
        return true;
      })
      .reply(200);
    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    requests.done();
    sinon.assert.notCalled(addOrUpdateIssueCommentStub);
  });

  it('adds a comment when the commit message and the PR title differ', async () => {
    stubConfig();
    addOrUpdateIssueCommentStub.resolves(null);
    const pr11WithCorrectMessage = require(resolve(
      fixturesPath,
      './pr11WithCorrectMessage'
    ));
    const payload = require(resolve(
      fixturesPath,
      './pull_request_synchronize_valid_message'
    ));
    const invalidCommits = [
      ...require(resolve(fixturesPath, './invalid_commit')),
    ];
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
      .reply(200, invalidCommits)
      .get('/repos/bcoe/test-release-please/pulls/11')
      .reply(200, pr11WithCorrectMessage)
      .post('/repos/bcoe/test-release-please/check-runs', body => {
        snapshot(body);
        return true;
      })
      .reply(200);
    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    requests.done();
    sinon.assert.calledOnce(addOrUpdateIssueCommentStub);
  });

  it('should post "success" context on PR with always_check_pr_title set to true', async () => {
    stubConfig('always_check_pr_title.yaml');
    addOrUpdateIssueCommentStub.resolves(null);
    const pr11WithCorrectMessage = require(resolve(
      fixturesPath,
      './pr11WithCorrectMessage'
    ));
    const payload = require(resolve(
      fixturesPath,
      './pull_request_synchronize_valid_message'
    ));
    const invalidCommits = [
      ...require(resolve(fixturesPath, './invalid_commit')),
    ];
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
      .reply(200, invalidCommits)
      .get('/repos/bcoe/test-release-please/pulls/11')
      .reply(200, pr11WithCorrectMessage)
      .post('/repos/bcoe/test-release-please/check-runs', body => {
        assert.equal(body.conclusion, 'success');
        return true;
      })
      .reply(200);
    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    requests.done();
  });

  it('should post "failure" context on PR with always_check_pr_title set to true', async () => {
    stubConfig('always_check_pr_title.yaml');
    const payload = require(resolve(
      fixturesPath,
      './pull_request_synchronize_bad_message'
    ));
    const validCommits = [...require(resolve(fixturesPath, './valid_commit'))];

    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
      .reply(200, validCommits)
      .get('/repos/bcoe/test-release-please/pulls/11')
      .reply(200, pr11)
      .post('/repos/bcoe/test-release-please/check-runs', body => {
        assert.equal(body.conclusion, 'failure');
        return true;
      })
      .reply(200);

    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    requests.done();
  });

  it('sets a "success" context on PR, if commit lint succeeds', async () => {
    stubConfig();
    const payload = require(resolve(
      fixturesPath,
      './pull_request_synchronize'
    ));
    const validCommits = [...require(resolve(fixturesPath, './valid_commit'))];

    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
      .reply(200, validCommits)
      .get('/repos/bcoe/test-release-please/pulls/11')
      .reply(200, pr11)
      .post('/repos/bcoe/test-release-please/check-runs', body => {
        snapshot(body);
        return true;
      })
      .reply(200);

    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    requests.done();
  });

  it('should handle a PR with no commits', async () => {
    stubConfig();
    const payload = require(resolve(
      fixturesPath,
      './pull_request_synchronize'
    ));
    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
      .reply(200, []);
    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    requests.done();
  });

  describe('PR With Multiple Commits', () => {
    it('has a valid pull request title', async () => {
      stubConfig();
      const payload = require(resolve(
        fixturesPath,
        './pull_request_synchronize'
      ));
      // create a history that has one valid commit, and one invalid commit:
      const invalidCommits = [
        ...require(resolve(fixturesPath, './invalid_commit')),
      ];
      // eslint-disable-next-line prefer-spread
      invalidCommits.push.apply(
        invalidCommits,
        require(resolve(fixturesPath, './valid_commit'))
      );

      const requests = nock('https://api.github.com')
        .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
        .reply(200, invalidCommits)
        .get('/repos/bcoe/test-release-please/pulls/11')
        .reply(200, pr11)
        .post('/repos/bcoe/test-release-please/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('has an invalid pull request title', async () => {
      stubConfig();
      const payload = require(resolve(
        fixturesPath,
        './pull_request_synchronize_invalid_title'
      ));
      // create a history that has one valid commit, and one invalid commit:
      const invalidCommits = [
        ...require(resolve(fixturesPath, './invalid_commit')),
      ];
      // eslint-disable-next-line prefer-spread
      invalidCommits.push.apply(
        invalidCommits,
        require(resolve(fixturesPath, './valid_commit'))
      );

      const requests = nock('https://api.github.com')
        .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
        .reply(200, invalidCommits)
        .get('/repos/bcoe/test-release-please/pulls/11')
        .reply(200, pr11)
        .post('/repos/bcoe/test-release-please/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('has a valid title, invalid commit, automerge label', async () => {
      stubConfig();
      const payload = require(resolve(
        fixturesPath,
        './pull_request_automerge'
      ));
      // create a history that has one valid commit, and one invalid commit:
      const invalidCommit = require(resolve(fixturesPath, './invalid_commit'));
      const requests = nock('https://api.github.com')
        .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
        .reply(200, invalidCommit)
        .get('/repos/bcoe/test-release-please/pulls/11')
        .reply(200, pr11)
        .post('/repos/bcoe/test-release-please/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('has a valid title, invalid commit, automerge: exact label', async () => {
      stubConfig();
      const payload = require(resolve(
        fixturesPath,
        './pull_request_automerge_exact'
      ));
      // create a history that has one valid commit, and one invalid commit:
      const invalidCommit = require(resolve(fixturesPath, './invalid_commit'));
      const requests = nock('https://api.github.com')
        .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
        .reply(200, invalidCommit)
        .get('/repos/bcoe/test-release-please/pulls/11')
        .reply(200, pr11)
        .post('/repos/bcoe/test-release-please/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('has a valid title, invalid commit, automerge enabled', async () => {
      stubConfig();
      const payload = require(resolve(
        fixturesPath,
        './pull_request_synchronize'
      ));
      // create a history that has one valid commit, and one invalid commit:
      const invalidCommit = require(resolve(fixturesPath, './invalid_commit'));
      const requests = nock('https://api.github.com')
        .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
        .reply(200, invalidCommit)
        .get('/repos/bcoe/test-release-please/pulls/11')
        .reply(200, {auto_merge: {merge_method: 'squash'}})
        .post('/repos/bcoe/test-release-please/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });
  });

  it('sets a "success" context on PR with very long lines', async () => {
    stubConfig();
    const payload = require(resolve(
      fixturesPath,
      './pull_request_synchronize'
    ));
    const validCommits = [
      ...require(resolve(fixturesPath, './commit_with_long_body_line_length')),
    ];

    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
      .reply(200, validCommits)
      .get('/repos/bcoe/test-release-please/pulls/11')
      .reply(200, pr11)
      .post('/repos/bcoe/test-release-please/check-runs', body => {
        snapshot(body);
        return true;
      })
      .reply(200);

    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    requests.done();
  });

  it('sets a "success" context on PR, if subject contains a full stop', async () => {
    stubConfig();
    const payload = require(resolve(
      fixturesPath,
      './pull_request_synchronize'
    ));
    const validCommits = [
      ...require(resolve(fixturesPath, './commit_with_full_stop_in_subject')),
    ];

    const requests = nock('https://api.github.com')
      .get('/repos/bcoe/test-release-please/pulls/11/commits?per_page=100')
      .reply(200, validCommits)
      .get('/repos/bcoe/test-release-please/pulls/11')
      .reply(200, pr11)
      .post('/repos/bcoe/test-release-please/check-runs', body => {
        snapshot(body);
        return true;
      })
      .reply(200);

    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    requests.done();
  });

  it('should abort immediately if "enabled" is false', async () => {
    // Stub logger (used in assertion):
    const loggerStub = sandbox.stub(logger, 'info');
    // Stub loading configuration from repo:
    const getConfigWithDefaultStub = sandbox.stub(
      configUtilsModule,
      'getConfigWithDefault'
    );
    getConfigWithDefaultStub.resolves(loadConfig('enabled-false.yaml'));

    // Stub a valid config update in the PR:
    const validateConfigStub = sandbox.stub(
      ConfigChecker.prototype,
      'validateConfigChanges'
    );
    validateConfigStub.resolves(true);

    const payload = require(resolve(
      fixturesPath,
      './pull_request_synchronize'
    ));
    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    sandbox.assert.calledWith(
      loggerStub,
      sandbox.match(/.*linting not enabled.*/)
    );
  });

  it('should abort immediately if PR contains update with bad bot configuration', async () => {
    // Stub logger (used in assertion):
    const loggerStub = sandbox.stub(logger, 'warn');
    // Stub loading valid config from repository:
    const getConfigWithDefaultStub = sandbox.stub(
      configUtilsModule,
      'getConfigWithDefault'
    );
    getConfigWithDefaultStub.resolves(loadConfig('valid.yaml'));
    // Stub a valid config update in the PR:
    const validateConfigStub = sandbox.stub(
      ConfigChecker.prototype,
      'validateConfigChanges'
    );
    validateConfigStub.resolves(false);
    const payload = require(resolve(
      fixturesPath,
      './pull_request_synchronize'
    ));
    await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    sandbox.assert.calledWith(
      loggerStub,
      sandbox.match(/.*Invalid config file.*/)
    );
  });
});
