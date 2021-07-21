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

import {describe, it, beforeEach, afterEach} from 'mocha';
import path from 'path';
import nock from 'nock';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, Context, createProbot, ProbotOctokit} from 'probot';
import * as sinon from 'sinon';
import * as labelSync from '../src/label-sync';
import * as assert from 'assert';
import {config} from '@probot/octokit-plugin-config';
const TestingOctokit = ProbotOctokit.plugin(config).defaults({
  retry: {enabled: false},
  throttle: {enabled: false},
});

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

function nockLabelList() {
  return nock('https://raw.githubusercontent.com')
    .get(
      '/googleapis/repo-automation-bots/master/packages/label-sync/src/labels.json'
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
    .patch(`/repos/Codertocat/Hello-World/labels/${encodeURIComponent(name)}`)
    .reply(200);
}

describe('Label Sync', () => {
  let probot: Probot;
  const sandbox = sinon.createSandbox();
  let getApiLabelsStub: sinon.SinonStub<[string], Promise<{}>>;
  let loadConfigStub: sinon.SinonStub<
    [Context],
    Promise<null | labelSync.ConfigurationOptions>
  >;

  beforeEach(() => {
    probot = createProbot({
      overrides: {
        githubToken: 'abc123',
        Octokit: TestingOctokit,
      },
    });

    probot.load(labelSync.handler);
    getApiLabelsStub = sandbox.stub(labelSync, 'getApiLabels').resolves({
      apis: [
        {
          display_name: 'Sprockets',
          github_label: 'api: sprockets',
          api_shortname: 'sprockets',
        },
      ],
    });
    loadConfigStub = sandbox.stub(labelSync, 'loadConfig').resolves(null);
  });

  afterEach(() => sandbox.restore());

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
    await probot.receive({
      name: 'repository',
      payload,
      id: 'abc123',
    });
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
    await probot.receive({
      name: 'repository',
      payload,
      id: 'abc123',
    });
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

  it('should handle missing properties on data from GCS', async () => {
    // Simulate the results coming back from DRIFT having missing fields.
    // In this case, the `apishort_name` property is explitly missing.
    getApiLabelsStub.restore();
    getApiLabelsStub = sandbox.stub(labelSync, 'getApiLabels').resolves({
      apis: [
        {
          display_name: 'Sprockets',
          github_label: 'api: sprockets',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      ],
    });
    const payload = require(path.resolve(
      fixturesPath,
      './repository_created.json'
    ));
    const scopes = [
      nockFetchOldLabels([]),
      nockLabelCreate(newLabels.labels.length),
    ];
    await probot.receive({
      name: 'repository',
      payload,
      id: 'abc123',
    });
    scopes.forEach(s => s.done());
    assert.ok(getApiLabelsStub.calledOnce);
  });

  it('should sync labels on cron job', async () => {
    const scopes = [
      nockFetchOldLabels([]),
      nockLabelCreate(newLabels.labels.length + 1),
    ];

    await probot.receive({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      name: 'schedule.repository' as any,
      payload: {
        cron_org: 'Codertocat',
        organization: {login: 'Codertocat'},
        repository: {name: 'Hello-World'},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      id: 'abc123',
    });

    scopes.forEach(s => s.done());
  });

  it('should attempt to load config', async () => {
    const payload = require(path.resolve(
      fixturesPath,
      './repository_created.json'
    ));
    const scopes = [
      // no need for nockLabelList(), as labels will be cached.
      nockFetchOldLabels([]),
      nockLabelCreate(newLabels.labels.length + 1),
    ];
    await probot.receive({
      name: 'repository',
      payload,
      id: 'abc123',
    });
    scopes.forEach(s => s.done());
    assert.ok(loadConfigStub.calledOnce);
  });

  it('should skip sync if repository is ignored', async () => {
    loadConfigStub.restore();
    loadConfigStub = sandbox.stub(labelSync, 'loadConfig').resolves({
      ignored: true,
    });
    const payload = require(path.resolve(
      fixturesPath,
      './repository_created.json'
    ));
    await probot.receive({
      name: 'repository',
      payload,
      id: 'abc123',
    });
    assert.ok(loadConfigStub.calledOnce);
  });
});
