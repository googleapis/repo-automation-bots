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

import nock from 'nock';
import {describe, it} from 'mocha';
import * as assert from 'assert';
import sinon from 'sinon';
import {
  getServerlessSchedulerProxyUrl,
  parseLegacyCronFile,
  parseCronEntries,
  createOrUpdateCron,
} from '../src/cron-utils';
import {v1} from '@google-cloud/scheduler';

nock.disableNetConnect();

const sandbox = sinon.createSandbox();

describe('getServerlessSchedulerProxyUrl', () => {
  let authScope: nock.Scope;
  beforeEach(() => {
    authScope = nock('https://oauth2.googleapis.com')
      .post('/token')
      .reply(200, {
        access_token: 'some-token',
        token_type: 'Bearer',
      });
  });
  afterEach(() => {
    assert.ok(authScope.isDone());
  });
  it('should fetch the proxy url', async () => {
    const runScope = nock('https://run.googleapis.com')
      .get(
        '/v1/projects/my-project-id/locations/my-region/services/serverless-scheduler-proxy'
      )
      .reply(200, {
        status: {
          address: {
            url: 'http://some.domain/path',
          },
        },
      });
    const url = await getServerlessSchedulerProxyUrl(
      'my-project-id',
      'my-region'
    );
    assert.strictEqual(url, 'http://some.domain/path');
    assert.ok(runScope.isDone());
  });
  it('rejects on not found', async () => {
    const runScope = nock('https://run.googleapis.com')
      .get(
        '/v1/projects/my-project-id/locations/my-region/services/serverless-scheduler-proxy'
      )
      .reply(404);
    await assert.rejects(() => {
      return getServerlessSchedulerProxyUrl('my-project-id', 'my-region');
    });
    assert.ok(runScope.isDone());
  });
});

describe('parseLegacyCron', () => {
  it('pulls the schedule from the file', () => {
    const cronEntries = parseLegacyCronFile(
      './test/fixtures/cron.txt',
      'some-name'
    );
    assert.strictEqual(1, cronEntries.length);
    const cronEntry = cronEntries[0];
    assert.strictEqual(cronEntry.schedule, '0 1 * * *');
    assert.strictEqual(cronEntry.name, 'some-name');
    assert.strictEqual(cronEntry.description, undefined);
  });
  it('sets the description', () => {
    const cronEntries = parseLegacyCronFile(
      './test/fixtures/cron.txt',
      'some-name',
      'some-description'
    );
    assert.strictEqual(1, cronEntries.length);
    const cronEntry = cronEntries[0];
    assert.strictEqual(cronEntry.schedule, '0 1 * * *');
    assert.strictEqual(cronEntry.name, 'some-name');
    assert.strictEqual(cronEntry.description, 'some-description');
  });
  it('returns empty list on not found', () => {
    const cronEntries = parseLegacyCronFile('./non-existent-file', 'some-name');
    assert.deepStrictEqual(cronEntries, []);
  });
});

describe('parseCronEntries', () => {
  it('parses an entry', () => {
    const cronEntries = parseCronEntries('./test/fixtures/cron.yaml');
    assert.strictEqual(1, cronEntries.length);
    const cronEntry = cronEntries[0];
    assert.strictEqual(cronEntry.schedule, '0 2 * * *');
    assert.strictEqual(cronEntry.name, 'some-name');
    assert.strictEqual(cronEntry.description, 'some-description');
  });
  it('parses multiple entries', () => {
    const cronEntries = parseCronEntries('./test/fixtures/cron-multiple.yaml');
    assert.strictEqual(2, cronEntries.length);
    let cronEntry = cronEntries[0];
    assert.strictEqual(cronEntry.schedule, '0 2 * * *');
    assert.strictEqual(cronEntry.name, 'some-name');
    assert.strictEqual(cronEntry.description, 'some-description');
    cronEntry = cronEntries[1];
    assert.strictEqual(cronEntry.schedule, '0 3 * * *');
    assert.strictEqual(cronEntry.name, 'another-name');
    assert.strictEqual(cronEntry.description, 'another-description');
  });
  it('returns empty list on not found', () => {
    const cronEntries = parseCronEntries('./non-existent-file');
    assert.deepStrictEqual(cronEntries, []);
  });
});

describe('createOrUpdateCron', () => {
  afterEach(() => {
    sandbox.restore();
  });
  it('creates a scheduler job if not exists', async () => {
    const cronEntry = {
      name: 'test-cron',
      description: 'some-description',
      schedule: '0 1 * * *',
    };
    sandbox
      .stub(v1.CloudSchedulerClient.prototype, 'getJob')
      .rejects({code: 5});
    sandbox
      .stub(v1.CloudSchedulerClient.prototype, 'createJob')
      .resolves([{name: 'projects/my-project/regions/my-region/jobs/abcd'}]);
    const job = await createOrUpdateCron(
      cronEntry,
      'my-project',
      'my-region',
      'my-function-region',
      'https://base.url/',
      'my-account@google.com'
    );
    assert.strictEqual(job, 'projects/my-project/regions/my-region/jobs/abcd');
  });
  it('updates a scheduler job if it exists', async () => {
    const cronEntry = {
      name: 'test-cron',
      description: 'some-description',
      schedule: '0 1 * * *',
    };
    sandbox
      .stub(v1.CloudSchedulerClient.prototype, 'getJob')
      .resolves([{name: 'projects/my-project/regions/my-region/jobs/abcd'}]);
    sandbox
      .stub(v1.CloudSchedulerClient.prototype, 'updateJob')
      .resolves([{name: 'projects/my-project/regions/my-region/jobs/abcd'}]);
    const job = await createOrUpdateCron(
      cronEntry,
      'my-project',
      'my-region',
      'my-function-region',
      'https://base.url/',
      'my-account@google.com'
    );
    assert.strictEqual(job, 'projects/my-project/regions/my-region/jobs/abcd');
  });
  it('adds additional parameters', async () => {
    const cronEntry = {
      name: 'test-cron',
      description: 'some-description',
      schedule: '0 1 * * *',
      params: {
        foo: 'bar',
      },
    };
    sandbox
      .stub(v1.CloudSchedulerClient.prototype, 'getJob')
      .rejects({code: 5});
    const createJobStub = sandbox
      .stub(v1.CloudSchedulerClient.prototype, 'createJob')
      .resolves([{name: 'projects/my-project/regions/my-region/jobs/abcd'}]);
    const job = await createOrUpdateCron(
      cronEntry,
      'my-project',
      'my-region',
      'my-function-region',
      'https://base.url/',
      'my-account@google.com'
    );
    assert.strictEqual(job, 'projects/my-project/regions/my-region/jobs/abcd');
    sinon.assert.calledOnce(createJobStub);

    const body = JSON.parse(
      createJobStub.getCall(0).args[0].job!.httpTarget!.body!.toString()
    );
    assert.strictEqual(body['foo'], 'bar');
  });
});
