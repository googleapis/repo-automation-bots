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

/**
 * The build cop bot manages issues for unit tests.
 *
 * The input payload should include:
 *  - xunit_xml: the xUnit XML log.
 *  - buildID: a unique build ID for this build. If there are multiple jobs
 *    for the same build (e.g. for different language versions), they should all
 *    use the same buildID.
 *  - buildURL: URL to link to for a build.
 *  - owner: the repo owner (e.g. googleapis).
 *  - repo: the name of the repo (e.g. golang-samples).
 */

// define types for a few modules used by probot that do not have their
// own definitions published. Before taking this step, folks should first
// check whether type bindings are already published.

import { Application, Context } from 'probot';
import xmljs from 'xml-js';
import Octokit from '@octokit/rest';
import Webhooks from '@octokit/webhooks';

// FAKE_XUNIT_XML is used for faking the XML data when developing the bot.
// Once the bot is hooked up to Pub/Sub, this can be deleted, along with
// updating the payload parsing below.
const FAKE_XUNIT_XML = `
<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
	<testsuite tests="3" failures="0" time="46.786" name="github.com/GoogleCloudPlatform/golang-samples">
		<properties>
			<property name="go.version" value="go1.13.1"></property>
		</properties>
		<testcase classname="golang-samples" name="TestBadFiles" time="0.020"></testcase>
		<testcase classname="golang-samples" name="TestLicense" time="0.080"></testcase>
		<testcase classname="golang-samples" name="TestRegionTags" time="46.680"></testcase>
	</testsuite>
	<testsuite tests="10" failures="3" time="29.487" name="github.com/GoogleCloudPlatform/golang-samples/storage/buckets">
		<properties>
			<property name="go.version" value="go1.13.1"></property>
		</properties>
		<testcase classname="buckets" name="TestCreate" time="1.190"></testcase>
		<testcase classname="buckets" name="TestCreateWithAttrs" time="4.290"></testcase>
		<testcase classname="buckets" name="TestList" time="0.550"></testcase>
		<testcase classname="buckets" name="TestGetBucketMetadata" time="0.480"></testcase>
		<testcase classname="buckets" name="TestIAM" time="2.390"></testcase>
		<testcase classname="buckets" name="TestRequesterPays" time="1.610"></testcase>
		<testcase classname="buckets" name="TestKMS" time="0.940"></testcase>
		<testcase classname="buckets" name="TestBucketLock" time="17.500">
			<failure message="Failed" type="">main_test.go:234: failed to create bucket (&#34;golang-samples-tests-8-storage-buckets-tests&#34;): Post https://storage.googleapis.com/storage/v1/b?alt=json&amp;prettyPrint=false&amp;project=golang-samples-tests-8: read tcp 10.142.0.112:33618-&gt;108.177.12.128:443: read: connection reset by peer</failure>
		</testcase>
		<testcase classname="buckets" name="TestUniformBucketLevelAccess" time="0.190">
			<failure message="Failed" type="">main_test.go:242: failed to enable uniform bucket-level access (&#34;golang-samples-tests-8-storage-buckets-tests&#34;): googleapi: Error 404: Not Found, notFound</failure>
		</testcase>
		<testcase classname="buckets" name="TestDelete" time="0.340">
			<failure message="Failed" type="">main_test.go:268: failed to delete bucket (&#34;golang-samples-tests-8-storage-buckets-tests&#34;): googleapi: Error 404: Not Found, notFound</failure>
		</testcase>
	</testsuite>
	<testsuite tests="1" failures="0" time="3.817" name="github.com/GoogleCloudPlatform/golang-samples/storage/gcsupload">
		<properties>
			<property name="go.version" value="go1.13.1"></property>
		</properties>
		<testcase classname="gcsupload" name="TestUpload" time="3.810"></testcase>
	</testsuite>
</testsuites>
`;

const LABELS = 'buildcop:issue';

interface TestFailure {
  package: string;
  testCase: string;
}

interface PubSubPayload {
  repository: Webhooks.PayloadRepository;
  buildID: string;
  buildURL: string;
  xunitXML: string;
}

type PubSubContext = Context<PubSubPayload>;

function handler(app: Application) {
  // TODO: find the right app.on event args.
  app.on('*', async (context: PubSubContext) => {
    // TODO: remove when you have the right app.on args.
    // context.log.info(JSON.stringify(context, null, 2));
    if (context.name !== 'star') {
      return;
    }

    // TODO: Update to match real Pub/Sub payload.
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const buildID = context.payload.buildID || '[TODO: set buildID]';
    const buildURL = context.payload.buildURL || '[TODO: set buildURL]';
    // TODO: remove FAKE_XML.
    const xml = context.payload.xunitXML || FAKE_XUNIT_XML;

    try {
      // Get the list of issues once, before opening/closing any of them.
      const issues = (
        await context.github.issues.listForRepo({
          owner,
          repo,
          per_page: 32,
          labels: LABELS,
          state: 'all', // Include open and closed issues.
        })
      ).data;

      const failures = handler.findFailures(xml);

      // Open issues for failing tests.
      await handler.openIssues(
        failures,
        issues,
        context,
        owner,
        repo,
        buildID,
        buildURL
      );
      // Close issues for passing tests.
      await handler.closeIssues(
        failures,
        issues,
        context,
        owner,
        repo,
        buildID,
        buildURL
      );
    } catch (err) {
      console.info(err);
      app.log.error(`${err.message} processing ${repo}`);
    }
  });
}

