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
 *  - build_id: a unique build ID for this build. If there are multiple jobs
 *    for the same build (e.g. for different language versions), they should all
 *    use the same build_id.
 *  - build_url: URL to link to for a build.
 *  - owner: the repo owner (e.g. googleapis).
 *  - repo: the name of the repo (e.g. golang-samples).
 */

// define types for a few modules used by probot that do not have their
// own definitions published. Before taking this step, folks should first
// check whether type bindings are already published.

import { Application, Context } from 'probot';
import { GitHubAPI } from 'probot/lib/github';
import * as util from 'util';
import xmljs from 'xml-js';

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
`

const LABELS = 'buildcop:issue';

function handler (app: Application) {
  // TODO: find the right app.on event args.
  app.on('*', async context => {
    // TODO: remove when you have the right app.on args.
    // context.log.info(JSON.stringify(context, null, 2));
    if (context.name != "star") {
      return;
    }

    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;

    try {
      // Get the list of issues once, before opening/closing any of them.
      const issues = (
        await context.github.issues.listForRepo({
          owner: owner,
          repo: repo,
          per_page: 32,
          labels: LABELS,
          state: "all"  // Include open and closed issues.
        })
      ).data;

      const build_id = context.payload.build_id || "[TODO: set build_id]";
      const build_url = context.payload.build_url || "[TODO: set build_url]"
      // TODO: remove FAKE_XML.
      const xml = context.payload.xunit_xml || FAKE_XUNIT_XML;
      const failures = handler.findFailures(xml);

      await handler.openIssues(failures, issues, context, owner, repo, build_id, build_url);
      await handler.closeIssues(failures, issues, context, owner, repo, build_id, build_url);
    } catch (err) {
      console.info(err);
      app.log.error(`${err.message} processing ${repo}`);
    }
  });
};

// For every failure, check if an issue is open. If not, open/reopen one.
handler.openIssues = async (failures: any, issues: any, context: any, owner: string, repo: string, build_id: string, build_url: string) => {
  for (const failure of failures) {
    // Look for an existing issue. If there are multiple, pick one at
    // random.
    // TODO: what if one is closed and one is open? We should prefer the
    // open one and close duplicates.
    const existingIssue = issues.find((issue: any) => {
      return issue.title === handler.formatFailure(failure);
    });
    if (existingIssue) {
      context.log.info(`existing matching issue: state: ${existingIssue.state}`);
      if (existingIssue.state === "closed") {
        await context.github.issues.update({
          owner,
          repo,
          issue_number: existingIssue.number,
          state: 'open'
        });
      }
      // TODO: Make this comment say something nice about reopening the
      // issue?
      await context.github.issues.createComment({
        owner,
        repo,
        issue_number: existingIssue.number,
        body: handler.formatBody(failure, build_id, build_url)
      });
    }
    else {
      context.log.info("no matching issue: opening a new one");
      await context.github.issues.create({
        owner,
        repo,
        title: handler.formatFailure(failure),
        body: handler.formatBody(failure, build_id, build_url),
        labels: LABELS.split(","),
      });
    }
  };
}

// For every buildcop issue, if it's not in the failures and it didn't
// previously fail in the same build, close it.
handler.closeIssues = async (failures: any, issues: any, context: any, owner: string, repo: string, build_id: string, build_url: string) => {
  for (const issue of issues) {
    if (issue.state === "closed") {
      continue;
    }
    const failure = failures.find((failure: any) => {
      return issue.title === handler.formatFailure(failure);
    });
    // If the test failed, don't close its issue.
    if (failure) {
      continue;
    }

    // If the issue body is a failure in the same build, don't do anything.
    if (handler.containsBuildFailure(issue.body, build_id)) {
      break;
    }

    // Check if there is a comment from the same build ID with a failure.
    const comments = (await context.github.issues.listComments({
      owner,
      repo,
      issue_number: issue.number,
    })).data;
    const comment = comments.find((comment: any) => handler.containsBuildFailure(comment.body, build_id));
    // If there is a failure comment, don't do anything.
    if (comment) {
      break;
    }

    // The test passed and there is no previous failure in the same build.
    // If another job in the same build fails in the future, it will reopen
    // the issue.
    context.log.info(`closing issue ${issue.number}: ${issue.title}`)
    await context.github.issues.createComment({
      owner,
      repo,
      issue_number: issue.number,
      body: `Test passed in build ${build_id} (${build_url})! Closing this issue.`
    });
    await context.github.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      state: 'closed'
    });
  }
}

handler.formatBody = (issue: any, build_id: string, build_url: string) => {
  const failureText = handler.formatFailure(issue);
  return `${failureText}\nbuild_id: ${build_id}\nbuild_url: ${build_url}\nstatus: failed`;
}

handler.containsBuildFailure = (text: string, build_id: string) => {
  return text.includes(`build_id: ${build_id}`) && text.includes('status: failed');
}

handler.formatFailure = (failure: any) => {
  let pkg = failure.package
  const shorten = failure.package.match(/github\.com\/[^\/]+\/[^\/]+\/(.+)/);
  if (shorten) {
    pkg = shorten[1];
  }
  return `${pkg}: ${failure.testCase} failed`
}

handler.findFailures = (xml: string) => {
  const obj = xmljs.xml2js(xml);
  var failures = [];
  for (const suites of obj.elements) {
    if (suites.name != "testsuites") {
      continue;
    }
    for (const suite of suites.elements) {
      if (suite.name != "testsuite") {
        continue;
      }
      var testsuiteName = suite.attributes.name;
      for (const testcase of suite.elements) {
        if (testcase.name != "testcase") {
          continue;
        }
        if (testcase.elements == undefined) {
          continue;
        }
        for (const failure of testcase.elements) {
          // The testcase elements include skipped tests. Ensure we have a
          // failure.
          if (failure.name != "failure") {
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
