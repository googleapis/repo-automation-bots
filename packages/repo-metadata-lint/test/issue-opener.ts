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
import {describe, it, afterEach} from 'mocha';
import nock from 'nock';
import {IssueOpener} from '../src/issue-opener';
// eslint-disable-next-line node/no-extraneous-import
import {ProbotOctokit} from 'probot';
import * as sinon from 'sinon';
import {logger} from 'gcf-utils';
import assert from 'assert';

nock.disableNetConnect();
const sandbox = sinon.createSandbox();

describe('open-issue', () => {
  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('schedule.repository', () => {
    it('does not open an issue if open issues already exist with repo-metadata:lint label', async () => {
      const infoStub = sandbox.stub(logger, 'info');
      const Octokit = ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      });
      const octokit = new Octokit();
      const opener = new IssueOpener('bcoe', 'foo', octokit);
      const lookupIssues = nock('https://api.github.com')
        .get('/repos/bcoe/foo/issues?labels=repo-metadata%3A%20lint')
        .reply(200, [{number: 200}]);
      await opener.open([
        {
          status: 'error',
          errors: ['foo bar'],
        },
      ]);
      lookupIssues.done();
      sandbox.assert.calledOnce(infoStub);
    });

    it('opens issue for a single validation error', async () => {
      const Octokit = ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      });
      const octokit = new Octokit();
      const opener = new IssueOpener('bcoe', 'foo', octokit);
      const openIssue = nock('https://api.github.com')
        .get('/repos/bcoe/foo/issues?labels=repo-metadata%3A%20lint')
        .reply(200, [])
        .post('/repos/bcoe/foo/issues', body => {
          assert(
            body.title.includes('Your .repo-metadata.json file has a problem')
          );
          return true;
        })
        .reply(200);
      await opener.open([
        {
          status: 'error',
          errors: ['your .repo-metadata.json is missing foo key'],
        },
      ]);
      openIssue.done();
    });

    it('opens issue for a multiple validation errors', async () => {
      const Octokit = ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      });
      const octokit = new Octokit();
      const opener = new IssueOpener('bcoe', 'foo', octokit);
      const openIssue = nock('https://api.github.com')
        .get('/repos/bcoe/foo/issues?labels=repo-metadata%3A%20lint')
        .reply(200, [])
        .post('/repos/bcoe/foo/issues', body => {
          assert(
            body.title.includes('Your .repo-metadata.json files have a problem')
          );
          return true;
        })
        .reply(200);
      await opener.open([
        {
          status: 'error',
          errors: ['your .repo-metadata.json is missing foo key'],
        },
        {
          status: 'error',
          errors: ['your .repo-metadata.json is missing bar key'],
        },
      ]);
      openIssue.done();
    });
  });
});
