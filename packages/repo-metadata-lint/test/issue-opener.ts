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

import {describe, it, afterEach} from 'mocha';
import nock from 'nock';
import {IssueOpener} from '../src/issue-opener';
// eslint-disable-next-line node/no-extraneous-import
import {ProbotOctokit} from 'probot';
import * as sinon from 'sinon';
import {logger} from 'gcf-utils';
import assert from 'assert';
import {ErrorMessageText} from '../src/error-message-text';
import {ValidationResult} from '../src/validate';

nock.disableNetConnect();
const sandbox = sinon.createSandbox();

describe('open-issue', () => {
  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  describe('schedule.repository', () => {
    it('does not open an issue if open issues already exists with same list of errors', async () => {
      const infoStub = sandbox.stub(logger, 'info');
      const Octokit = ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      });
      const octokit = new Octokit();
      const opener = new IssueOpener('bcoe', 'foo', octokit);
      const results: ValidationResult[] = [
        {
          status: 'error',
          errors: ['foo bar', 'a second error'],
        },
      ];
      const lookupIssues = nock('https://api.github.com')
        .get('/repos/bcoe/foo/issues?labels=repo-metadata%3A%20lint')
        .reply(200, [
          {number: 200, body: ErrorMessageText.forIssueBody(results)},
        ]);
      await opener.open(results);
      lookupIssues.done();
      sandbox.assert.calledOnce(infoStub);
    });

    it('does not open issue if no error results provided', async () => {
      const infoStub = sandbox.stub(logger, 'info');
      const Octokit = ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      });
      const octokit = new Octokit();
      const opener = new IssueOpener('bcoe', 'foo', octokit);
      const results: ValidationResult[] = [];
      const lookupIssues = nock('https://api.github.com')
        .get('/repos/bcoe/foo/issues?labels=repo-metadata%3A%20lint')
        .reply(200, []);
      await opener.open(results);
      lookupIssues.done();
      sandbox.assert.calledOnce(infoStub);
    });

    it('closes existing issue if no errors still exist', async () => {
      const infoStub = sandbox.stub(logger, 'info');
      const Octokit = ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      });
      const octokit = new Octokit();
      const opener = new IssueOpener('bcoe', 'foo', octokit);
      const oldResults: ValidationResult[] = [
        {
          status: 'error',
          errors: ['foo bar', 'a second error'],
        },
      ];
      const newResults: ValidationResult[] = [];
      const lookupIssues = nock('https://api.github.com')
        .get('/repos/bcoe/foo/issues?labels=repo-metadata%3A%20lint')
        .reply(200, [
          {number: 200, body: ErrorMessageText.forIssueBody(oldResults)},
        ])
        .patch('/repos/bcoe/foo/issues/200', body => {
          assert.strictEqual(body.state, 'closed');
          return true;
        })
        .reply(200);
      await opener.open(newResults);
      lookupIssues.done();
      sandbox.assert.calledOnce(infoStub);
    });

    it('updates an issue if errors have changed', async () => {
      const Octokit = ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      });
      const octokit = new Octokit();
      const opener = new IssueOpener('bcoe', 'foo', octokit);
      const oldResults: ValidationResult[] = [
        {
          status: 'error',
          errors: ['foo bar', 'a second error'],
        },
      ];
      const newResults: ValidationResult[] = [
        {
          status: 'error',
          errors: ['foo bar', 'a second error', 'a third error'],
        },
      ];
      const lookupIssues = nock('https://api.github.com')
        .get('/repos/bcoe/foo/issues?labels=repo-metadata%3A%20lint')
        .reply(200, [
          {number: 200, body: ErrorMessageText.forIssueBody(oldResults)},
        ])
        .patch('/repos/bcoe/foo/issues/200', body => {
          assert(
            body.title.includes('Your .repo-metadata.json file has a problem')
          );
          return true;
        })
        .reply(200);
      await opener.open(newResults);
      lookupIssues.done();
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
