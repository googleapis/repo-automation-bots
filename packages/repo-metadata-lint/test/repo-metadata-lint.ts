// Copyright 2021 Google LLC
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

// eslint-disable-next-line node/no-extraneous-import
import {Probot, ProbotOctokit} from 'probot';
import {Octokit} from '@octokit/rest';
import {describe, it, beforeEach, afterEach} from 'mocha';
import nock from 'nock';
import * as sinon from 'sinon';
import {handler} from '../src/repo-metadata-lint';
import {logger} from 'gcf-utils';
import * as gcfUtils from 'gcf-utils';
import {assert} from 'console';
import {RepositoryFileCache} from '@google-automations/git-file-utils';
import {readFileSync} from 'fs';
const fetch = require('node-fetch');

nock.disableNetConnect();
const sandbox = sinon.createSandbox();

describe('repo-metadata-lint', () => {
  let probot: Probot;
  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
        request: {fetch},
      }),
    });
    probot.load(handler);
    sandbox
      .stub(gcfUtils, 'getAuthenticatedOctokit')
      .resolves(new Octokit({request: {fetch}}));
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('schedule.repository', () => {
    it('handles schedule.repository event', async () => {
      sandbox
        .stub(RepositoryFileCache.prototype, 'findFilesByFilename')
        .resolves([]);
      const infoStub = sandbox.stub(logger, 'info');
      const githubApiRequests = nock('https://api.github.com')
        .get('/repos/foo-org/foo-repo/issues?labels=repo-metadata%3A%20lint')
        .reply(200, []);
      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          organization: {login: 'foo-org'},
          repository: {name: 'foo-repo', owner: {login: 'bar-login'}},
          cron_org: 'foo-org',
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      sandbox.assert.calledWith(infoStub, sinon.match(/no validation errors/));
      githubApiRequests.done();
    });

    it('opens an issue on failure', async () => {
      sandbox
        .stub(RepositoryFileCache.prototype, 'findFilesByFilename')
        .onCall(0) // fetch .repo-metadata.json.
        .resolves(['.repo-metadata.json'])
        .onCall(1) // fetch .repo-metadata-full.json.
        .resolves([]);
      sandbox
        .stub(RepositoryFileCache.prototype, 'getFileContents')
        .withArgs('.repo-metadata.json', 'main')
        .resolves({
          sha: 'abc123',
          content: '',
          mode: '100644',
          parsedContent: JSON.stringify({
            library_type: 'BATMAN_LIB',
          }),
        });
      const infoStub = sandbox.stub(logger, 'info');
      const githubApiRequests = nock('https://api.github.com')
        .get('/repos/foo-org/foo-repo/issues?labels=repo-metadata%3A%20lint')
        .reply(200, [])
        .post('/repos/foo-org/foo-repo/issues', (post: {body: string}) => {
          assert(post.body.includes('library_type must be equal to one of'));
          return true;
        })
        .reply(200);

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          organization: {login: 'foo-org'},
          repository: {name: 'foo-repo', owner: {login: 'bar-login'}},
          cron_org: 'foo-org',
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      sandbox.assert.calledWith(infoStub, sinon.match(/1 validation errors/));
      githubApiRequests.done();
    });

    it('handles repositories with issues disabled', async () => {
      sandbox
        .stub(RepositoryFileCache.prototype, 'findFilesByFilename')
        .onCall(0) // fetch .repo-metadata.json.
        .resolves(['.repo-metadata.json'])
        .onCall(1) // fetch .repo-metadata-full.json.
        .resolves([]);
      sandbox
        .stub(RepositoryFileCache.prototype, 'getFileContents')
        .withArgs('.repo-metadata.json', 'main')
        .resolves({
          sha: 'abc123',
          content: '',
          mode: '100644',
          parsedContent: JSON.stringify({
            library_type: 'BATMAN_LIB',
          }),
        });
      const infoStub = sandbox.stub(logger, 'info');
      const githubApiRequests = nock('https://api.github.com')
        .get('/repos/foo-org/foo-repo/issues?labels=repo-metadata%3A%20lint')
        .reply(200, [])
        .post('/repos/foo-org/foo-repo/issues', (post: {body: string}) => {
          assert(post.body.includes('library_type must be equal to one of'));
          return true;
        })
        .reply(410, {message: 'Issues are disabled for this repo'});

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          organization: {login: 'foo-org'},
          repository: {name: 'foo-repo', owner: {login: 'bar-login'}},
          cron_org: 'foo-org',
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      sandbox.assert.calledWith(infoStub, sinon.match(/1 validation errors/));
      githubApiRequests.done();
    });

    it('opens an issue on failure reading bulk .repo-metadata-full.json file', async () => {
      sandbox
        .stub(RepositoryFileCache.prototype, 'findFilesByFilename')
        .onCall(0) // fetch .repo-metadata.json.
        .resolves([])
        .onCall(1) // fetch .repo-metadata-full.json.
        .resolves(['.repo-metadata-full.json']);
      sandbox
        .stub(RepositoryFileCache.prototype, 'getFileContents')
        .withArgs('.repo-metadata-full.json', 'main')
        .resolves({
          sha: 'abc123',
          content: '',
          mode: '100644',
          parsedContent: readFileSync(
            './test/fixtures/metadata-full-bad.json',
            'utf8'
          ),
        });
      const infoStub = sandbox.stub(logger, 'info');
      const githubApiRequests = nock('https://api.github.com')
        .get('/repos/foo-org/foo-repo/issues?labels=repo-metadata%3A%20lint')
        .reply(200, [])
        .post('/repos/foo-org/foo-repo/issues', (post: {body: string}) => {
          assert(post.body.includes('library_type must be equal to one of'));
          return true;
        })
        .reply(200);

      await probot.receive({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name: 'schedule.repository' as any,
        payload: {
          organization: {login: 'foo-org'},
          repository: {name: 'foo-repo', owner: {login: 'bar-login'}},
          cron_org: 'foo-org',
          installation: {id: 1234},
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      sandbox.assert.calledWith(infoStub, sinon.match(/2 validation errors/));
      githubApiRequests.done();
    });
  });
});
