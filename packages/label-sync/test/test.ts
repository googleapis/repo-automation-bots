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

import appFn from '../src/label-sync';
import path from 'path';
import nock from 'nock';
import { Probot } from 'probot';

nock.disableNetConnect();
const fixturesPath = path.resolve(__dirname, '../../test/fixtures');
const newLabels = require('../../src/labels.json') as {
  labels: [
    {
      name: string;
      color: string;
    }
  ];
};
const repos = require('../../test/fixtures/repos.json');

function nockLabelList() {
  return nock('https://github.com')
    .get(
      '/googleapis/repo-automation-bots/blob/master/packages/label-sync/src/labels.json'
    )
    .reply(200, newLabels);
}

function nockFetchOldLabels(labels: Array<{}>) {
  return nock('https://api.github.com')
    .get('/repos/Codertocat/Hello-World/labels?per_page=100')
    .reply(200, labels);
}

function nockLabelCreate(times: number) {
  return nock('https://api.github.com')
    .post('/repos/Codertocat/Hello-World/labels')
    .times(times)
    .reply(200);
}

function nockLabelDelete(name: string) {
  return nock('https://api.github.com')
    .delete(`/repos/Codertocat/Hello-World/labels/${name}`)
    .reply(200);
}

function nockLabelUpdate(name: string) {
  return nock('https://api.github.com')
    .patch(`/repos/Codertocat/Hello-World/labels/${encodeURI(name)}`)
    .reply(200);
}

function nockRepoList() {
  return nock('https://raw.githubusercontent.com')
    .get('/googleapis/sloth/master/repos.json')
    .reply(200, repos);
}

describe('Label Sync', () => {
  let probot: Probot;
  beforeEach(() => {
    probot = new Probot({
      Octokit: require('@octokit/rest'),
    });

    const app = probot.load(appFn);
    app.app = {
      getSignedJsonWebToken() {
        return 'abc123';
      },
      getInstallationAccessToken(): Promise<string> {
        return Promise.resolve('abc123');
      },
    };
  });

  it('should sync labels on repo create', async () => {
    const payload = require(path.resolve(
      fixturesPath,
      './repository_created.json'
    ));
    const scopes = [
      nockLabelList(),
      nockFetchOldLabels([]),
      nockLabelCreate(newLabels.labels.length),
    ];
    await probot.receive({ name: 'repository', payload, id: 'abc123' });
    scopes.forEach(s => s.done());
  });

  it('should sync labels on label delete', async () => {
    const payload = require(path.resolve(fixturesPath, './label_deleted.json'));
    const scopes = [
      nockFetchOldLabels([]),
      nockLabelCreate(newLabels.labels.length),
    ];
    await probot.receive({ name: 'label', payload, id: 'abc123' });
    scopes.forEach(s => s.done());
  });

  it('should delete expected labels', async () => {
    const payload = require(path.resolve(
      fixturesPath,
      './repository_created.json'
    ));
    const labelName = 'bug';
    const originalLabels = [
      {
        name: labelName,
      },
    ];
    const scopes = [
      nockFetchOldLabels(originalLabels),
      nockLabelCreate(newLabels.labels.length),
      nockLabelDelete(labelName),
    ];
    await probot.receive({ name: 'repository', payload, id: 'abc123' });
    scopes.forEach(s => s.done());
  });

  it('should update bug label colors', async () => {
    const payload = require(path.resolve(fixturesPath, './label_deleted.json'));
    const { labels } = Object.assign({}, newLabels);
    const labelName = 'type: bug';
    const bugLabel = labels.find(l => l.name === labelName)!;
    bugLabel.color = '000000';
    const scopes = [nockFetchOldLabels(labels), nockLabelUpdate(labelName)];
    await probot.receive({ name: 'label', payload, id: 'abc123' });
    scopes.forEach(s => s.done());
  });

  it('should update all repos when the label list is updated', async () => {
    const payload = require(path.resolve(fixturesPath, './push.json'));
    const scopes = [
      nockRepoList(),
      nockLabelList(),
      nockFetchOldLabels([]),
      nockLabelCreate(newLabels.labels.length),
    ];
    await probot.receive({ name: 'push', payload, id: 'abc123' });
    scopes.forEach(s => s.done());
  });
});
