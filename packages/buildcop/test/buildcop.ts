/**
 * Copyright 2019 Google LLC. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import myProbotApp from '../src/buildcop';
const { findFailures } = myProbotApp;

import { resolve } from 'path';
import { Probot } from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';
import { expect } from 'chai';
import handler from '../src/buildcop';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('buildcop', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      // use a bare instance of octokit, the default version
      // enables retries which makes testing difficult.
      Octokit: require('@octokit/rest'),
    });

    const app = probot.load(myProbotApp);
    app.app = {
      getSignedJsonWebToken() {
        return 'abc123';
      },
      getInstallationAccessToken(): Promise<string> {
        return Promise.resolve('abc123');
      },
    };
  });

  describe('findFailures', () => {
    it('finds one failure', () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'one_failed.xml'),
        'utf8'
      );
      const failures = findFailures(input);
      expect(failures).to.eql([
        {
          package:
            'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
          testCase: 'TestSample',
        },
      ]);
    });

    it('finds many failures in one package', () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'many_failed_same_pkg.xml'),
        'utf8'
      );
      const failures = findFailures(input);
      expect(failures).to.eql([
        {
          package:
            'github.com/GoogleCloudPlatform/golang-samples/storage/buckets',
          testCase: 'TestBucketLock',
        },
        {
          package:
            'github.com/GoogleCloudPlatform/golang-samples/storage/buckets',
          testCase: 'TestUniformBucketLevelAccess',
        },
        {
          package:
            'github.com/GoogleCloudPlatform/golang-samples/storage/buckets',
          testCase: 'TestDelete',
        },
      ]);
    });

    it('finds no failures in a successful log', () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'passed.xml'),
        'utf8'
      );
      const failures = findFailures(input);
      expect(failures).to.eql([]);
    });

    it('opens an issue', async () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'one_failed.xml'),
        'utf8'
      );
      const payload = require(resolve(
        fixturesPath,
        './events/issue_unlabeled'
      ));
      payload.xunitXML = input;

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
        )
        .reply(200, [])
        .post('/repos/tbpg/golang-samples/issues', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({ name: 'star', payload, id: 'abc123' });

      requests.done();
    });
  });

  describe('app', () => {
    it('comments on existing issue', async () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'one_failed.xml'),
        'utf8'
      );
      const payload = require(resolve(
        fixturesPath,
        './events/issue_unlabeled'
      ));
      payload.xunitXML = input;

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
        )
        .reply(200, [
          {
            title: handler.formatFailure({
              package:
                'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
              testCase: 'TestSample',
            }),
            number: 16,
            body: 'Failure!',
            state: 'open',
          },
        ])
        .post('/repos/tbpg/golang-samples/issues/16/comments', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({ name: 'star', payload, id: 'abc123' });

      requests.done();
    });

    it('reopens issue for failing test', async () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'one_failed.xml'),
        'utf8'
      );
      const payload = require(resolve(
        fixturesPath,
        './events/issue_unlabeled'
      ));
      payload.xunitXML = input;

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
        )
        .reply(200, [
          {
            title: handler.formatFailure({
              package:
                'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
              testCase: 'TestSample',
            }),
            number: 16,
            body: 'Failure!',
            state: 'closed',
          },
        ])
        .post('/repos/tbpg/golang-samples/issues/16/comments', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .patch('/repos/tbpg/golang-samples/issues/16', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({ name: 'star', payload, id: 'abc123' });

      requests.done();
    });

    it('closes an issue for a passing test', async () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'passed.xml'),
        'utf8'
      );
      const payload = require(resolve(
        fixturesPath,
        './events/issue_unlabeled'
      ));
      payload.xunitXML = input;

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
        )
        .reply(200, [
          {
            title: handler.formatFailure({
              package:
                'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
              testCase: 'TestSample',
            }),
            number: 16,
            body: 'Failure!',
          },
        ])
        .post('/repos/tbpg/golang-samples/issues/16/comments', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get('/repos/tbpg/golang-samples/issues/16/comments')
        .reply(200, [])
        .patch('/repos/tbpg/golang-samples/issues/16', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({ name: 'star', payload, id: 'abc123' });

      requests.done();
    });

    it('keeps an issue open for a passing test that failed in the same build (comment)', async () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'passed.xml'),
        'utf8'
      );
      const payload = require(resolve(
        fixturesPath,
        './events/issue_unlabeled'
      ));
      payload.xunitXML = input;
      payload.buildID = 123;

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
        )
        .reply(200, [
          {
            title: handler.formatFailure({
              package:
                'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
              testCase: 'TestSample',
            }),
            number: 16,
            body: 'Failure!',
          },
        ])
        .get('/repos/tbpg/golang-samples/issues/16/comments')
        .reply(200, [
          {
            body: `status: failed\nbuildID: ${payload.buildID}`,
          },
        ]);

      await probot.receive({ name: 'star', payload, id: 'abc123' });

      requests.done();
    });

    it('keeps an issue open for a passing test that failed in the same build (issue body)', async () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'passed.xml'),
        'utf8'
      );
      const payload = require(resolve(
        fixturesPath,
        './events/issue_unlabeled'
      ));
      payload.xunitXML = input;
      payload.buildID = 123;

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
        )
        .reply(200, [
          {
            title: handler.formatFailure({
              package:
                'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
              testCase: 'TestSample',
            }),
            number: 16,
            body: `status: failed\nbuildID: ${payload.buildID}`,
          },
        ]);

      await probot.receive({ name: 'star', payload, id: 'abc123' });

      requests.done();
    });

    it('opens multiple issues for multiple failures', async () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'many_failed_same_pkg.xml'),
        'utf8'
      );
      const payload = require(resolve(
        fixturesPath,
        './events/issue_unlabeled'
      ));
      payload.xunitXML = input;
      payload.buildID = 123;

      const requests = nock('https://api.github.com')
        .get(
          '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
        )
        .reply(200, [
          {
            title: handler.formatFailure({
              package:
                'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
              testCase: 'TestSample',
            }),
            number: 16,
            body: 'Failure!',
            state: 'closed',
          },
        ])
        .post('/repos/tbpg/golang-samples/issues', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .post('/repos/tbpg/golang-samples/issues', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .post('/repos/tbpg/golang-samples/issues', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      await probot.receive({ name: 'star', payload, id: 'abc123' });

      requests.done();
    });
  });

  describe('formatBody and containsBuildFailure', () => {
    it('correctly finds a failure', () => {
      const buildID = "my-build-id";
      const buildURL = "my.build.url";
      const failure = {
        package: "my-package",
        testCase: "my-test",
      }
      const body = handler.formatBody(failure, buildID, buildURL);
      expect(handler.containsBuildFailure(body, buildID)).to.be.true;
    });
    it('corectly does not find a failure', () => {
      const failure = {
        package: "my-package",
        testCase: "my-test",
      }
      const body = handler.formatBody(failure, "my-build-id", "my.build.url");
      expect(handler.containsBuildFailure(body, "other-build-id")).to.be.false;
    })
  })
});
