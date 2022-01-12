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
import {describe, it, beforeEach, afterEach} from 'mocha';
import nock from 'nock';
import * as sinon from 'sinon';
import {handler} from '../src/repo-metadata-lint';
import {logger} from 'gcf-utils';
import * as fileIterator from '../src/file-iterator';
import {assert} from 'console';

async function* emptyIterator() {}
async function* failingIterator() {
  yield [
    './foo',
    JSON.stringify({
      library_type: 'BATMAN_LIB',
    }),
  ];
}

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
      }),
    });
    probot.load(handler);
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('schedule.repository', () => {
    it('handles schedule.repository event', async () => {
      const FileIterator = sandbox.stub(fileIterator, 'FileIterator');
      FileIterator.prototype.repoMetadata = sandbox
        .stub()
        .returns(emptyIterator());
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      sandbox.assert.calledWith(infoStub, sinon.match(/no validation errors/));
      githubApiRequests.done();
    });

    it('opens an issue on failure', async () => {
      const FileIterator = sandbox.stub(fileIterator, 'FileIterator');
      FileIterator.prototype.repoMetadata = sandbox
        .stub()
        .returns(failingIterator());
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        id: 'abc123',
      });
      sandbox.assert.calledWith(infoStub, sinon.match(/1 validation errors/));
      githubApiRequests.done();
    });
  });
});
