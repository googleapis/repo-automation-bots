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

import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, ProbotOctokit} from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';
import * as assert from 'assert';
import {describe, it, beforeEach} from 'mocha';
import * as sinon from 'sinon';

import {flakybot, CONFIG_FILENAME} from '../src/flakybot';
import {ConfigChecker} from '../src/config';
const {findTestResults, formatTestCase} = flakybot;

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

function buildPayload(inputFixture: string, repo: string) {
  const input = fs.readFileSync(
    resolve(fixturesPath, 'testdata', inputFixture),
    'utf8'
  );

  return {
    repo: `GoogleCloudPlatform/${repo}`,
    organization: {login: 'GoogleCloudPlatform'},
    repository: {name: repo},
    commit: '123',
    buildURL: 'http://example.com',
    xunitXML: Buffer.from(input).toString('base64'),
  };
}

function nockIssues(repo: string, issues: Array<{}> = []) {
  return nock('https://api.github.com')
    .get(
      `/repos/GoogleCloudPlatform/${repo}/issues?per_page=100&labels=flakybot%3A%20issue&state=all`
    )
    .reply(200, issues);
}

function nockNewIssue(repo: string) {
  return nock('https://api.github.com')
    .post(`/repos/GoogleCloudPlatform/${repo}/issues`, body => {
      snapshot(body);
      return true;
    })
    .reply(200);
}

function nockGetConfig(repo: string, configString: string) {
  return nock('https://api.github.com')
    .get(
      `/repos/GoogleCloudPlatform/${repo}/contents/.github%2F${CONFIG_FILENAME}`
    )
    .reply(200, Buffer.from(configString).toString('base64'));
}

function nockGetIssueComments(
  repo: string,
  issueNumber: number,
  comments: Array<{}> = []
) {
  return nock('https://api.github.com')
    .get(`/repos/GoogleCloudPlatform/${repo}/issues/${issueNumber}/comments`)
    .reply(200, comments);
}

function nockIssueComment(repo: string, issueNumber: number) {
  return nock('https://api.github.com')
    .post(
      `/repos/GoogleCloudPlatform/${repo}/issues/${issueNumber}/comments`,
      body => {
        snapshot(body);
        return true;
      }
    )
    .reply(200);
}

function nockIssuePatch(repo: string, issueNumber: number) {
  return nock('https://api.github.com')
    .patch(`/repos/GoogleCloudPlatform/${repo}/issues/${issueNumber}`, body => {
      snapshot(body);
      return true;
    })
    .reply(200);
}