// For every failure, check if an issue is open. If not, open/reopen one.
handler.openIssues = async (
  failures: TestFailure[],
  issues: Octokit.IssuesListForRepoResponseItem[],
  context: PubSubContext,
  owner: string,
  repo: string,
  buildID: string,
  buildURL: string
) => {
  for (const failure of failures) {
    // Look for an existing issue. If there are multiple, pick one at
    // random.
    // TODO: what if one is closed and one is open? We should prefer the
    // open one and close duplicates.
    const existingIssue = issues.find(issue => {
      return issue.title === handler.formatFailure(failure);
    });
    if (existingIssue) {
      context.log.info(
        `[${owner}/${repo}] existing issue #${existingIssue.number}: state: ${existingIssue.state}`
      );
      if (existingIssue.state === 'closed') {
        context.log.info(
          `[${owner}/${repo}] reopening issue #${existingIssue.number}`
        );
        await context.github.issues.update({
          owner,
          repo,
          issue_number: existingIssue.number,
          state: 'open',
        });
      }
      // TODO: Make this comment say something nice about reopening the
      // issue?
      await context.github.issues.createComment({
        owner,
        repo,
        issue_number: existingIssue.number,
        body: handler.formatBody(failure, buildID, buildURL),
      });
    } else {
      const newIssue = (
        await context.github.issues.create({
          owner,
          repo,
          title: handler.formatFailure(failure),
          body: handler.formatBody(failure, buildID, buildURL),
          labels: LABELS.split(','),
        })
      ).data;
      context.log.info(`[${owner}/${repo}]: created issue #${newIssue.number}`);
    }
  }
};

// For every buildcop issue, if it's not in the failures and it didn't
// previously fail in the same build, close it.
handler.closeIssues = async (
  failures: TestFailure[],
  issues: Octokit.IssuesListForRepoResponseItem[],
  context: PubSubContext,
  owner: string,
  repo: string,
  buildID: string,
  buildURL: string
) => {
  for (const issue of issues) {
    if (issue.state === 'closed') {
      continue;
    }
    const failure = failures.find(failure => {
      return issue.title === handler.formatFailure(failure);
    });
    // If the test failed, don't close its issue.
    if (failure) {
      continue;
    }

    // If the issue body is a failure in the same build, don't do anything.
    if (handler.containsBuildFailure(issue.body, buildID)) {
      break;
    }

    // Check if there is a comment from the same build ID with a failure.
    const comments = (
      await context.github.issues.listComments({
        owner,
        repo,
        issue_number: issue.number,
      })
    ).data;
    const comment = comments.find(comment =>
      handler.containsBuildFailure(comment.body, buildID)
    );
    // If there is a failure comment, don't do anything.
    if (comment) {
      break;
    }

    // The test passed and there is no previous failure in the same build.
    // If another job in the same build fails in the future, it will reopen
    // the issue.
    context.log.info(
      `[${owner}/${repo}] closing issue #${issue.number}: ${issue.title}`
    );
    await context.github.issues.createComment({
      owner,
      repo,
      issue_number: issue.number,
      body: `Test passed in build ${buildID} (${buildURL})! Closing this issue.`,
    });
    await context.github.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      state: 'closed',
    });
  }
};

handler.formatBody = (
  failure: TestFailure,
  buildID: string,
  buildURL: string
): string => {
  const failureText = handler.formatFailure(failure);
  return `${failureText}\nbuildID: ${buildID}\nbuildURL: ${buildURL}\nstatus: failed`;
};

handler.containsBuildFailure = (text: string, buildID: string): boolean => {
  return (
    text.includes(`buildID: ${buildID}`) && text.includes('status: failed')
  );
};

handler.formatFailure = (failure: TestFailure): string => {
  let pkg = failure.package;
  const shorten = failure.package.match(/github\.com\/[^\/]+\/[^\/]+\/(.+)/);
  if (shorten) {
    pkg = shorten[1];
  }
  return `${pkg}: ${failure.testCase} failed`;
};

handler.findFailures = (xml: string): TestFailure[] => {
  const obj = xmljs.xml2js(xml);
  const failures: TestFailure[] = [];
  for (const suites of obj.elements) {
    if (suites.name !== 'testsuites') {
      continue;
    }
    for (const suite of suites.elements) {
      if (suite.name !== 'testsuite') {
        continue;
      }
      const testsuiteName = suite.attributes.name;
      for (const testcase of suite.elements) {
        if (testcase.name !== 'testcase') {
          continue;
        }
        if (testcase.elements === undefined) {
          continue;
        }
        for (const failure of testcase.elements) {
          // The testcase elements include skipped tests. Ensure we have a
          // failure.
          if (failure.name !== 'failure') {
            continue;
          }
          failures.push({
            package: testsuiteName,
            testCase: testcase.attributes.name,
          });
          break;
        }
        // console.log(JSON.stringify(testcase, null, 2));
      }
    }
  }
  return failures;
};

export = handler;
