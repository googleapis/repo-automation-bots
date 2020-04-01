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

const ISSUE_LABEL = 'buildcop: issue';
const FLAKY_LABEL = 'buildcop: flaky';
const BUG_LABELS = 'type: bug,priority: p1';

const LABELS_FOR_FLAKY_ISSUE = BUG_LABELS.split(',').concat([
  ISSUE_LABEL,
  FLAKY_LABEL,
]);
const LABELS_FOR_NEW_ISSUE = BUG_LABELS.split(',').concat([ISSUE_LABEL]);

const EVERYTHING_FAILED_TITLE = 'The build failed';

const FLAKY_MESSAGE = `Looks like this issue is flaky. :worried:

I'm going to leave this open and stop commenting.

A human should fix and close this.`;

const FLAKY_AGAIN_MESSAGE = `Oops! Looks like this issue is still flaky. :grimacing:

I reopened the issue, but a human will need to close it again.`;

interface TestCase {
  package?: string;
  testCase?: string;
}

interface TestResults {
  passes: TestCase[];
  failures: TestCase[];
}

export interface BuildCopPayload {
  repo: string;
  organization: { login: string }; // Filled in by gcf-utils.
  repository: { name: string }; // Filled in by gcf-utils.
  buildID: string;
  buildURL: string;

  xunitXML?: string; // Base64 encoded to avoid JSON escaping issues. Fill in to get separate issues for separate tests.
  testsFailed?: boolean; // Whether the entire build failed. Ignored if xunitXML is set.
}

interface PubSubContext {
  readonly event: string;
  github: GitHubAPI;
  log: LoggerWithTarget;
  payload: BuildCopPayload;
}