describe('flakybot', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      githubToken: 'abc123',
      Octokit: ProbotOctokit.defaults({
        retry: {enabled: false},
        throttle: {enabled: false},
      }),
    });
    probot.load(flakybot);
  });

  describe('pullRequestHandler', () => {
    it('calls ConfigChecker', async () => {
      const payload = require(resolve(fixturesPath, './pr_event'));
      const checkerStub = sinon
        .stub(ConfigChecker.prototype, 'validateConfigChanges')
        .resolves(undefined);
      await probot.receive({
        name: 'pull_request',
        payload,
        id: 'abc123',
      });
      // Only checks if it' called with a pull request event.
      sinon.assert.calledOnce(checkerStub);
    });
  });

  describe('extractBuildURL', () => {
    it('finds a build URL', () => {
      const want = '[Build Status](example.com/my/build)';
      const input = flakybot.formatBody(
        {passed: false, testCase: 'TestHello'},
        'abc',
        want
      );
      const result = flakybot.extractBuildURL(input);
      assert.strictEqual(result, want);
    });
  });

  describe('findTestResults', () => {
    it('finds one failure', () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'one_failed.xml'),
        'utf8'
      );
      const results = findTestResults(input);
      assert.deepStrictEqual(results, {
        failures: [
          {
            package:
              'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
            testCase: 'TestSample',
            passed: false,
            log:
              '\nsnippet_test.go:242: got output ""; want it to contain "4 Venue 4" snippet_test.go:243: got output ""; want it to contain "19 Venue 19" snippet_test.go:244: got output ""; want it to contain "42 Venue 42"\n',
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
      assert.deepStrictEqual(results, {
        failures: [
          {
            package:
              'github.com/GoogleCloudPlatform/golang-samples/storage/buckets',
            testCase: 'TestBucketLock',
            passed: false,
            log:
              'main_test.go:234: failed to create bucket ("golang-samples-tests-8-storage-buckets-tests"): Post https://storage.googleapis.com/storage/v1/b?alt=json&prettyPrint=false&project=golang-samples-tests-8: read tcp 10.142.0.112:33618->108.177.12.128:443: read: connection reset by peer',
          },
          {
            package:
              'github.com/GoogleCloudPlatform/golang-samples/storage/buckets',
            testCase: 'TestUniformBucketLevelAccess',
            passed: false,
            log:
              'main_test.go:242: failed to enable uniform bucket-level access ("golang-samples-tests-8-storage-buckets-tests"): googleapi: Error 404: Not Found, notFound',
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
      assert.deepStrictEqual(results, {
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
      assert.deepStrictEqual(results, {
        passes: [],
        failures: [],
      });
    });

    it('ignores skipped tests', () => {
      const input = fs.readFileSync(
        resolve(fixturesPath, 'testdata', 'go_skip.xml'),
        'utf8'
      );
      const results = findTestResults(input);
      assert.deepStrictEqual(results, {
        failures: [],
        passes: [
          {
            package: 'github.com/GoogleCloudPlatform/golang-samples',
            testCase: 'TestLicense',
            passed: true,
          },
        ],
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
      assert.strictEqual(got, 'pubsub: TestPublish failed');
    });

    it('shortens test with / in name', () => {
      const got = formatTestCase({
        package: 'cloud.google.com/go/pubsub',
        testCase: 'TestPublish/One',
        passed: true,
      });
      assert.strictEqual(got, 'pubsub: TestPublish failed');
    });
  });

  describe('app', () => {
    it('skips when there is no XML and no testsFailed', async () => {
      const payload = {
        repo: 'GoogleCloudPlatform/golang-samples',
        organization: {login: 'GoogleCloudPlatform'},
        repository: {name: 'golang-samples'},
        commit: '123',
        buildURL: 'http://example.com',
      };

      const requests = nock('https://api.github.com');
      const configScope = nockGetConfig('golang-samples', '');
      await probot.receive({
        name: 'pubsub.message' as '*',
        payload,
        id: 'abc123',
      });
      requests.done();
      configScope.done();
    });

    describe('testsFailed', () => {
      it('opens an issue when testsFailed', async () => {
        const payload = {
          repo: 'GoogleCloudPlatform/golang-samples',
          organization: {login: 'GoogleCloudPlatform'},
          repository: {name: 'golang-samples'},
          commit: '123',
          buildURL: 'http://example.com',
          testsFailed: true,
        };

        const scopes = [
          nockIssues('golang-samples'),
          nockNewIssue('golang-samples'),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('opens an issue with priority p2', async () => {
        const payload = {
          repo: 'GoogleCloudPlatform/golang-samples',
          organization: {login: 'GoogleCloudPlatform'},
          repository: {name: 'golang-samples'},
          commit: '123',
          buildURL: 'http://example.com',
          testsFailed: true,
        };

        const scopes = [
          nockIssues('golang-samples'),
          nockNewIssue('golang-samples'),
          nockGetConfig('golang-samples', 'defaultIssuePriority: p2'),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('opens a new issue when testsFailed and there is a previous one closed', async () => {
        const payload = {
          repo: 'GoogleCloudPlatform/golang-samples',
          organization: {login: 'GoogleCloudPlatform'},
          repository: {name: 'golang-samples'},
          commit: '123',
          buildURL: 'http://example.com',
          testsFailed: true,
        };

        const scopes = [
          nockIssues('golang-samples', [
            {
              title: formatTestCase({passed: false}),
              number: 16,
              body: 'Failure!',
              state: 'closed',
            },
          ]),
          nockNewIssue('golang-samples'),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('comments on an existing open issue when testsFailed', async () => {
        const payload = {
          repo: 'GoogleCloudPlatform/golang-samples',
          organization: {login: 'GoogleCloudPlatform'},
          repository: {name: 'golang-samples'},
          commit: '123',
          buildURL: 'http://example.com',
          testsFailed: true,
        };

        const scopes = [
          nockIssues('golang-samples', [
            {
              title: formatTestCase({passed: false}),
              number: 16,
              body: 'Failure!',
              state: 'open',
            },
          ]),
          nockGetIssueComments('golang-samples', 16),
          nockIssueComment('golang-samples', 16),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });
    });

    describe('xunitXML', () => {
      it('opens an issue [Go]', async () => {
        const payload = buildPayload('one_failed.xml', 'golang-samples');

        const scopes = [
          nockIssues('golang-samples'),
          nockNewIssue('golang-samples'),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('opens an issue [Python]', async () => {
        const payload = buildPayload(
          'python_one_failed.xml',
          'python-docs-samples'
        );

        const scopes = [
          nockIssues('python-docs-samples'),
          nockNewIssue('python-docs-samples'),
          nockGetConfig('python-docs-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('opens an issue [Python error]', async () => {
        const payload = buildPayload(
          'python_one_error.xml',
          'python-docs-samples'
        );

        const scopes = [
          nockIssues('python-docs-samples'),
          nockNewIssue('python-docs-samples'),
          nockGetConfig('python-docs-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('opens an issue [Java]', async () => {
        const payload = buildPayload('java_one_failed.xml', 'java-vision');

        const scopes = [
          nockIssues('java-vision'),
          nockNewIssue('java-vision'),
          nockGetConfig('java-vision', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('opens an issue 2 [Java]', async () => {
        const payload = buildPayload('java_one_error.xml', 'java-datastore');

        const scopes = [
          nockIssues('java-datastore'),
          nockNewIssue('java-datastore'),
          nockGetConfig('java-datastore', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('opens an issue [Node.js]', async () => {
        const payload = buildPayload('node_one_failed.xml', 'nodejs-spanner');

        const scopes = [
          nockIssues('nodejs-spanner'),
          nockNewIssue('nodejs-spanner'),
          nockGetConfig('nodejs-spanner', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('opens an issue [Ruby]', async () => {
        const payload = buildPayload(
          'ruby_one_failed.xml',
          'ruby-docs-samples'
        );

        const scopes = [
          nockIssues('ruby-docs-samples'),
          nockNewIssue('ruby-docs-samples'),
          nockGetConfig('ruby-docs-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('comments on existing issue', async () => {
        const payload = buildPayload('one_failed.xml', 'golang-samples');

        const scopes = [
          nockIssues('golang-samples', [
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
          ]),
          nockGetIssueComments('golang-samples', 16),
          nockIssueComment('golang-samples', 16),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('does not comment about failure on existing flaky issue', async () => {
        const payload = buildPayload(
          'many_failed_same_pkg.xml',
          'golang-samples'
        );

        const scopes = [
          nockIssues('golang-samples', [
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/storage/buckets',
                testCase: 'TestBucketLock',
                passed: false,
              }),
              number: 16,
              body: 'Failure!',
              labels: [{name: 'flakybot: flaky'}],
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
              body: 'Failure!',
              state: 'open',
            },
          ]),
          nockGetIssueComments('golang-samples', 17),
          nockIssueComment('golang-samples', 17),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('does not comment about failure on existing issue labeled quiet', async () => {
        const payload = buildPayload(
          'many_failed_same_pkg.xml',
          'golang-samples'
        );

        const scopes = [
          nockIssues('golang-samples', [
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/storage/buckets',
                testCase: 'TestBucketLock',
                passed: false,
              }),
              number: 16,
              body: 'Failure!',
              labels: [{name: 'flakybot: quiet'}],
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
              body: 'Failure!',
              state: 'open',
            },
          ]),
          nockGetIssueComments('golang-samples', 17),
          nockIssueComment('golang-samples', 17),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('handles a testsuite with no test cases', async () => {
        const payload = buildPayload('no_tests.xml', 'golang-samples');

        const scopes = [
          nockIssues('golang-samples'),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('reopens issue with correct labels for failing test', async () => {
        const payload = buildPayload('one_failed.xml', 'golang-samples');

        // Closed yesterday. So, it should be reopened.
        const closedAt = new Date();
        closedAt.setDate(closedAt.getDate() - 1);

        const scopes = [
          nockIssues('golang-samples', [
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
                testCase: 'TestSample',
                passed: false,
              }),
              number: 16,
              body: 'Failure!',
              // All of these labels should be kept. New priority and type
              // labels should not be added.
              labels: [
                {name: 'flakybot: flaky'},
                {name: 'api: spanner'},
                {name: 'priority: p2'},
                {name: 'type: cleanup'},
              ],
              state: 'closed',
              closed_at: closedAt.toISOString(),
            },
          ]),
          nockIssueComment('golang-samples', 16),
          nockIssuePatch('golang-samples', 16),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('closes an issue for a passing test [Go]', async () => {
        const payload = buildPayload('passed.xml', 'golang-samples');

        const scopes = [
          nockIssues('golang-samples', [
            {
              title: formatTestCase({
                package: 'github.com/GoogleCloudPlatform/golang-samples',
                testCase: 'TestBadFiles',
                passed: false,
              }),
              number: 16,
              body: 'Failure!',
            },
          ]),
          nockIssueComment('golang-samples', 16),
          nockGetIssueComments('golang-samples', 16),
          nockIssuePatch('golang-samples', 16),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('closes an issue for a passing test [Python]', async () => {
        const payload = buildPayload(
          'python_one_passed.xml',
          'python-docs-samples'
        );

        const scopes = [
          nockIssues('python-docs-samples', [
            {
              title: formatTestCase({
                package: 'appengine.standard.app_identity.asserting.main_test',
                testCase: 'test_app',
                passed: false,
              }),
              number: 16,
              body: 'Failure!',
            },
          ]),
          nockIssueComment('python-docs-samples', 16),
          nockGetIssueComments('python-docs-samples', 16),
          nockIssuePatch('python-docs-samples', 16),
          nockGetConfig('python-docs-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('closes an issue for a passing test [Java]', async () => {
        const payload = buildPayload('java_one_passed.xml', 'java-vision');

        const scopes = [
          nockIssues('java-vision', [
            {
              title: formatTestCase({
                package: 'com.google.cloud.vision.it.ITSystemTest(sponge_log)',
                testCase: 'detectLocalizedObjectsTest',
                passed: false,
              }),
              number: 16,
              body: 'Failure!',
            },
          ]),
          nockIssueComment('java-vision', 16),
          nockGetIssueComments('java-vision', 16),
          nockIssuePatch('java-vision', 16),
          nockGetConfig('java-vision', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('does not close an issue that did not explicitly pass', async () => {
        const payload = buildPayload('passed.xml', 'golang-samples');

        const scopes = [
          nockIssues('golang-samples', [
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
          ]),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('keeps an issue open for a passing test that failed in the same build (comment)', async () => {
        const payload = buildPayload('passed.xml', 'golang-samples');

        const scopes = [
          nockIssues('golang-samples', [
            {
              title: formatTestCase({
                package: 'github.com/GoogleCloudPlatform/golang-samples',
                testCase: 'TestBadFiles',
                passed: false,
              }),
              number: 16,
              body: 'Failure!',
            },
          ]),
          nock('https://api.github.com')
            .get('/repos/GoogleCloudPlatform/golang-samples/issues/16/comments')
            .reply(200, [
              {
                body:
                  'status: failed\ncommit: 123\nbuildURL: [Build Status](example.com/failure)',
              },
            ]),
          nockIssueComment('golang-samples', 16),
          nockIssuePatch('golang-samples', 16),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('keeps an issue open for a passing test that failed in the same build (issue body)', async () => {
        const payload = buildPayload('passed.xml', 'golang-samples');

        const scopes = [
          nockIssues('golang-samples', [
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/appengine/go11x/helloworld',
                testCase: 'TestIndexHandler',
                passed: false,
              }),
              number: 16,
              body:
                'status: failed\ncommit: 123\nbuildURL: [Build Status](example.com/failure)',
            },
          ]),
          nockIssueComment('golang-samples', 16),
          nockIssuePatch('golang-samples', 16),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('does not comment for failure in the same build [Go]', async () => {
        const payload = buildPayload('one_failed.xml', 'golang-samples');

        const scopes = [
          nockIssues('golang-samples', [
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
                testCase: 'TestSample',
                passed: false,
              }),
              number: 16,
              body: 'Failure!',
            },
          ]),
          nock('https://api.github.com')
            .get('/repos/GoogleCloudPlatform/golang-samples/issues/16/comments')
            .reply(200, [
              {
                body: 'status: failed\ncommit: 123',
              },
            ]),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('keeps an issue open for a passing flaky test', async () => {
        const payload = buildPayload('passed.xml', 'golang-samples');

        const scopes = [
          nockIssues('golang-samples', [
            {
              title: formatTestCase({
                package:
                  'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
                testCase: 'TestSample',
                passed: false,
              }),
              number: 16,
              body: 'Failure!',
              labels: [{name: 'flakybot: flaky'}],
            },
          ]),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('opens multiple issues for multiple failures', async () => {
        const payload = buildPayload(
          'many_failed_same_pkg.xml',
          'golang-samples'
        );

        const scopes = [
          nockIssues('golang-samples', [
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
          ]),
          nockNewIssue('golang-samples'),
          nockNewIssue('golang-samples'),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('closes a duplicate issue', async () => {
        const payload = buildPayload('passed.xml', 'golang-samples');

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

        const scopes = [
          nockIssues('golang-samples', [
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
              labels: [{name: 'flakybot: flaky'}],
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
              labels: [{name: 'flakybot: flaky'}],
              state: 'open',
            },
          ]),
          nockIssueComment('golang-samples', 18),
          nockIssuePatch('golang-samples', 18),
          nockIssues('golang-samples'), // Real response would include all issues again.
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('reopens the original flaky issue when there is a duplicate', async () => {
        const payload = buildPayload('one_failed.xml', 'golang-samples');

        const title = formatTestCase({
          package:
            'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
          testCase: 'TestSample',
          passed: false,
        });

        const scopes = [
          nockIssues('golang-samples', [
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
              labels: [{name: 'flakybot: flaky'}],
              state: 'closed',
            },
          ]),
          nockIssueComment('golang-samples', 19),
          nockIssuePatch('golang-samples', 19),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('reopens the more recently closed issue when there is a duplicate', async () => {
        const payload = buildPayload('one_failed.xml', 'golang-samples');

        const title = formatTestCase({
          package:
            'github.com/GoogleCloudPlatform/golang-samples/spanner/spanner_snippets',
          testCase: 'TestSample',
          passed: false,
        });

        const sixDaysAgo = new Date();
        sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

        const scopes = [
          nockIssues('golang-samples', [
            {
              title,
              number: 18,
              body: 'Failure!',
              state: 'closed',
              closed_at: sixDaysAgo.toISOString(),
            },
            {
              title,
              number: 19, // Newer issue closed more recently.
              body: 'Failure!',
              state: 'closed',
              closed_at: fiveDaysAgo.toISOString(),
            },
          ]),
          nockIssueComment('golang-samples', 19),
          nockIssuePatch('golang-samples', 19),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('only opens one issue for a group of failures [Go]', async () => {
        const payload = buildPayload('go_failure_group.xml', 'golang-samples');

        const scopes = [
          nockIssues('golang-samples'),
          nockNewIssue('golang-samples'),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('opens a new issue when the original is locked [Go]', async () => {
        const payload = buildPayload('one_failed.xml', 'golang-samples');

        const scopes = [
          nockIssues('golang-samples', [
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
              locked: true,
            },
          ]),
          nockNewIssue('golang-samples'),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      it('opens a new issue when the original was closed a long time ago [Go]', async () => {
        const payload = buildPayload('one_failed.xml', 'golang-samples');

        const closedAt = new Date();
        closedAt.setDate(closedAt.getDate() - 20);
        const scopes = [
          nockIssues('golang-samples', [
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
              closed_at: closedAt.toISOString(),
            },
          ]),
          nockNewIssue('golang-samples'),
          nockGetConfig('golang-samples', ''),
        ];

        await probot.receive({
          name: 'pubsub.message' as '*',
          payload,
          id: 'abc123',
        });

        scopes.forEach(s => s.done());
      });

      describe('Grouped issues', () => {
        it('opens a single issue for many tests in the same package', async () => {
          const payload = buildPayload('node_group.xml', 'nodejs-spanner');

          const scopes = [
            nockIssues('nodejs-spanner', [
              {
                // Should be referenced as #8 in snapshot.
                title: flakybot.formatTestCase({
                  passed: false,
                  package: 'Spanner',
                  testCase:
                    'should delete and then insert rows in the example tables',
                }),
                number: 8,
                body: 'Failed',
                state: 'open,',
              },
            ]),
            nockNewIssue('nodejs-spanner'),
            nockGetConfig('nodejs-spanner', ''),
          ];

          await probot.receive({
            name: 'pubsub.message' as '*',
            payload,
            id: 'abc123',
          });

          scopes.forEach(s => s.done());
        });

        it('closes an individual issue and keeps grouped issue open', async () => {
          const payload = buildPayload('node_group.xml', 'nodejs-spanner');

          const scopes = [
            nockIssues('nodejs-spanner', [
              {
                title: flakybot.formatTestCase({
                  passed: false,
                  package: 'Spanner',
                  testCase: 'should create an example database',
                }),
                number: 9,
                body: 'Failed',
                state: 'open,',
              },
              {
                title: flakybot.formatGroupedTitle('Spanner'),
                number: 10,
                body: 'Group failure!',
                state: 'open',
              },
            ]),
            nockGetIssueComments('nodejs-spanner', 10),
            nockIssueComment('nodejs-spanner', 10),
            nockGetIssueComments('nodejs-spanner', 9),
            nockIssueComment('nodejs-spanner', 9),
            nockIssuePatch('nodejs-spanner', 9),
            nockGetConfig('nodejs-spanner', ''),
          ];

          await probot.receive({
            name: 'pubsub.message' as '*',
            payload,
            id: 'abc123',
          });

          scopes.forEach(s => s.done());
        });

        it('does not duplicate comment on grouped issue', async () => {
          const payload = buildPayload('node_group.xml', 'nodejs-spanner');

          const testCase = flakybot.groupedTestCase('Spanner');
          const scopes = [
            nockIssues('nodejs-spanner', [
              {
                title: flakybot.formatGroupedTitle('Spanner'),
                number: 10,
                body: 'Group failure!',
                state: 'open',
              },
            ]),
            nockGetIssueComments('nodejs-spanner', 10, [
              {
                body: flakybot.formatBody(testCase, '123', 'build.url'),
              },
            ]),
            nockGetConfig('nodejs-spanner', ''),
          ];

          await probot.receive({
            name: 'pubsub.message' as '*',
            payload,
            id: 'abc123',
          });

          scopes.forEach(s => s.done());
        });

        it('closes group issues when all tests pass', async () => {
          const payload = buildPayload('node_group_pass.xml', 'nodejs-spanner');

          const scopes = [
            nockIssues('nodejs-spanner', [
              {
                title: flakybot.formatTestCase({
                  passed: true,
                  package: 'Spanner',
                  testCase: 'should create an example database',
                }),
                number: 9,
                body: 'Failed',
                state: 'open,',
              },
              {
                title: flakybot.formatGroupedTitle('Spanner'),
                number: 10,
                body: 'Group failure!',
                state: 'open',
              },
            ]),
            nockIssueComment('nodejs-spanner', 9),
            nockGetIssueComments('nodejs-spanner', 9),
            nockIssuePatch('nodejs-spanner', 9),
            nockIssueComment('nodejs-spanner', 10),
            nockGetIssueComments('nodejs-spanner', 10),
            nockIssuePatch('nodejs-spanner', 10),
            nockGetConfig('nodejs-spanner', ''),
          ];

          await probot.receive({
            name: 'pubsub.message' as '*',
            payload,
            id: 'abc123',
          });

          scopes.forEach(s => s.done());
        });
      });
    });
  });
});
