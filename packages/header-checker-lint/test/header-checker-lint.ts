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

import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import snapshot from 'snap-shot-it';
// eslint-disable-next-line node/no-extraneous-import
import {EventPayloads} from '@octokit/webhooks';
import nock from 'nock';
import {describe, it, beforeEach, before} from 'mocha';
import * as sinon from 'sinon';
import * as botConfigUtilsModule from '@google-automations/bot-config-utils';
import {ConfigChecker} from '@google-automations/bot-config-utils';

import {WELL_KNOWN_CONFIGURATION_FILE} from '../src/config';
import myProbotApp from '../src/header-checker-lint';
import schema from '../src/config-schema.json';

const fixturesPath = resolve(__dirname, '../../test/fixtures');
nock.disableNetConnect();

describe('HeaderCheckerLint', () => {
  let probot: Probot;
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
  });

  describe('opened pull request', () => {
    let payload: EventPayloads.WebhookPayloadPullRequest;
    const sandbox = sinon.createSandbox();
    let getConfigStub: sinon.SinonStub;
    let validateConfigStub: sinon.SinonStub;
    let checkerGetConfigStub: sinon.SinonStub;

    beforeEach(() => {
      payload = require(resolve(fixturesPath, './pull_request_opened'));
      getConfigStub = sandbox.stub(botConfigUtilsModule, 'getConfig');
      validateConfigStub = sandbox.stub(
        ConfigChecker.prototype,
        'validateConfigChanges'
      );
      checkerGetConfigStub = sandbox.stub(ConfigChecker.prototype, 'getConfig');
      validateConfigStub.resolves(undefined);
    });

    afterEach(() => {
      nock.cleanAll();
      sandbox.restore();
    });

    it('sets a "failure" context on PR, if new source file is missing license', async () => {
      checkerGetConfigStub.returns(null);
      getConfigStub.resolves(null);
      const invalidFiles = require(resolve(
        fixturesPath,
        './missing_license_added'
      ));
      const blob = require(resolve(fixturesPath, './missing_license'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, invalidFiles)
        .get(
          '/repos/chingor13/google-auth-library-java/git/blobs/5b414a072e40622c177c72a58efb74ff9faadd0d'
        )
        .reply(200, blob)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
      // These asserts are just enough for once.
      sinon.assert.calledOnceWithExactly(
        getConfigStub,
        sinon.match.instanceOf(ProbotOctokit),
        'chingor13',
        'google-auth-library-java',
        WELL_KNOWN_CONFIGURATION_FILE,
        {schema: schema}
      );
      sinon.assert.calledOnceWithExactly(
        validateConfigStub,
        sinon.match.instanceOf(ProbotOctokit),
        'chingor13',
        'google-auth-library-java',
        '87139750cdcf551e8fe8d90c129527a4f358321c',
        3
      );
    });

    it('sets a "failure" context on PR, if a modified source file is missing license', async () => {
      checkerGetConfigStub.returns(null);
      getConfigStub.resolves(null);
      const invalidFiles = require(resolve(
        fixturesPath,
        './missing_license_modified'
      ));
      const blob = require(resolve(fixturesPath, './missing_license'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, invalidFiles)
        .get(
          '/repos/chingor13/google-auth-library-java/git/blobs/5b414a072e40622c177c72a58efb74ff9faadd0d'
        )
        .reply(200, blob)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('sets a "failure" context on PR, if the new source file is added and has wrong year', async () => {
      checkerGetConfigStub.returns(null);
      getConfigStub.resolves(null);
      const invalidFiles = require(resolve(fixturesPath, './wrong_year_added'));
      const blob = require(resolve(fixturesPath, './wrong_year'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, invalidFiles)
        .get(
          '/repos/chingor13/google-auth-library-java/git/blobs/ef039bb72b6cadc9c144541a5645e4a6818fb6de'
        )
        .reply(200, blob)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('sets a "failure" context on PR, if the source file is missing copyright', async () => {
      checkerGetConfigStub.returns(null);
      getConfigStub.resolves(null);
      const invalidFiles = require(resolve(
        fixturesPath,
        './missing_copyright_added'
      ));
      const blob = require(resolve(fixturesPath, './missing_copyright'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, invalidFiles)
        .get(
          '/repos/chingor13/google-auth-library-java/git/blobs/f5ed0eb2e52ccb7b02ff208a2b392161d92dd768'
        )
        .reply(200, blob)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('sets a "failure" context on PR, if the source file has an invalid copyright holder', async () => {
      checkerGetConfigStub.returns(null);
      getConfigStub.resolves(null);
      const invalidFiles = require(resolve(
        fixturesPath,
        './invalid_copyright_added'
      ));
      const blob = require(resolve(fixturesPath, './invalid_copyright'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, invalidFiles)
        .get(
          '/repos/chingor13/google-auth-library-java/git/blobs/68383638d3661e3989b1119b2a7ef414aabb4f6d'
        )
        .reply(200, blob)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('reads a custom configuration file', async () => {
      checkerGetConfigStub.returns(null);
      const config = {
        allowedCopyrightHolders: ['Invalid Holder', 'Google LLC'],
      };
      getConfigStub.resolves(config);
      const invalidFiles = require(resolve(
        fixturesPath,
        './invalid_copyright_added'
      ));
      const blob = require(resolve(fixturesPath, './invalid_copyright'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, invalidFiles)
        .get(
          '/repos/chingor13/google-auth-library-java/git/blobs/68383638d3661e3989b1119b2a7ef414aabb4f6d'
        )
        .reply(200, blob)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('handles an invalid configuration file', async () => {
      checkerGetConfigStub.returns(null);
      getConfigStub.rejects(new Error('Failed to parse the config'));
      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
    });

    it('ignores a valid license', async () => {
      checkerGetConfigStub.returns(null);
      getConfigStub.resolves(null);
      const validFiles = require(resolve(
        fixturesPath,
        './valid_license_added'
      ));
      const blob = require(resolve(fixturesPath, './valid_license'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, validFiles)
        .get(
          '/repos/chingor13/google-auth-library-java/git/blobs/b1e607d638896d18374123d85e1021584d551354'
        )
        .reply(200, blob)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores due to the config from the PR head', async () => {
      const config = {
        ignoreFiles: ['**/*.java'],
      };
      getConfigStub.resolves(null);
      checkerGetConfigStub.returns(config);
      const invalidFiles = require(resolve(
        fixturesPath,
        './invalid_copyright_added'
      ));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, invalidFiles)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);
      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      sinon.assert.calledOnceWithExactly(checkerGetConfigStub);
      requests.done();
    });

    it('ignores an ignored files', async () => {
      checkerGetConfigStub.returns(null);
      const config = {
        ignoreFiles: ['**/*.java'],
      };
      getConfigStub.resolves(config);
      const invalidFiles = require(resolve(
        fixturesPath,
        './invalid_copyright_added'
      ));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, invalidFiles)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);
      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores copyright strings in the body', async () => {
      checkerGetConfigStub.returns(null);
      getConfigStub.resolves(null);
      const validFiles = require(resolve(
        fixturesPath,
        './copyright_string_added'
      ));
      const blob = require(resolve(fixturesPath, './valid_license'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, validFiles)
        .get(
          '/repos/chingor13/google-auth-library-java/git/blobs/d6c1fc873b478b4ede6d03d49ca78c23e3fa4bdb'
        )
        .reply(200, blob)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });
  });

  describe('updated pull request', () => {
    let payload: EventPayloads.WebhookPayloadPullRequest;
    const sandbox = sinon.createSandbox();
    let getConfigStub: sinon.SinonStub;
    let validateConfigStub: sinon.SinonStub;
    before(() => {
      payload = require(resolve(fixturesPath, './pull_request_synchronized'));
    });

    beforeEach(() => {
      getConfigStub = sandbox.stub(botConfigUtilsModule, 'getConfig');
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

    it('sets a "failure" context on PR, if new source file is missing license', async () => {
      getConfigStub.resolves(null);
      const invalidFiles = require(resolve(
        fixturesPath,
        './missing_license_added'
      ));
      const blob = require(resolve(fixturesPath, './missing_license'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, invalidFiles)
        .get(
          '/repos/chingor13/google-auth-library-java/git/blobs/5b414a072e40622c177c72a58efb74ff9faadd0d'
        )
        .reply(200, blob)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('sets a "failure" context on PR, if a modified source file is missing license', async () => {
      getConfigStub.resolves(null);
      const invalidFiles = require(resolve(
        fixturesPath,
        './missing_license_modified'
      ));
      const blob = require(resolve(fixturesPath, './missing_license'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, invalidFiles)
        .get(
          '/repos/chingor13/google-auth-library-java/git/blobs/5b414a072e40622c177c72a58efb74ff9faadd0d'
        )
        .reply(200, blob)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('sets a "failure" context on PR, if the new source file is added and has wrong year', async () => {
      getConfigStub.resolves(null);
      const invalidFiles = require(resolve(fixturesPath, './wrong_year_added'));
      const blob = require(resolve(fixturesPath, './wrong_year'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, invalidFiles)
        .get(
          '/repos/chingor13/google-auth-library-java/git/blobs/ef039bb72b6cadc9c144541a5645e4a6818fb6de'
        )
        .reply(200, blob)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('sets a "failure" context on PR, if the source file is missing copyright', async () => {
      getConfigStub.resolves(null);
      const invalidFiles = require(resolve(
        fixturesPath,
        './missing_copyright_modified'
      ));
      const blob = require(resolve(fixturesPath, './missing_copyright'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, invalidFiles)
        .get(
          '/repos/chingor13/google-auth-library-java/git/blobs/f5ed0eb2e52ccb7b02ff208a2b392161d92dd768'
        )
        .reply(200, blob)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('sets a "success" context on PR, on modified file with invalid copyright header', async () => {
      getConfigStub.resolves(null);
      const invalidFiles = require(resolve(
        fixturesPath,
        './invalid_copyright_modified'
      ));
      const blob = require(resolve(fixturesPath, './invalid_copyright'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, invalidFiles)
        .get(
          '/repos/chingor13/google-auth-library-java/git/blobs/68383638d3661e3989b1119b2a7ef414aabb4f6d'
        )
        .reply(200, blob)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores a valid license', async () => {
      getConfigStub.resolves(null);
      const validFiles = require(resolve(
        fixturesPath,
        './valid_license_added'
      ));
      const blob = require(resolve(fixturesPath, './valid_license'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, validFiles)
        .get(
          '/repos/chingor13/google-auth-library-java/git/blobs/b1e607d638896d18374123d85e1021584d551354'
        )
        .reply(200, blob)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores copyright strings in the body', async () => {
      getConfigStub.resolves(null);
      const validFiles = require(resolve(
        fixturesPath,
        './copyright_string_modified'
      ));
      const blob = require(resolve(fixturesPath, './valid_license'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, validFiles)
        .get(
          '/repos/chingor13/google-auth-library-java/git/blobs/d6c1fc873b478b4ede6d03d49ca78c23e3fa4bdb'
        )
        .reply(200, blob)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: 'abc123'});
      requests.done();
    });

    it('ignores a deleted file', async () => {
      getConfigStub.resolves(null);
      const validFiles = require(resolve(
        fixturesPath,
        './deleted_file_ignored'
      ));
      require(resolve(fixturesPath, './valid_license'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/chingor13/google-auth-library-java/pulls/3/files?per_page=100'
        )
        .reply(200, validFiles)
        .post('/repos/chingor13/google-auth-library-java/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({name: 'pull_request', payload, id: '867'});
      requests.done();
    });
  });
});
