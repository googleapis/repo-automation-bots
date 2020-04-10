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
            passed: false,
          },
        ],
        passes: [
          {
            package: 'github.com/GoogleCloudPlatform/golang-samples',
            testCase: 'TestBadFiles',
            passed: true,
          },
          {
            package: 'github.com/GoogleCloudPlatform/golang-samples',
            testCase: 'TestLicense',
            passed: true,
          },
          {
            package: 'github.com/GoogleCloudPlatform/golang-samples',
            testCase: 'TestRegionTags',
            passed: true,
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
            passed: false,
          },
          {
            package:
              'github.com/GoogleCloudPlatform/golang-samples/storage/buckets',
            testCase: 'TestUniformBucketLevelAccess',
            passed: false,
          },
        ],
        passes: [
          {
            package: 'github.com/GoogleCloudPlatform/golang-samples',
            testCase: 'TestBadFiles',
            passed: true,
          },
          {
            package:
              'github.com/GoogleCloudPlatform/golang-samples/storage/buckets',
            testCase: 'TestCreate',
            passed: true,
          },
          {
            package:
              'github.com/GoogleCloudPlatform/golang-samples/storage/gcsupload',
            testCase: 'TestUpload',
            passed: true,
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
            passed: true,
          },
          {
            package:
              'github.com/GoogleCloudPlatform/golang-samples/appengine/go11x/helloworld',
            testCase: 'TestIndexHandler',
            passed: true,
          },
        ],
      });
    });

    it('handles an empty testsuites', () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'empty_results.xml'),
        'utf8'
      );
      const results = findTestResults(input);
      expect(results).to.eql({
        passes: [],
        failures: [],
      });
    });
  });

  describe('formatTestCase', () => {
    it('shortens cloud.google.com/go', () => {
      const got = formatTestCase({
        package: 'cloud.google.com/go/pubsub',
        testCase: 'TestPublish',
        passed: true,
      });
      expect(got).to.equal('pubsub: TestPublish failed');
    });

    it('shortens test with / in name', () => {
      const got = formatTestCase({
        package: 'cloud.google.com/go/pubsub',
        testCase: 'TestPublish/One',
        passed: true,
      });
      expect(got).to.equal('pubsub: TestPublish failed');
    });
  });

  describe('app', () => {
    it('skips when there is no XML and no testsFailed', async () => {
      const payload = formatPayload({
        repo: 'tbpg/golang-samples',
        organization: { login: 'tbpg' },
        repository: { name: 'golang-samples' },
        commit: '123',
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
          commit: '123',
          buildURL: 'http://example.com',
          testsFailed: true,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
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
          commit: '123',
          buildURL: 'http://example.com',
          testsFailed: true,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({ passed: false }),
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
          commit: '123',
          buildURL: 'http://example.com',
          testsFailed: true,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({ passed: false }),
              number: 16,
              body: 'Failure!',
              state: 'open',
            },
          ])
          .get('/repos/tbpg/golang-samples/issues/16/comments')
          .reply(200, [])
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
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
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
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/python-docs-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
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

      it('opens an issue [Java]', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'java_one_failed.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/java-vision',
          organization: { login: 'tbpg' },
          repository: { name: 'java-vision' },
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/java-vision/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [])
          .post('/repos/tbpg/java-vision/issues', body => {
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
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            // Duplicate issue that's closed. The open one should be updated.
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
                testCase: 'TestSample',
                passed: false,
              }),
              number: 15,
              body: 'Failure!',
              state: 'closed',
            },
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
                testCase: 'TestSample',
                passed: false,
              }),
              number: 16,
              body: 'Failure!',
              state: 'open',
            },
          ])
          .get('/repos/tbpg/golang-samples/issues/16/comments')
          .reply(200, [])
          .post('/repos/tbpg/golang-samples/issues/16/comments', body => {
            snapshot(body);
            return true;
          })
          .reply(200);

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('does not comment about failure on existing flaky issue', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'many_failed_same_pkg.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/storage/buckets',
                testCase: 'TestBucketLock',
                passed: false,
              }),
              number: 16,
              body: `Failure!`,
              labels: [{ name: 'buildcop: flaky' }],
              state: 'open',
            },
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/storage/buckets',
                testCase: 'TestUniformBucketLevelAccess',
                passed: false,
              }),
              number: 17,
              body: `Failure!`,
              state: 'open',
            },
          ])
          .get('/repos/tbpg/golang-samples/issues/17/comments')
          .reply(200, [])
          .post('/repos/tbpg/golang-samples/issues/17/comments', body => {
            snapshot(body);
            return true;
          })
          .reply(200);

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('does not comment about failure on existing issue labeled quiet', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'many_failed_same_pkg.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/storage/buckets',
                testCase: 'TestBucketLock',
                passed: false,
              }),
              number: 16,
              body: `Failure!`,
              labels: [{ name: 'buildcop: quiet' }],
              state: 'open',
            },
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/storage/buckets',
                testCase: 'TestUniformBucketLevelAccess',
                passed: false,
              }),
              number: 17,
              body: `Failure!`,
              state: 'open',
            },
          ])
          .get('/repos/tbpg/golang-samples/issues/17/comments')
          .reply(200, [])
          .post('/repos/tbpg/golang-samples/issues/17/comments', body => {
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
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
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
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
                testCase: 'TestSample',
                passed: false,
              }),
              number: 16,
              body: 'Failure!',
              labels: [{ name: 'buildcop: flaky' }, { name: 'api: spanner' }],
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
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package: 'github.com/GoogleCloudPlatform/golang-samples',
                testCase: 'TestBadFiles',
                passed: false,
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
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/python-docs-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package: 'appengine.standard.app_identity.asserting.main_test',
                testCase: 'test_app',
                passed: false,
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

      it('closes an issue for a passing test [Java]', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'java_one_passed.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/java-vision',
          organization: { login: 'tbpg' },
          repository: { name: 'java-vision' },
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/java-vision/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package: 'com.google.cloud.vision.it.ITSystemTest(sponge_log)',
                testCase: 'detectLocalizedObjectsTest',
                passed: false,
              }),
              number: 16,
              body: 'Failure!',
            },
          ])
          .post('/repos/tbpg/java-vision/issues/16/comments', body => {
            snapshot(body);
            return true;
          })
          .reply(200)
          .get('/repos/tbpg/java-vision/issues/16/comments')
          .reply(200, [])
          .patch('/repos/tbpg/java-vision/issues/16', body => {
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
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/fake/test',
                testCase: 'TestFake',
                passed: false,
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
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package: 'github.com/GoogleCloudPlatform/golang-samples',
                testCase: 'TestBadFiles',
                passed: false,
              }),
              number: 16,
              body: 'Failure!',
            },
          ])
          .get('/repos/tbpg/golang-samples/issues/16/comments')
          .reply(200, [
            {
              body: `status: failed\ncommit: 123`,
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

      it('keeps an issue open for a passing test that failed in the same build (issue body)', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'passed.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/appengine/go11x/helloworld',
                testCase: 'TestIndexHandler',
                passed: false,
              }),
              number: 16,
              body: `status: failed\ncommit: 123`,
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

      it('keeps an issue open for a passing flaky test', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'passed.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
                testCase: 'TestSample',
                passed: false,
              }),
              number: 16,
              body: `Failure!`,
              labels: [{ name: 'buildcop: flaky' }],
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
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
                testCase: 'TestSample',
                passed: false,
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

      it('closes a duplicate issue', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'passed.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const title = formatTestCase({
          package:
            'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
          testCase: 'TestSample',
          passed: false,
        });
        const title2 = formatTestCase({
          package: 'appengine/go11x/helloworld',
          testCase: 'TestIndexHandler',
          passed: false,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            {
              title,
              number: 16,
              body: 'Failure!',
              state: 'open',
            },
            {
              title,
              number: 17,
              body: 'Failure!',
              labels: [{ name: 'buildcop: flaky' }],
              state: 'open',
            },
            {
              title: title2,
              number: 18,
              body: 'Failure!',
              state: 'open',
            },
            {
              title: title2,
              number: 19,
              body: 'Failure!',
              labels: [{ name: 'buildcop: flaky' }],
              state: 'open',
            },
          ])
          .post('/repos/tbpg/golang-samples/issues/18/comments', body => {
            snapshot(body);
            return true;
          })
          .reply(200)
          .patch('/repos/tbpg/golang-samples/issues/18', body => {
            snapshot(body);
            return true;
          })
          .reply(200)
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, []); // Real response would include all issues again.

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('reopens the original flaky issue when there is a duplicate', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'one_failed.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const title = formatTestCase({
          package:
            'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
          testCase: 'TestSample',
          passed: false,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
          )
          .reply(200, [
            {
              title,
              number: 18,
              body: 'Failure!',
              state: 'closed',
            },
            {
              title,
              number: 19,
              body: 'Failure!',
              labels: [{ name: 'buildcop: flaky' }],
              state: 'closed',
            },
          ])
          .post('/repos/tbpg/golang-samples/issues/19/comments', body => {
            snapshot(body);
            return true;
          })
          .reply(200)
          .patch('/repos/tbpg/golang-samples/issues/19', body => {
            snapshot(body);
            return true;
          })
          .reply(200);

        await probot.receive({ name: 'pubsub.message', payload, id: 'abc123' });

        requests.done();
      });

      it('only opens one issue for a group of failures [Go]', async () => {
        const input = fs.readFileSync(
          resolve(fixturesPath, 'testdata', 'go_failure_group.xml'),
          'utf8'
        );
        const payload = formatPayload({
          repo: 'tbpg/golang-samples',
          organization: { login: 'tbpg' },
          repository: { name: 'golang-samples' },
          commit: '123',
          buildURL: 'http://example.com',
          xunitXML: input,
        });

        const requests = nock('https://api.github.com')
          .get(
            '/repos/tbpg/golang-samples/issues?per_page=100&labels=buildcop%3A%20issue&state=all'
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
    });
  });
});
