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

/* eslint-disable @typescript-eslint/no-var-requires */

import {describe, it, beforeEach} from 'mocha';
import path from 'path';
import nock from 'nock';
// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';

import appFn from '../src/label-sync';

nock.disableNetConnect();
const fixturesPath = path.resolve(__dirname, '../../test/fixtures');
const newLabels = require('../src/labels.json') as {
  labels: [
    {
      name: string;
      color: string;
    }
  ];
};
const repos = require('../../test/fixtures/repos.json');

interface GetApiLabelsResponse {
  apis: Array<{
    display_name: string; // Access Approval
    github_label: string; // api: accessapproval
    api_shortname: string; // accessapproval
  }>;
}
appFn.getApiLabels = async (): Promise<GetApiLabelsResponse> => {
  return {
    apis: [
      {
        display_name: 'Sprockets',
        github_label: 'api: sprockets',
        api_shortname: 'sprockets',
      },
    ],
  };
};

function nockLabelList() {
  return nock('https://api.github.com')
    .get(
      '/repos/googleapis/repo-automation-bots/contents/packages/label-sync/src/labels.json'
    )
    .reply(200, {content: Buffer.from(JSON.stringify(newLabels), 'utf8')});
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
      // use a bare instance of octokit, the default version
      // enables retries which makes testing difficult.
      // eslint-disable-next-line node/no-extraneous-require
      Octokit: require('@octokit/rest'),
    });
    probot.app = {
      getSignedJsonWebToken() {
        return 'abc123';
      },
      getInstallationAccessToken(): Promise<string> {
        return Promise.resolve('abc123');
      },
    };
    probot.load(appFn);
  });

  it('should sync labels on repo create', async () => {
    const payload = require(path.resolve(
      fixturesPath,
      './repository_created.json'
    ));
    const scopes = [
      nockLabelList(),
      nockFetchOldLabels([]),
      nockLabelCreate(newLabels.labels.length + 1),
    ];
    await probot.receive({name: 'repository', payload, id: 'abc123'});
    scopes.forEach(s => s.done());
  });

  it('should sync labels on label delete', async () => {
    const payload = require(path.resolve(fixturesPath, './label_deleted.json'));
    const scopes = [
      nockFetchOldLabels([]),
      nockLabelCreate(newLabels.labels.length + 1),
    ];
    await probot.receive({name: 'label', payload, id: 'abc123'});
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
      nockLabelCreate(newLabels.labels.length + 1),
      nockLabelDelete(labelName),
    ];
    await probot.receive({name: 'repository', payload, id: 'abc123'});
    scopes.forEach(s => s.done());
  });

  it('should update bug label colors', async () => {
    const payload = require(path.resolve(fixturesPath, './label_deleted.json'));
    const {labels} = Object.assign({}, newLabels);
    const labelName = 'type: bug';
    const bugLabel = labels.find(l => l.name === labelName)!;
    bugLabel.color = '000000';
    const scopes = [
      nockFetchOldLabels(labels),
      nockLabelCreate(1),
      nockLabelUpdate(labelName),
    ];
    await probot.receive({name: 'label', payload, id: 'abc123'});
    scopes.forEach(s => s.done());
  });
});
