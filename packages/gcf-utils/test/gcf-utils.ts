// Copyright 2020 Google LLC
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

import {addOrUpdateIssueComment} from '../src/gcf-utils';

import {resolve} from 'path';
import snapshot from 'snap-shot-it';
import {Probot, ProbotOctokit} from 'probot';
import {describe, beforeEach, afterEach, it} from 'mocha';
import nock from 'nock';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

// Test app
const app = (app: Probot) => {
  app.on('issues', async context => {
    await addOrUpdateIssueComment(
      context.octokit,
      context.payload.repository.owner.login,
      context.payload.repository.name,
      context.payload.issue.number,
      context.payload.installation!.id,
      'test comment',
      context.payload.issue.title === 'onlyUpdate'
    );
  });
};

describe('gcf-utils', () => {
  describe('addOrUpdateIssueComment', () => {
    let probot: Probot;
    beforeEach(() => {
      probot = new Probot({
        appId: 1,
        githubToken: 'test',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
      });
      probot.load(app);
    });

    afterEach(() => {
      nock.cleanAll();
    });

    it('creates a comment', async () => {
      const payload = require(resolve(fixturesPath, './issue_event'));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/python-docs-samples/issues/10/comments?per_page=50'
        )
        .reply(200, [])
        .post('/repos/tmatsuo/python-docs-samples/issues/10/comments', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'issues',
        payload,
        id: 'test',
      });
      requests.done();
    });
    it('does not create a comment', async () => {
      const payload = require(resolve(
        fixturesPath,
        './issue_only_update_event'
      ));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/python-docs-samples/issues/10/comments?per_page=50'
        )
        .reply(200, []);

      await probot.receive({
        name: 'issues',
        payload,
        id: 'test',
      });
      requests.done();
    });
    it('updates a comment', async () => {
      const payload = require(resolve(fixturesPath, './issue_event'));
      const listCommentsResponse = require(resolve(
        fixturesPath,
        './list_issue_comments'
      ));
      const requests = nock('https://api.github.com')
        .get(
          '/repos/tmatsuo/python-docs-samples/issues/10/comments?per_page=50'
        )
        .reply(200, listCommentsResponse)
        .patch('/repos/tmatsuo/python-docs-samples/issues/comments/1', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'issues',
        payload,
        id: 'test',
      });
      requests.done();
    });
  });
});
