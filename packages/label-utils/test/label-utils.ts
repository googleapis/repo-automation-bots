// Copyright 2021 Google LLC
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

import nock from 'nock';
import snapshot from 'snap-shot-it';
import * as sinon from 'sinon';
import {describe, it, beforeEach, afterEach} from 'mocha';

import {DatastoreLock} from '@google-automations/datastore-lock';
import {Octokit} from '@octokit/rest';
import {syncLabels, getLabelColor} from '../src/label-utils';

nock.disableNetConnect();

interface listLabelsResponse {
  id: number;
  node_id: string;
  url: string;
  name: string;
  color: string;
  default: boolean;
  description: string;
}

function createLabelResponse(
  name: string,
  description: string,
  color: string
): listLabelsResponse {
  return {
    id: 1,
    node_id: '',
    url: '',
    name: name,
    color: color,
    default: true,
    description: description,
  };
}

function listLabels(
  owner: string,
  repo: string,
  status: number,
  response: Array<listLabelsResponse> | string
) {
  return nock('https://api.github.com')
    .get(`/repos/${owner}/${repo}/labels?per_page=100`)
    .reply(status, response);
}

function createLabel(owner: string, repo: string, status: number) {
  return nock('https://api.github.com')
    .post(`/repos/${owner}/${repo}/labels`, body => {
      snapshot(body);
      return true;
    })
    .reply(status);
}

function updateLabel(
  owner: string,
  repo: string,
  label: string,
  status: number
) {
  return nock('https://api.github.com')
    .patch(`/repos/${owner}/${repo}/labels/${encodeURI(label)}`, body => {
      snapshot(body);
      return true;
    })
    .reply(status);
}

describe('label-utils', () => {
  const octokit = new Octokit();
  const owner = 'testOwner';
  const repo = 'testRepo';
  const sandbox = sinon.createSandbox();
  let acquireStub: sinon.SinonStub;
  let releaseStub: sinon.SinonStub;
  beforeEach(() => {
    acquireStub = sandbox.stub(DatastoreLock.prototype, 'acquire');
    releaseStub = sandbox.stub(DatastoreLock.prototype, 'release');
  });
  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });
  it('quits early when failed to acquire the lock', async () => {
    acquireStub.resolves(false);
    const newLabels = [
      {
        name: 'test label',
        description: 'test description',
      },
    ];
    await syncLabels(octokit, owner, repo, newLabels);
  });
  it('creates a label', async () => {
    acquireStub.resolves(true);
    releaseStub.resolves(true);
    const scopes = [
      listLabels(owner, repo, 200, [
        createLabelResponse('bug', 'bug', getLabelColor('bug')),
      ]),
      createLabel(owner, repo, 200),
    ];
    const newLabels = [
      {
        name: 'test label',
        description: 'test description',
      },
    ];
    await syncLabels(octokit, owner, repo, newLabels);
    for (const scope of scopes) {
      scope.done();
    }
  });
  it('survives when failed to create a label', async () => {
    acquireStub.resolves(true);
    releaseStub.resolves(true);
    const scopes = [
      listLabels(owner, repo, 200, [
        createLabelResponse('bug', 'bug', getLabelColor('bug')),
      ]),
      createLabel(owner, repo, 500),
    ];
    const newLabels = [
      {
        name: 'test label',
        description: 'test description',
      },
    ];
    await syncLabels(octokit, owner, repo, newLabels);
    for (const scope of scopes) {
      scope.done();
    }
  });
  it('updates a label', async () => {
    acquireStub.resolves(true);
    releaseStub.resolves(true);
    const scopes = [
      listLabels(owner, repo, 200, [
        createLabelResponse('test label', 'x', getLabelColor('bug')),
      ]),
      updateLabel(owner, repo, 'test label', 200),
    ];
    const newLabels = [
      {
        name: 'test label',
        description: 'test description',
      },
    ];
    await syncLabels(octokit, owner, repo, newLabels);
    for (const scope of scopes) {
      scope.done();
    }
  });
  it('updates a label when the old name is uppercase', async () => {
    acquireStub.resolves(true);
    releaseStub.resolves(true);
    const scopes = [
      listLabels(owner, repo, 200, [
        createLabelResponse('Test Label', 'x', getLabelColor('bug')),
      ]),
      updateLabel(owner, repo, 'test label', 200),
    ];
    const newLabels = [
      {
        name: 'test label',
        description: 'test description',
      },
    ];
    await syncLabels(octokit, owner, repo, newLabels);
    for (const scope of scopes) {
      scope.done();
    }
  });
  it('survives when failed to update a label', async () => {
    acquireStub.resolves(true);
    releaseStub.resolves(true);
    const scopes = [
      listLabels(owner, repo, 200, [
        createLabelResponse('test label', 'x', getLabelColor('bug')),
      ]),
      updateLabel(owner, repo, 'test label', 500),
    ];
    const newLabels = [
      {
        name: 'test label',
        description: 'test description',
      },
    ];
    await syncLabels(octokit, owner, repo, newLabels);
    for (const scope of scopes) {
      scope.done();
    }
  });
});
