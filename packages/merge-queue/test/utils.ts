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

/* eslint-disable node/no-extraneous-import */

import assert from 'assert';
import {describe, it, before, after} from 'mocha';
import nock from 'nock';
import sinon from 'sinon';

import {Octokit} from '@octokit/rest';

import {Datastore} from '@google-cloud/datastore';
import DataStoreEmulator from 'google-datastore-emulator';
import {GCFLogger, GCFBootstrapper} from 'gcf-utils';
import * as gcfUtils from 'gcf-utils';

import {
  createTaskBody,
  addPRToQueue,
  createQueueKey,
  getQueue,
  removePRFromQueue,
  enqueueTask,
  changeLabel,
  updatePRForRemoval,
  MERGE_QUEUE_CALLBACK,
} from '../src/utils';

import {Queue} from '../src/types';

import {ADDED_LABEL, REMOVED_LABEL} from '../src/labels';

nock.disableNetConnect();

describe('merge-queue/utils', () => {
  let emulator: DataStoreEmulator;
  describe('updatePRForRemoval', () => {
    const octokit = new Octokit();
    const sandbox = sinon.createSandbox();
    let addOrUpdateIssueCommentStub: sinon.SinonStub;
    beforeEach(() => {
      addOrUpdateIssueCommentStub = sandbox.stub(
        gcfUtils,
        'addOrUpdateIssueComment'
      );
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('updates the PR', async () => {
      addOrUpdateIssueCommentStub.resolves();
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const prNumber = 1;
      const installationId = 12345;
      const reason = 'no reason';
      const scope = nock('https://api.github.com')
        .delete(
          `/repos/googleapis/repo-automation-bots/issues/1/labels/${encodeURIComponent(
            ADDED_LABEL
          )}`
        )
        .reply(200, 'ok')
        .post('/repos/googleapis/repo-automation-bots/issues/1/labels', {
          labels: [REMOVED_LABEL],
        })
        .reply(200, 'ok');
      await updatePRForRemoval(
        octokit,
        owner,
        repo,
        prNumber,
        installationId,
        reason
      );
      scope.done();
      sinon.assert.calledOnceWithExactly(
        addOrUpdateIssueCommentStub,
        sinon.match.instanceOf(Octokit),
        owner,
        repo,
        prNumber,
        installationId,
        reason
      );
    });
  });
  describe('changeLabel', () => {
    const octokit = new Octokit();
    it('changes the label', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const prNumber = 1;
      const from = 'from-label';
      const to = 'to-label';
      const scope = nock('https://api.github.com')
        .delete(
          '/repos/googleapis/repo-automation-bots/issues/1/labels/from-label'
        )
        .reply(200, 'ok')
        .post('/repos/googleapis/repo-automation-bots/issues/1/labels', {
          labels: ['to-label'],
        })
        .reply(200, 'ok');
      await changeLabel(octokit, owner, repo, prNumber, from, to);
      scope.done();
    });
    it('survives 404 error', async () => {
      const owner = 'googleapis';
      const repo = 'repo-automation-bots';
      const prNumber = 1;
      const from = 'from-label';
      const to = 'to-label';
      const scope = nock('https://api.github.com')
        .delete(
          '/repos/googleapis/repo-automation-bots/issues/1/labels/from-label'
        )
        .reply(404, 'not found')
        .post('/repos/googleapis/repo-automation-bots/issues/1/labels', {
          labels: ['to-label'],
        })
        .reply(200, 'ok');
      await changeLabel(octokit, owner, repo, prNumber, from, to);
      scope.done();
    });
  });
  describe('enqueueTask', () => {
    const env = Object.assign({}, process.env);
    const sandbox = sinon.createSandbox();
    const bootstrap = new GCFBootstrapper({
      taskTargetEnvironment: 'run',
    });
    let enqueueTaskStub: sinon.SinonStub;
    after(() => {
      process.env = env;
    });
    beforeEach(() => {
      enqueueTaskStub = sandbox.stub(bootstrap, 'enqueueTask');
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('enqueues a task', async () => {
      const repoFullName = 'googleapis/repo-automation-bots';
      const installationId = 12345;
      const prNumber = 1;
      const logger = new GCFLogger();
      await enqueueTask(
        bootstrap,
        repoFullName,
        installationId,
        prNumber,
        logger
      );
      const body = createTaskBody(
        {
          task_type: MERGE_QUEUE_CALLBACK,
          pr_number: prNumber,
        },
        installationId,
        repoFullName
      );
      sinon.assert.calledOnceWithExactly(
        enqueueTaskStub,
        {
          id: '',
          body: JSON.stringify(body),
          name: 'schedule.repository',
        },
        sinon.match.instanceOf(GCFLogger),
        sinon.match.number
      );
    });
  });
  describe('createTaskBody', () => {
    it('formats the task correctly', () => {
      const repoFullName = 'googleapis/repo-automation-bots';
      const installationId = 12345;
      const prNumber = 1;
      const body = createTaskBody(
        {
          task_type: MERGE_QUEUE_CALLBACK,
          pr_number: prNumber,
        },
        installationId,
        repoFullName
      );
      assert(body.installation.id === installationId);
      assert(body.merge_effort_started_at === undefined);
      assert(body.pr_number === prNumber);
      const startTime = '20220903 00:00:00 z';
      const body2 = createTaskBody(
        {
          task_type: MERGE_QUEUE_CALLBACK,
          pr_number: prNumber,
          merge_effort_started_at: startTime,
        },
        installationId,
        repoFullName
      );
      assert(body2.merge_effort_started_at === startTime);
    });
  });

  describe('addPRToQueue', () => {
    before(() => {
      nock.enableNetConnect('127.0.0.1');
      nock.enableNetConnect('localhost');
      const options = {
        useDocker: true,
        clean: true,
      };

      emulator = new DataStoreEmulator(options);

      return emulator.start();
    });
    after(() => {
      emulator.stop();
      nock.disableNetConnect();
    });
    it('creates a new entity', async () => {
      const datastore = new Datastore();
      const logger = new GCFLogger();
      const repoFullName = 'googleapis/repo-automation-bots';
      const prNumber = 1;
      await addPRToQueue(datastore, repoFullName, prNumber, logger);
      const key = createQueueKey(datastore, repoFullName);
      const q: Queue = (await datastore.get(key))[0];
      assert(q.pullRequests.length === 1);
      assert(q.pullRequests[0] === prNumber);
    });
    it('adds a new prNumber', async () => {
      const datastore = new Datastore();
      const logger = new GCFLogger();
      const repoFullName = 'googleapis/repo-automation-bots';
      const prNumber = 1;
      await addPRToQueue(datastore, repoFullName, prNumber, logger);
      const key = createQueueKey(datastore, repoFullName);
      const q: Queue = (await datastore.get(key))[0];
      assert(q.pullRequests.length === 1);
      assert(q.pullRequests[0] === prNumber);

      const newPRNumber = 2;
      await addPRToQueue(datastore, repoFullName, newPRNumber, logger);
      const q2: Queue = (await datastore.get(key))[0];
      assert(q2.pullRequests.length === 2);
      assert(q2.pullRequests[1] === newPRNumber);
    });
  });
  describe('getQueue', () => {
    before(() => {
      nock.enableNetConnect('127.0.0.1');
      nock.enableNetConnect('localhost');
      const options = {
        useDocker: true,
        clean: true,
      };

      emulator = new DataStoreEmulator(options);

      return emulator.start();
    });
    after(() => {
      emulator.stop();
      nock.disableNetConnect();
    });
    it('gets a Queue from the datastore', async () => {
      const datastore = new Datastore();
      const logger = new GCFLogger();
      const repoFullName = 'googleapis/repo-automation-bots';
      const prNumber = 1;
      await addPRToQueue(datastore, repoFullName, prNumber, logger);
      const q = await getQueue(datastore, repoFullName);
      assert(q);
      assert(q.pullRequests.length === 1);
      assert(q.pullRequests[0] === prNumber);
    });
  });
  describe('removePRFromQueue', () => {
    before(() => {
      nock.enableNetConnect('127.0.0.1');
      nock.enableNetConnect('localhost');
      const options = {
        useDocker: true,
        clean: true,
      };

      emulator = new DataStoreEmulator(options);

      return emulator.start();
    });
    after(() => {
      emulator.stop();
      nock.disableNetConnect();
    });
    it('removes a PR from the queue', async () => {
      const datastore = new Datastore();
      const logger = new GCFLogger();
      const repoFullName = 'googleapis/repo-automation-bots';
      const prNumber = 1;
      await addPRToQueue(datastore, repoFullName, prNumber, logger);
      const q = await getQueue(datastore, repoFullName);
      assert(q);
      assert(q.pullRequests.length === 1);
      assert(q.pullRequests[0] === prNumber);

      // Removes it
      await removePRFromQueue(datastore, repoFullName, prNumber, logger);
      const q2 = await getQueue(datastore, repoFullName);
      assert(q2);
      assert(q2.pullRequests.length === 0);
    });
  });
});
