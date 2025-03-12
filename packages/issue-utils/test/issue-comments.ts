// Copyright 2023 Google LLC
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

import {describe, it} from 'mocha';
import nock from 'nock';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {addOrUpdateIssueComment} from '../src/issue-comments';
import assert from 'assert';
const fetch = require('node-fetch');

nock.disableNetConnect();
const octokit = new Octokit({auth: '123', request: {fetch}});

const NEW_COMMENT_BODY = 'This is the new comment body';
const EXPECTED_NEW_COMMENT_BODY = `<!-- probot comment [2345]-->\n${NEW_COMMENT_BODY}`;

describe('addOrUpdateIssueComment', () => {
  it('creates a new issue comment', async () => {
    const scopes = nock('https://api.github.com/')
      .get('/repos/test-owner/test-repo/issues/1234/comments?per_page=50')
      .reply(200, [
        {
          id: 1,
          body: 'irrelevant comment',
        },
      ])
      .post('/repos/test-owner/test-repo/issues/1234/comments', request => {
        assert.strictEqual(request.body, EXPECTED_NEW_COMMENT_BODY);
        return true;
      })
      .reply(201, {
        id: 2,
        body: EXPECTED_NEW_COMMENT_BODY,
        html_url:
          'https://github.com/test-owner/test-repo/issues/1234#issuecomment-2',
      });
    const newComment = await addOrUpdateIssueComment(
      octokit,
      'test-owner',
      'test-repo',
      1234,
      2345,
      NEW_COMMENT_BODY
    );
    assert.ok(newComment);
    assert.strictEqual(newComment.owner, 'test-owner');
    assert.strictEqual(newComment.repo, 'test-repo');
    assert.strictEqual(newComment.issueNumber, 1234);
    assert.strictEqual(
      newComment.htmlUrl,
      'https://github.com/test-owner/test-repo/issues/1234#issuecomment-2'
    );
    assert.strictEqual(newComment.body, EXPECTED_NEW_COMMENT_BODY);
    scopes.done();
  });

  it('updates an existing comment', async () => {
    const scopes = nock('https://api.github.com/')
      .get('/repos/test-owner/test-repo/issues/1234/comments?per_page=50')
      .reply(200, [
        {
          id: 1,
          body: 'irrelevant comment',
        },
        {
          id: 2,
          body: '<!-- probot comment [2345]-->\nPrevious comment',
        },
      ])
      .patch('/repos/test-owner/test-repo/issues/comments/2', request => {
        assert.strictEqual(request.body, EXPECTED_NEW_COMMENT_BODY);
        return true;
      })
      .reply(200, {
        id: 2,
        body: EXPECTED_NEW_COMMENT_BODY,
        html_url:
          'https://github.com/test-owner/test-repo/issues/1234#issuecomment-2',
      });
    const updatedComment = await addOrUpdateIssueComment(
      octokit,
      'test-owner',
      'test-repo',
      1234,
      2345,
      NEW_COMMENT_BODY
    );
    assert.ok(updatedComment);
    assert.strictEqual(updatedComment.owner, 'test-owner');
    assert.strictEqual(updatedComment.repo, 'test-repo');
    assert.strictEqual(updatedComment.issueNumber, 1234);
    assert.strictEqual(
      updatedComment.htmlUrl,
      'https://github.com/test-owner/test-repo/issues/1234#issuecomment-2'
    );
    assert.strictEqual(updatedComment.body, EXPECTED_NEW_COMMENT_BODY);
    scopes.done();
  });

  it('skips creating a comment for onlyUpdate', async () => {
    const scopes = nock('https://api.github.com/')
      .get('/repos/test-owner/test-repo/issues/1234/comments?per_page=50')
      .reply(200, [
        {
          id: 1,
          body: 'irrelevant comment',
        },
      ]);
    const newComment = await addOrUpdateIssueComment(
      octokit,
      'test-owner',
      'test-repo',
      1234,
      2345,
      NEW_COMMENT_BODY,
      {
        onlyUpdate: true,
      }
    );
    assert.strictEqual(newComment, null);
    scopes.done();
  });
});
