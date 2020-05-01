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
import {Probot} from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';
import {expect} from 'chai';
import {describe, it, beforeEach} from 'mocha';

import {buildcop} from '../src/buildcop';
const {findTestResults, formatTestCase} = buildcop;

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
      `/repos/GoogleCloudPlatform/${repo}/issues?per_page=100&labels=buildcop%3A%20issue&state=all`
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

function nockGetIssueComments(repo: string, issueNumber: number) {
  return nock('https://api.github.com')
    .get(`/repos/GoogleCloudPlatform/${repo}/issues/${issueNumber}/comments`)
    .reply(200, []);
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

describe('buildcop', () => {
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
    probot.load(buildcop);
  });

  describe('extractBuildURL', () => {
    it('finds a build URL', () => {
      const want = '[Build Status](example.com/my/build)';
      const input = buildcop.formatBody(
        {passed: false, testCase: 'TestHello'},
        'abc',
        want
      );
      const result = buildcop.extractBuildURL(input);
      expect(result).to.equal(want);
    });
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
      const payload = {
        repo: 'GoogleCloudPlatform/golang-samples',
        organization: {login: 'GoogleCloudPlatform'},
        repository: {name: 'golang-samples'},
        commit: '123',
        buildURL: 'http://example.com',
      };

      const requests = nock('https://api.github.com');
      await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});
      requests.done();
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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

        scopes.forEach(s => s.done());
      });
    });

    describe('xunitXML', () => {
      it('opens an issue [Go]', async () => {
        const payload = buildPayload('one_failed.xml', 'golang-samples');

        const scopes = [
          nockIssues('golang-samples'),
          nockNewIssue('golang-samples'),
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

        scopes.forEach(s => s.done());
      });

      it('opens an issue [Java]', async () => {
        const payload = buildPayload('java_one_failed.xml', 'java-vision');

        const scopes = [nockIssues('java-vision'), nockNewIssue('java-vision')];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
              labels: [{name: 'buildcop: flaky'}],
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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
              labels: [{name: 'buildcop: quiet'}],
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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

        scopes.forEach(s => s.done());
      });

      it('handles a testsuite with no test cases', async () => {
        const payload = buildPayload('no_tests.xml', 'golang-samples');

        const scopes = [nockIssues('golang-samples')];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
                {name: 'buildcop: flaky'},
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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
              labels: [{name: 'buildcop: flaky'}],
            },
          ]),
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
              labels: [{name: 'buildcop: flaky'}],
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
              labels: [{name: 'buildcop: flaky'}],
              state: 'open',
            },
          ]),
          nockIssueComment('golang-samples', 18),
          nockIssuePatch('golang-samples', 18),
          nockIssues('golang-samples'), // Real response would include all issues again.
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
              labels: [{name: 'buildcop: flaky'}],
              state: 'closed',
            },
          ]),
          nockIssueComment('golang-samples', 19),
          nockIssuePatch('golang-samples', 19),
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

        scopes.forEach(s => s.done());
      });

      it('only opens one issue for a group of failures [Go]', async () => {
        const payload = buildPayload('go_failure_group.xml', 'golang-samples');

        const scopes = [
          nockIssues('golang-samples'),
          nockNewIssue('golang-samples'),
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

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
        ];

        await probot.receive({name: 'pubsub.message', payload, id: 'abc123'});

        scopes.forEach(s => s.done());
      });
    });
  });
});
