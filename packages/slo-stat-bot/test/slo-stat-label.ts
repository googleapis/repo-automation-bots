// Copyright 2020 Google LLC
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
//

import {resolve} from 'path';
import {Probot} from 'probot';
import nock from 'nock';
import * as fs from 'fs';
import * as assert from 'assert';
import {describe, it, beforeEach, afterEach} from 'mocha';

// eslint-disable-next-line node/no-extraneous-import
import Webhooks from '@octokit/webhooks';
import snapshot from 'snap-shot-it';
import handler from '../src/slo-stat-label';
import spies from 'chai-spies';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const chai = require('chai');
chai.use(spies);

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sinon = require('sinon');

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('slo-status-label', () => {
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
    probot.load(handler);
  });

  describe('opened or reopened pull request', () => {
    let payload: Webhooks.WebhookPayloadPullRequest;
    const sandbox = sinon.createSandbox();

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'pull_request_opened'));
      sandbox.stub(handler, 'handle_slos');
    });

    afterEach(() => {
      sandbox.restore();
      nock.cleanAll;
    });

    it('Error is logged if get list of files fails', async () => {
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(404);

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('triggers handle_slos function since issue_slo_rules.json is present', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const containsSloFile = require(resolve(
        fixturesPath,
        'events',
        'contains_slo_file'
      ));
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(200, containsSloFile);
      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(handler.handle_slos);
      requests.done();
    });

    it('does not trigger handle_slos function since issue_slo_rules.json is not present', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const doesNotContainSLOFile = require(resolve(
        fixturesPath,
        'events',
        'not_contains_slo_file'
      ));
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(200, doesNotContainSLOFile);

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(handler.handle_slos);
      requests.done();
    });
  });

  describe('handleSLOs triggered', async () => {
    let payload: Webhooks.WebhookPayloadPullRequest;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'pull_request_opened'));
    });

    afterEach(() => {
      nock.cleanAll;
    });

    it('Error is logged if get file content fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const containsSloFile = require(resolve(
        fixturesPath,
        'events',
        'contains_slo_file'
      ));
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(202, containsSloFile)
        .get(
          '/repos/testOwner/testRepo/git/blobs/1d8be9e05d65e03a5e81a1c3c1bf229dce950e25'
        )
        .reply(404, {});

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('Error is logged if comment on PR fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const containsSloFile = require(resolve(
        fixturesPath,
        'events',
        'contains_slo_file'
      ));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const blob = require(resolve(fixturesPath, 'events', 'invalid_blob'));
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(202, containsSloFile)
        .get(
          '/repos/testOwner/testRepo/git/blobs/1d8be9e05d65e03a5e81a1c3c1bf229dce950e25'
        )
        .reply(202, blob)
        .post('/repos/testOwner/testRepo/issues/6/comments', body => {
          snapshot(body);
          return true;
        })
        .reply(404);

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('Error is logged if create check fails', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const containsSloFile = require(resolve(
        fixturesPath,
        'events',
        'contains_slo_file'
      ));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const blob = require(resolve(fixturesPath, 'events', 'invalid_blob'));
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(202, containsSloFile)
        .get(
          '/repos/testOwner/testRepo/git/blobs/1d8be9e05d65e03a5e81a1c3c1bf229dce950e25'
        )
        .reply(202, blob)
        .post('/repos/testOwner/testRepo/issues/6/comments', body => {
          snapshot(body);
          return true;
        })
        .reply(202)
        .post('/repos/testOwner/testRepo/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(404);

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('An error comment is made on PR and failure check if issue_slo_rules lint is not valid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const containsSloFile = require(resolve(
        fixturesPath,
        'events',
        'contains_slo_file'
      ));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const blob = require(resolve(fixturesPath, 'events', 'invalid_blob'));
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(200, containsSloFile)
        .get(
          '/repos/testOwner/testRepo/git/blobs/1d8be9e05d65e03a5e81a1c3c1bf229dce950e25'
        )
        .reply(200, blob)
        .post('/repos/testOwner/testRepo/issues/6/comments', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .post('/repos/testOwner/testRepo/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('No comment on PR and success check if issue_slo_rules lint is valid', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const containsSloFile = require(resolve(
        fixturesPath,
        'events',
        'contains_slo_file'
      ));
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const blob = require(resolve(fixturesPath, 'events', 'valid_blob'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(200, containsSloFile)
        .get(
          '/repos/testOwner/testRepo/git/blobs/1d8be9e05d65e03a5e81a1c3c1bf229dce950e25'
        )
        .reply(200, blob)
        .post('/repos/testOwner/testRepo/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });
  });

  describe('checking validation by using linter', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const schema = require('./../utils/schema.json');

    it('Valid slos return true', async () => {
      const files = fs.readdirSync(
        resolve(fixturesPath, 'events', 'issue_slo_rules', 'valid_slos')
      );

      for (const fileName of files) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const slo = require(resolve(
          fixturesPath,
          'events',
          'issue_slo_rules',
          'valid_slos',
          fileName
        ));
        const validRes = await handler.lint(schema, slo);
        const isValid = await validRes.isValid;

        assert.strictEqual(isValid, true);
      }
    });

    it('Invalid slos return false', async () => {
      const files = fs.readdirSync(
        resolve(fixturesPath, 'events', 'issue_slo_rules', 'invalid_slos')
      );

      for (const fileName of files) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const slo = require(resolve(
          fixturesPath,
          'events',
          'issue_slo_rules',
          'invalid_slos',
          fileName
        ));
        const validRes = await handler.lint(schema, slo);
        const isValid = await validRes.isValid;

        assert.strictEqual(isValid, false);
      }
    });
  });
});
