// Copyright 2022 Google LLC
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

import nock from 'nock';
import {describe, it} from 'mocha';
import * as assert from 'assert';
import snapshot from 'snap-shot-it';
import {Octokit} from '@octokit/rest';
import {
  parseCherryPickComment,
  cherryPickAsPullRequest,
  cherryPickCommits,
} from '../src/cherry-pick';
import * as CherryPickModule from '../src/cherry-pick';
import sinon from 'sinon';

nock.disableNetConnect();

const sandbox = sinon.createSandbox();

describe('parseCherryPickComment', () => {
  it('parses a command comment', () => {
    const branch = parseCherryPickComment('/cherry-pick feature-branch');
    assert.strictEqual(branch, 'feature-branch');
  });

  it('handles leading/trailing space', () => {
    const branch = parseCherryPickComment('\n/cherry-pick feature-branch   ');
    assert.strictEqual(branch, 'feature-branch');
  });

  it('handles version format', () => {
    const branch = parseCherryPickComment('\n/cherry-pick 2.1.x   ');
    assert.strictEqual(branch, '2.1.x');
  });
});

describe('cherryPickCommits', () => {
  let octokit: Octokit;

  beforeEach(() => {
    octokit = new Octokit({
      auth: 'fakeToken',
    });
  });

  it('should cherry pick a single commit', async () => {
    const req = nock('https://api.github.com')
      .get('/repos/testOwner/testRepo/git/ref/heads%2Ftarget-branch')
      .reply(200, {object: {sha: 'devbranchsha'}})
      .post('/repos/testOwner/testRepo/git/refs', body => {
        snapshot(body);
        return true;
      })
      .reply(200)
      .get('/repos/testOwner/testRepo/git/commits/devbranchsha')
      .reply(200, {
        tree: {
          sha: 'treesha',
        },
      })
      .get('/repos/testOwner/testRepo/git/commits/abc123')
      .reply(200, {
        message: 'commit message for abc123',
        author: {name: 'author-name', email: 'author@email.com'},
        committer: {name: 'committer-name', email: 'committer@email.com'},
        parents: [{sha: 'parentsha'}],
      })
      .post('/repos/testOwner/testRepo/git/commits', body => {
        snapshot(body);
        return true;
      })
      .reply(200, {sha: 'newcommitsha'})
      .patch(
        '/repos/testOwner/testRepo/git/refs/heads%2Ftemp-target-branch',
        body => {
          snapshot(body);
          return true;
        }
      )
      .reply(200)
      .post('/repos/testOwner/testRepo/merges', body => {
        snapshot(body);
        return true;
      })
      .reply(200, {commit: {tree: {sha: 'mergetreesha'}}})
      .post('/repos/testOwner/testRepo/git/commits', body => {
        snapshot(body);
        return true;
      })
      .reply(200, {sha: 'newcommitsha2'})
      .patch(
        '/repos/testOwner/testRepo/git/refs/heads%2Ftemp-target-branch',
        body => {
          snapshot(body);
          return true;
        }
      )
      .reply(200)
      .patch(
        '/repos/testOwner/testRepo/git/refs/heads%2Ftarget-branch',
        body => {
          snapshot(body);
          return true;
        }
      )
      .reply(200)
      .delete('/repos/testOwner/testRepo/git/refs/heads%2Ftemp-target-branch')
      .reply(200);

    const commits = ['abc123'];
    const newCommits = await cherryPickCommits(
      octokit,
      'testOwner',
      'testRepo',
      commits,
      'target-branch'
    );
    assert.strictEqual(newCommits.length, 1);
    assert.strictEqual(newCommits[0].message, 'commit message for abc123');
    assert.strictEqual(newCommits[0].sha, 'newcommitsha2');
    req.done();
  });
});

describe('cherryPickAsPullRequest', () => {
  let octokit: Octokit;

  beforeEach(() => {
    octokit = new Octokit({
      auth: 'fakeToken',
    });
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('opens a pull request for single commit', async () => {
    const req = nock('https://api.github.com')
      .get('/repos/testOwner/testRepo/branches/dev')
      .reply(200, {commit: {sha: 'basesha'}})
      .post('/repos/testOwner/testRepo/git/refs', body => {
        snapshot(body);
        return true;
      })
      .reply(200)
      .post('/repos/testOwner/testRepo/pulls', body => {
        snapshot(body);
        return true;
      })
      .reply(200, {
        number: 1234,
        html_url: 'https://github.com/testOwner/testRepo/pull/1234',
        title: 'title from API',
        body: 'body from API',
      });

    sandbox
      .stub(CherryPickModule, 'cherryPickCommits')
      .resolves([{message: 'commit message for abc123', sha: 'abc123'}]);
    const commits = ['abc123'];
    const pullRequest = await cherryPickAsPullRequest(
      octokit,
      'testOwner',
      'testRepo',
      commits,
      'dev'
    );

    assert.strictEqual(pullRequest.number, 1234);
    assert.strictEqual(
      pullRequest.html_url,
      'https://github.com/testOwner/testRepo/pull/1234'
    );
    assert.strictEqual(pullRequest.title, 'title from API');
    assert.strictEqual(pullRequest.body, 'body from API');
    req.done();
  });

  it('opens a pull request for multiple commits', async () => {
    const req = nock('https://api.github.com')
      .get('/repos/testOwner/testRepo/branches/dev')
      .reply(200, {commit: {sha: 'basesha'}})
      .post('/repos/testOwner/testRepo/git/refs', body => {
        snapshot(body);
        return true;
      })
      .reply(200)
      .post('/repos/testOwner/testRepo/pulls', body => {
        snapshot(body);
        return true;
      })
      .reply(200, {
        number: 1234,
        html_url: 'https://github.com/testOwner/testRepo/pull/1234',
        title: 'title from API',
        body: 'body from API',
      });

    sandbox.stub(CherryPickModule, 'cherryPickCommits').resolves([
      {message: 'commit message for abc123', sha: 'abc123'},
      {message: 'commit message for def234', sha: 'def234'},
    ]);

    const commits = ['abc123', 'def234'];
    const pullRequest = await cherryPickAsPullRequest(
      octokit,
      'testOwner',
      'testRepo',
      commits,
      'dev'
    );

    assert.strictEqual(pullRequest.number, 1234);
    assert.strictEqual(
      pullRequest.html_url,
      'https://github.com/testOwner/testRepo/pull/1234'
    );
    assert.strictEqual(pullRequest.title, 'title from API');
    assert.strictEqual(pullRequest.body, 'body from API');
    req.done();
  });
});