export function buildcop(app: Application) {
  app.on('pubsub.message', async (context: PubSubContext) => {
    const owner = context.payload.organization?.login;
    const repo = context.payload.repository?.name;
    const buildID = context.payload.buildID || '[TODO: set buildID]';
    const buildURL = context.payload.buildURL || '[TODO: set buildURL]';

    let results: TestResults;
    if (context.payload.xunitXML) {
      const xml = Buffer.from(context.payload.xunitXML, 'base64').toString();
      results = buildcop.findTestResults(xml);
    } else {
      if (context.payload.testsFailed === undefined) {
        context.log.info(
          `[${owner}/${repo}] No xunitXML and no testsFailed! Skipping.`
        );
        return;
      }
      if (context.payload.testsFailed) {
        results = { passes: [], failures: [{}] }; // A single failure is used to indicate the whole build failed.
      } else {
        results = { passes: [], failures: [] }; // Tests passed.
      }
    }

    try {
      // Get the list of issues once, before opening/closing any of them.
      const options = context.github.issues.listForRepo.endpoint.merge({
        owner,
        repo,
        per_page: 100,
        labels: ISSUE_LABEL,
        state: 'all', // Include open and closed issues.
      });
      let issues = await context.github.paginate(options);

      // If we deduplicate any issues, re-download the issues.
      if (
        await buildcop.deduplicateIssues(results, issues, context, owner, repo)
      ) {
        issues = await context.github.paginate(options);
      }

      // Open issues for failing tests (including flaky tests).
      await buildcop.openIssues(
        results.failures,
        issues,
        context,
        owner,
        repo,
        buildID,
        buildURL
      );
      // Close issues for passing tests (unless they're flaky).
      await buildcop.closeIssues(
        results,
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

// deduplicateIssues closes any duplicate issues and returns whether or not any
// were modified.
// Only issues for tests in results are modified.
buildcop.deduplicateIssues = async (
  results: TestResults,
  issues: Octokit.IssuesListForRepoResponseItem[],
  context: PubSubContext,
  owner: string,
  repo: string
) => {
  const tests = results.passes.concat(results.failures);
  issues = issues.filter(
    issue =>
      issue.state === 'open' &&
      tests.find(test => issue.title === buildcop.formatTestCase(test))
  );
  const byTitle = new Map<string, Octokit.IssuesListForRepoResponseItem[]>();
  for (const issue of issues) {
    byTitle.set(issue.title, byTitle.get(issue.title) || []);
    byTitle.get(issue.title)?.push(issue);
  }

  let modified = false;

  for (const [title, issues] of byTitle) {
    if (issues.length <= 1) {
      continue;
    }
    modified = true;
    // All of the issues will be closed except for the first one. So, sort by
    // flakiness and issue number.
    issues.sort((a, b) => {
      if (buildcop.isFlaky(a) && !buildcop.isFlaky(b)) {
        return -1;
      }
      if (!buildcop.isFlaky(a) && buildcop.isFlaky(b)) {
        return 1;
      }
      return a.number - b.number;
    });
    // Keep the first issue, close the others.
    const issue = issues.shift();
    for (const dup of issues) {
      context.log.info(
        `[${owner}/${repo}] closing issue #${dup.number} as duplicate of #${issue?.number}`
      );
      await context.github.issues.createComment({
        owner,
        repo,
        issue_number: dup.number,
        body: `Closing as a duplicate of #${issue?.number}`,
      });
      await context.github.issues.update({
        owner,
        repo,
        issue_number: dup.number,
        state: 'closed',
      });
    }
  }

  return modified;
};

// For every failure, check if an issue is open. If not, open/reopen one.
buildcop.openIssues = async (
  failures: TestCase[],
  issues: Octokit.IssuesListForRepoResponseItem[],
  context: PubSubContext,
  owner: string,
  repo: string,
  buildID: string,
  buildURL: string
) => {
  for (const failure of failures) {
    // Only reopen issues for individual test cases, not for the "everything
    // failed" issue. If the "everything failed" issue is already open, leave it
    // open.
    const matchingIssues = issues.filter(
      issue => issue.title === buildcop.formatTestCase(failure)
    );
    // Prefer open issues in case there are duplicates.
    let existingIssue = matchingIssues.find(issue => issue.state === 'open');

    if (
      matchingIssues.length > 0 &&
      !existingIssue &&
      buildcop.formatTestCase(failure) !== EVERYTHING_FAILED_TITLE
    ) {
      existingIssue = matchingIssues[0];
    }

    if (existingIssue) {
      context.log.info(
        `[${owner}/${repo}] existing issue #${existingIssue.number}: state: ${existingIssue.state}`
      );
      if (existingIssue.state === 'closed') {
        // If the issue is closed, we know the bot opened and closed it in the
        // past. So, this is probably a flaky test. A human should close it.
        context.log.info(
          `[${owner}/${repo}] reopening issue #${existingIssue.number}`
        );
        await context.github.issues.update({
          owner,
          repo,
          issue_number: existingIssue.number,
          labels: LABELS_FOR_FLAKY_ISSUE,
          state: 'open',
        });
        let body = FLAKY_MESSAGE;
        // If the issue was flaky and we reopen it (again), say so.
        if (buildcop.isFlaky(existingIssue)) {
          body = FLAKY_AGAIN_MESSAGE;
        }
        body = body + '\n\n' + buildcop.formatBody(failure, buildID, buildURL);
        await context.github.issues.createComment({
          owner,
          repo,
          issue_number: existingIssue.number,
          body,
        });
      } else {
        // TODO: this can be spammy (https://github.com/googleapis/repo-automation-bots/issues/282).

        // Don't comment if it's flaky.
        if (buildcop.isFlaky(existingIssue)) {
          return;
        }

        await context.github.issues.createComment({
          owner,
          repo,
          issue_number: existingIssue.number,
          body: buildcop.formatBody(failure, buildID, buildURL),
        });
      }
    } else {
      const newIssue = (
        await context.github.issues.create({
          owner,
          repo,
          title: buildcop.formatTestCase(failure),
          body: buildcop.formatBody(failure, buildID, buildURL),
          labels: LABELS_FOR_NEW_ISSUE,
        })
      ).data;
      context.log.info(`[${owner}/${repo}]: created issue #${newIssue.number}`);
    }
  }
};

// For every buildcop issue, if it's not flaky and it passed and it didn't
// previously fail in the same build, close it.
buildcop.closeIssues = async (
  results: TestResults,
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

    // Don't close flaky issues.
    if (buildcop.isFlaky(issue)) {
      context.log.info(
        `[${owner}/${repo}] not closing flaky issue #${issue.number}`
      );
      continue;
    }

    const failure = results.failures.find(failure => {
      return issue.title === buildcop.formatTestCase(failure);
    });
    // If the test failed, don't close its issue.
    if (failure) {
      continue;
    }

    const pass = results.passes.find(pass => {
      return issue.title === buildcop.formatTestCase(pass);
    });
    // If the test did not pass, don't close its issue.
    if (!pass) {
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

buildcop.isFlaky = (issue: Octokit.IssuesListForRepoResponseItem): boolean => {
  if (issue.labels === undefined) {
    return false;
  }
  for (const label of issue.labels) {
    if (label.name === FLAKY_LABEL) {
      return true;
    }
  }
  return false;
};

buildcop.formatBody = (
  failure: TestCase,
  buildID: string,
  buildURL: string
): string => {
  const failureText = buildcop.formatTestCase(failure);
  return `${failureText}\nbuildID: ${buildID}\nbuildURL: ${buildURL}\nstatus: failed`;
};

buildcop.containsBuildFailure = (text: string, buildID: string): boolean => {
  return (
    text.includes(`buildID: ${buildID}`) && text.includes('status: failed')
  );
};

buildcop.formatTestCase = (failure: TestCase): string => {
  if (!failure.package || !failure.testCase) {
    return EVERYTHING_FAILED_TITLE;
  }
  let pkg = failure.package;
  const shorten = failure.package.match(/github\.com\/[^\/]+\/[^\/]+\/(.+)/);
  if (shorten) {
    pkg = shorten[1];
  }
  return `${pkg}: ${failure.testCase} failed`;
};

buildcop.findTestResults = (xml: string): TestResults => {
  const obj = xmljs.xml2js(xml, { compact: true }) as xmljs.ElementCompact;
  const failures: TestCase[] = [];
  const passes: TestCase[] = [];
  // Python doesn't always have a top-level testsuites element.
  let testsuites = obj['testsuite'];
  if (testsuites === undefined) {
    testsuites = obj['testsuites']['testsuite'];
  }
  // If there is only one test suite, put it into an array to make it iterable.
  if (!Array.isArray(testsuites)) {
    testsuites = [testsuites];
  }
  for (const suite of testsuites) {
    const testsuiteName = suite['_attributes'].name;
    let testcases = suite['testcase'];
    // If there were no tests in the package, continue.
    if (testcases === undefined) {
      continue;
    }
    // If there is only one test case, put it into an array to make it iterable.
    if (!Array.isArray(testcases)) {
      testcases = [testcases];
    }
    for (const testcase of testcases) {
      let pkg = testsuiteName;
      if (testsuiteName === 'pytest') {
        pkg = testcase['_attributes'].classname;
      }
      const failure = testcase['failure'];
      if (failure === undefined) {
        passes.push({
          package: pkg,
          testCase: testcase['_attributes'].name,
        });
        continue;
      }
      failures.push({
        package: pkg,
        testCase: testcase['_attributes'].name,
      });
    }
  }
  return { passes, failures };
};
