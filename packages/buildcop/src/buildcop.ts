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
 *  - xunitXML: the base64 encoded xUnit XML log.
 *  - buildID: a unique build ID for this build. If there are multiple jobs
 *    for the same build (e.g. for different language versions), they should all
 *    use the same buildID.
 *  - buildURL: URL to link to for a build.
 *  - repo: the repo being tested (e.g. GoogleCloudPlatform/golang-samples).
 */

import { Application } from 'probot';
import { LoggerWithTarget } from 'probot/lib/wrap-logger';
import { GitHubAPI } from 'probot/lib/github';
import xmljs from 'xml-js';
import Octokit from '@octokit/rest';

const LABELS = 'buildcop:issue';

interface TestFailure {
  package: string;
  testCase: string;
}

export interface BuildCopPayload {
  repo: string;
  organization: { login: string }; // Filled in by gcf-utils.
  repository: { name: string }; // Filled in by gcf-utils.
  buildID: string;
  buildURL: string;
  xunitXML: string; // Base64 encoded to avoid JSON escaping issues.
}

interface PubSubContext {
  readonly event: string;
  github: GitHubAPI;
  log: LoggerWithTarget;
  payload: BuildCopPayload;
}

export function buildcop(app: Application) {
  app.on('pubsub.message', async (context: PubSubContext) => {
    console.log(context.payload);
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;
    const buildID = context.payload.buildID || '[TODO: set buildID]';
    const buildURL = context.payload.buildURL || '[TODO: set buildURL]';

    const xml = Buffer.from(context.payload.xunitXML, 'base64').toString();

    if (!xml) {
      context.log.info(`[${owner}/${repo}] No XML payload! Skipping.`);
      return;
    }

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

      const failures = buildcop.findFailures(xml);

      // Open issues for failing tests.
      await buildcop.openIssues(
        failures,
        issues,
        context,
        owner,
        repo,
        buildID,
        buildURL
      );
      // Close issues for passing tests.
      await buildcop.closeIssues(
        failures,
        issues,
        context,
        owner,
        repo,
        buildID,
        buildURL
      );
    } catch (err) {
      app.log.error(`${err.message} processing ${repo}`);
      console.info(err);
    }
  });
}

// For every failure, check if an issue is open. If not, open/reopen one.
buildcop.openIssues = async (
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
      return issue.title === buildcop.formatFailure(failure);
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
        body: buildcop.formatBody(failure, buildID, buildURL),
      });
    } else {
      const newIssue = (
        await context.github.issues.create({
          owner,
          repo,
          title: buildcop.formatFailure(failure),
          body: buildcop.formatBody(failure, buildID, buildURL),
          labels: LABELS.split(','),
        })
      ).data;
      context.log.info(`[${owner}/${repo}]: created issue #${newIssue.number}`);
    }
  }
};

// For every buildcop issue, if it's not in the failures and it didn't
// previously fail in the same build, close it.
buildcop.closeIssues = async (
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
      return issue.title === buildcop.formatFailure(failure);
    });
    // If the test failed, don't close its issue.
    if (failure) {
      continue;
    }

    // If the issue body is a failure in the same build, don't do anything.
    if (buildcop.containsBuildFailure(issue.body, buildID)) {
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
      buildcop.containsBuildFailure(comment.body, buildID)
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

buildcop.formatBody = (
  failure: TestFailure,
  buildID: string,
  buildURL: string
): string => {
  const failureText = buildcop.formatFailure(failure);
  return `${failureText}\nbuildID: ${buildID}\nbuildURL: ${buildURL}\nstatus: failed`;
};

buildcop.containsBuildFailure = (text: string, buildID: string): boolean => {
  return (
    text.includes(`buildID: ${buildID}`) && text.includes('status: failed')
  );
};

buildcop.formatFailure = (failure: TestFailure): string => {
  let pkg = failure.package;
  const shorten = failure.package.match(/github\.com\/[^\/]+\/[^\/]+\/(.+)/);
  if (shorten) {
    pkg = shorten[1];
  }
  return `${pkg}: ${failure.testCase} failed`;
};

buildcop.findFailures = (xml: string): TestFailure[] => {
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
