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

import { buildcop, BuildCopPayload } from '../src/buildcop';
const { findTestResults, formatTestCase } = buildcop;

import { resolve } from 'path';
import { Probot } from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';
import { expect } from 'chai';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

function formatPayload(payload: BuildCopPayload) {
  if (payload.xunitXML) {
    payload.xunitXML = Buffer.from(payload.xunitXML).toString('base64');
  }
  return payload;
}

describe('buildcop', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      // use a bare instance of octokit, the default version
      // enables retries which makes testing difficult.
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
    probot.load(buildcop);
  });

  describe('findTestResults', () => {
    it('finds one failure', () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'one_failed.xml'),
        'utf8'
      );
      const results = findTestResults(input);
      expect(results).to.eql({
        failures: [
          {
            package:
              'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
            testCase: 'TestSample',
          },
        ],
        passes: [
          {
            package: 'github.com/GoogleCloudPlatform/golang-samples',
            testCase: 'TestBadFiles',
          },
          {
            package: 'github.com/GoogleCloudPlatform/golang-samples',
            testCase: 'TestLicense',
          },
          {
            package: 'github.com/GoogleCloudPlatform/golang-samples',
            testCase: 'TestRegionTags',
          },
        ],
      });
    });

    it('finds many failures in one package', () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'many_failed_same_pkg.xml'),
        'utf8'
      );
      const results = findTestResults(input);
      expect(results).to.eql({
        failures: [
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
        ],
        passes: [
          {
            package: 'github.com/GoogleCloudPlatform/golang-samples',
            testCase: 'TestBadFiles',
          },
          {
            package:
              'github.com/GoogleCloudPlatform/golang-samples/storage/buckets',
            testCase: 'TestCreate',
          },
          {
            package:
              'github.com/GoogleCloudPlatform/golang-samples/storage/gcsupload',
            testCase: 'TestUpload',
          },
        ],
      });
    });

    it('finds no failures in a successful log', () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'passed.xml'),
        'utf8'
      );
      const results = findTestResults(input);
      expect(results).to.eql({
        failures: [],
        passes: [
          {
            package: 'github.com/GoogleCloudPlatform/golang-samples',
            testCase: 'TestBadFiles',
          },
          {
            package:
              'github.com/GoogleCloudPlatform/golang-samples/appengine/go11x/helloworld',
            testCase: 'TestIndexHandler',
          },
        ],
      });
    });
  });

  describe('app', () => {
    it('skips when there is no XML and no testsFailed', async () => {
      const payload = formatPayload({
        repo: 'tbpg/golang-samples',
        organization: { login: 'tbpg' },
        repository: { name: 'golang-samples' },
        buildID: '123',
        buildURL: 'http://example.com',
      });

      const requests = nock('https://api.github.com');
      await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });
      requests.done();
    });

    describe('testsFailed', () => {
      it('opens an issue when testsFailed', async () => {
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          buildID: '123',
          buildURL: 'http://example.com',
          testsFailed: true,
        });

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

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('opens a new issue when testsFailed and there is a previous one closed', async () => {
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          buildID: '123',
          buildURL: 'http://example.com',
          testsFailed: true,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({}),
              number: 16,
              body: 'Failure!',
              state: 'closed',
            },
          ])
          .post('/repos/tbpg/golang-samples/issues', body => {
            snapshot(body);
            return true;
          })
          .reply(200);

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('comments on an existing open issue when testsFailed', async () => {
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          buildID: '123',
          buildURL: 'http://example.com',
          testsFailed: true,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({}),
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

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });
    });

    describe('xunitXML', () => {
      it('opens an issue [Go]', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'one_failed.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          buildID: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

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

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('opens an issue [Python]', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'python_one_failed.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/python-docs-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'python-docs-samples' },
          buildID: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/python-docs-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
          )
          .reply(200, [])
          .post('/repos/tbpg/python-docs-samples/issues', body => {
            snapshot(body);
            return true;
          })
          .reply(200);

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('comments on existing issue', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'one_failed.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          buildID: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
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

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('handles a testsuite with no test cases', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'no_tests.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          buildID: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
          )
          .reply(200, []);

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('reopens issue for failing test', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'one_failed.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          buildID: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
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

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('closes an issue for a passing test [Go]', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'passed.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          buildID: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package: 'github.com/GoogleCloudPlatform/golang-samples',
                testCase: 'TestBadFiles',
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

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('closes an issue for a passing test [Python]', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'python_one_passed.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/python-docs-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'python-docs-samples' },
          buildID: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/python-docs-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package: 'appengine.standard.app_identity.asserting.main_test',
                testCase: 'test_app',
              }),
              number: 16,
              body: 'Failure!',
            },
          ])
          .post('/repos/tbpg/python-docs-samples/issues/16/comments', body => {
            snapshot(body);
            return true;
          })
          .reply(200)
          .get('/repos/tbpg/python-docs-samples/issues/16/comments')
          .reply(200, [])
          .patch('/repos/tbpg/python-docs-samples/issues/16', body => {
            snapshot(body);
            return true;
          })
          .reply(200);

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('does not close an issue that did not explicitly pass', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'passed.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          buildID: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/fake/test',
                testCase: 'TestFake',
              }),
              number: 16,
              body: 'Failure!',
            },
          ]);

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('keeps an issue open for a passing test that failed in the same build (comment)', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'passed.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          buildID: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package: 'github.com/GoogleCloudPlatform/golang-samples',
                testCase: 'TestBadFiles',
              }),
              number: 16,
              body: 'Failure!',
            },
          ])
          .get('/repos/tbpg/golang-samples/issues/16/comments')
          .reply(200, [
            {
              body: `status: failed\nbuildID: 123`,
            },
          ]);

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('keeps an issue open for a passing test that failed in the same build (issue body)', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'passed.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          buildID: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
                testCase: 'TestSample',
              }),
              number: 16,
              body: `status: failed\nbuildID: 123`,
            },
          ]);

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('opens multiple issues for multiple failures', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'many_failed_same_pkg.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          buildID: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=32&labels=buildcop%3Aissue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
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
          .reply(200);

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });
    });
  });

  describe('formatBody and containsBuildFailure', () => {
    it('correctly finds a failure', () => {
      const buildID = 'my-build-id';
      const buildURL = 'my.build.url';
      const failure = {
        package: 'my-package',
        testCase: 'my-test',
      };
      const body = buildcop.formatBody(failure, buildID, buildURL);
      expect(buildcop.containsBuildFailure(body, buildID)).to.equal(true);
    });
    it('corectly does not find a failure', () => {
      const failure = {
        package: 'my-package',
        testCase: 'my-test',
      };
      const body = buildcop.formatBody(failure, 'my-build-id', 'my.build.url');
      expect(buildcop.containsBuildFailure(body, 'other-build-id')).to.equal(
        false
      );
    });
  });
});
