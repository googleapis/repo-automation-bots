// Copyright 2022 Google LLC
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

import {describe, it, beforeEach} from 'mocha';
import nock from 'nock';
import {addOrUpdateIssue, closeIssue} from '../src/issue-utils';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {logger} from 'gcf-utils';
import assert from 'assert';
const fetch = require('node-fetch');

nock.disableNetConnect();
const octokit = new Octokit({auth: '123', request: {fetch}});

describe('addOrUpdateIssue', () => {
  beforeEach(() => {
    nock('https://api.github.com/').get('/app').reply(200, {
      id: 12345,
      slug: 'release-please',
      name: 'Release Please',
    });
  });
  it('opens a new issue', async () => {
    const scopes = nock('https://api.github.com/')
      .get(
        '/repos/test-owner/test-repo/issues?state=open&creator=release-please[bot]'
      )
      .reply(200, [])
      .post('/repos/test-owner/test-repo/issues')
      .reply(200, {
        title: 'my issue title',
        body: 'my issue body',
        number: 123,
        labels: [{name: 'label1'}, {name: 'label2'}],
      });
    const issue = await addOrUpdateIssue(
      octokit,
      'test-owner',
      'test-repo',
      'my issue title',
      'my issue body',
      ['label1', 'label2'],
      logger
    );
    assert.strictEqual(123, issue.number);
    assert.strictEqual('my issue title', issue.title);
    assert.strictEqual('my issue body', issue.body);
    scopes.done();
  });

  it('updates an existing issue', async () => {
    const scopes = nock('https://api.github.com/')
      .get(
        '/repos/test-owner/test-repo/issues?state=open&creator=release-please[bot]'
      )
      .reply(200, [
        {
          title: 'my issue title',
          body: 'old issue body',
          number: 123,
          labels: [{name: 'label1'}, {name: 'label2'}],
        },
      ])
      .patch('/repos/test-owner/test-repo/issues/123')
      .reply(200, {
        title: 'my issue title',
        body: 'my issue body',
        number: 123,
        labels: [{name: 'label1'}, {name: 'label2'}],
      });
    const issue = await addOrUpdateIssue(
      octokit,
      'test-owner',
      'test-repo',
      'my issue title',
      'my issue body',
      ['label1', 'label2'],
      logger
    );
    assert.strictEqual(123, issue.number);
    assert.strictEqual('my issue title', issue.title);
    assert.strictEqual('my issue body', issue.body);
    scopes.done();
  });

  it('ignores an existing issue that does not have changes', async () => {
    const scopes = nock('https://api.github.com/')
      .get(
        '/repos/test-owner/test-repo/issues?state=open&creator=release-please[bot]'
      )
      .reply(200, [
        {
          title: 'my issue title',
          body: 'my issue body',
          number: 123,
          labels: [{name: 'label1'}, {name: 'label2'}],
        },
      ]);
    const issue = await addOrUpdateIssue(
      octokit,
      'test-owner',
      'test-repo',
      'my issue title',
      'my issue body',
      ['label1', 'label2'],
      logger
    );
    assert.strictEqual(123, issue.number);
    assert.strictEqual('my issue title', issue.title);
    assert.strictEqual('my issue body', issue.body);
    scopes.done();
  });
});

describe('closeIssue', () => {
  beforeEach(() => {
    nock('https://api.github.com/').get('/app').reply(200, {
      id: 12345,
      slug: 'release-please',
      name: 'Release Please',
    });
  });
  it('closes an existing issue', async () => {
    const scopes = nock('https://api.github.com/')
      .get(
        '/repos/test-owner/test-repo/issues?state=open&creator=release-please[bot]'
      )
      .reply(200, [
        {
          number: 123,
          title: 'my issue title',
          body: 'my issue body',
          labels: [],
        },
      ])
      .patch('/repos/test-owner/test-repo/issues/123', body => {
        assert.strictEqual(body.state, 'closed');
        assert.strictEqual(body.state_reason, 'completed');
        return body;
      })
      .reply(200, {
        title: 'my issue title',
        body: 'my issue body',
        number: 123,
        labels: [{name: 'label1'}, {name: 'label2'}],
      });
    const issue = await closeIssue(
      octokit,
      'test-owner',
      'test-repo',
      'my issue title',
      logger
    );
    assert(issue, 'expected issue to exist');
    assert.strictEqual(123, issue.number);
    assert.strictEqual('my issue title', issue.title);
    assert.strictEqual('my issue body', issue.body);
    scopes.done();
  });

  it('does nothing if no issue found', async () => {
    const scopes = nock('https://api.github.com/')
      .get(
        '/repos/test-owner/test-repo/issues?state=open&creator=release-please[bot]'
      )
      .reply(200, []);
    const issue = await closeIssue(
      octokit,
      'test-owner',
      'test-repo',
      'my issue title',
      logger
    );
    assert.strictEqual(issue, null);
    scopes.done();
  });
});
