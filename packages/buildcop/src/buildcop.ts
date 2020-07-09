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

/**
 * The build cop bot manages issues for unit tests.
 *
 * The input payload should include:
 *  - xunitXML: the base64 encoded xUnit XML log.
 *  - commit: the commit hash the build was for.
 *  - buildURL: URL to link to for a build.
 *  - repo: the repo being tested (e.g. GoogleCloudPlatform/golang-samples).
 */

// eslint-disable-next-line node/no-extraneous-import
import {Application} from 'probot';
// eslint-disable-next-line node/no-extraneous-import
import {LoggerWithTarget} from 'probot/lib/wrap-logger';
// eslint-disable-next-line node/no-extraneous-import
import {GitHubAPI} from 'probot/lib/github';
import xmljs from 'xml-js';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';

const ISSUE_LABEL = 'buildcop: issue';
const FLAKY_LABEL = 'buildcop: flaky';
const QUIET_LABEL = 'buildcop: quiet';
const BUG_LABELS = 'type: bug,priority: p1';

const LABELS_FOR_FLAKY_ISSUE = BUG_LABELS.split(',').concat([
  ISSUE_LABEL,
  FLAKY_LABEL,
]);
const LABELS_FOR_NEW_ISSUE = BUG_LABELS.split(',').concat([ISSUE_LABEL]);

const EVERYTHING_FAILED_TITLE = 'The build failed';

const NEW_ISSUE_MESSAGE = `This test failed!

To configure my behavior, see [the Build Cop Bot documentation](https://github.com/googleapis/repo-automation-bots/tree/master/packages/buildcop).

If I'm commenting on this issue too often, add the \`buildcop: quiet\` label and
I will stop commenting.

---`;

const FLAKY_MESSAGE = `Looks like this issue is flaky. :worried:

I'm going to leave this open and stop commenting.

A human should fix and close this.

---`;

const FLAKY_AGAIN_MESSAGE = `Oops! Looks like this issue is still flaky. It failed again. :grimacing:

I reopened the issue, but a human will need to close it again.

---`;

const GROUPED_MESSAGE = `Many tests failed at the same time in this package.

* I will close this issue when there are no more failures in this package _and_
  there is at least one pass.
* No new issues will be filed for this package until this issue is closed.
* If there are already issues for individual test cases, I will close them when
  the corresponding test passes. You can close them earlier, if you prefer, and
  I won't reopen them while this issue is still open.

`;

interface TestCase {
  package?: string;
  testCase?: string;
  passed: boolean;
  log?: string;
}

interface TestResults {
  passes: TestCase[];
  failures: TestCase[];
}

export interface BuildCopPayload {
  repo: string;
  organization: {login: string}; // Filled in by gcf-utils.
  repository: {name: string}; // Filled in by gcf-utils.
  commit: string;
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
    const commit = context.payload.commit || '[TODO: set commit]';
    const buildURL = context.payload.buildURL || '[TODO: set buildURL]';

    context.log.info(`[${owner}/${repo}] processing ${buildURL}`);

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
        results = {passes: [], failures: [{passed: false}]}; // A single failure is used to indicate the whole build failed.
      } else {
        results = {passes: [], failures: []}; // Tests passed.
      }
    }

    context.log.info(
      `[${owner}/${repo}] Found ${results.passes.length} passed tests and ${results.failures.length} failed tests in this result of ${buildURL}`
    );
    if (results.passes.length > 0) {
      context.log.info(
        `[${owner}/${repo}] example pass: ${results.passes[0].package}: ${results.passes[0].testCase}`
      );
    }
    if (results.failures.length > 0) {
      context.log.info(
        `[${owner}/${repo}] example failure: ${results.failures[0].package}: ${results.failures[0].testCase}`
      );
    }

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
      commit,
      buildURL
    );
    // Close issues for passing tests (unless they're flaky).
    await buildcop.closeIssues(
      results,
      issues,
      context,
      owner,
      repo,
      commit,
      buildURL
    );
  });
}

// deduplicateIssues closes any duplicate issues and returns whether or not any
// were modified.
// Only issues for tests in results are modified. So, an issue is only closed
// if it explicitly passes.
// TODO: Check if open issues can be shortened? This could be helpful if we add
// more shorteners and want "nice" management of "forgotten" issues.
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

  for (const issues of byTitle.values()) {
    if (issues.length <= 1) {
      continue;
    }
    modified = true;
    // All of the issues will be closed except for the first one. So, sort by
    // flakiness and issue number.
    issues.sort(buildcop.issueComparator);
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
  commit: string,
  buildURL: string
) => {
  // Group by package to see if there are any packages with 10+ failures.
  const byPackage = new Map<string, TestCase[]>();
  for (const failure of failures) {
    const pkg = failure.package || 'all';
    if (!byPackage.has(pkg)) byPackage.set(pkg, []);
    byPackage.get(pkg)!.push(failure);
  }
  for (const [pkg, pkgFailures] of byPackage.entries()) {
    // Look for an existing group issue. If there is one, don't file a new
    // issue.
    const groupedIssue = buildcop.findGroupedIssue(issues, pkg);
    if (groupedIssue) {
      // If a group issue exists, say stuff failed.
      // Don't comment if it's asked to be quiet.
      if (hasLabel(groupedIssue, QUIET_LABEL)) {
        continue;
      }

      // Don't comment if it's flaky.
      if (buildcop.isFlaky(groupedIssue)) {
        continue;
      }

      // Don't comment if we've already commented with this build failure.
      const [containsFailure] = await buildcop.containsBuildFailure(
        groupedIssue,
        context,
        owner,
        repo,
        commit
      );
      if (containsFailure) {
        continue;
      }

      const testCase = buildcop.groupedTestCase(pkg);
      const testString = pkgFailures.length === 1 ? 'test' : 'tests';
      const body = `${
        pkgFailures.length
      } ${testString} failed in this package for commit ${commit} (${buildURL}).\n\n-----\n${buildcop.formatBody(
        testCase,
        commit,
        buildURL
      )}`;
      await context.github.issues.createComment({
        owner,
        repo,
        issue_number: groupedIssue.number,
        body,
      });
      continue;
    }
    // There is no grouped issue for this package.
    // Check if 10 or more tests failed.
    if (pkgFailures.length >= 10) {
      // Open a new issue listing the failing tests.
      const testCase = buildcop.groupedTestCase(pkg);
      context.log.info(
        `[${owner}/${repo}]: creating issue "${buildcop.formatTestCase(
          testCase
        )}"...`
      );
      let failedTestsString = '';
      for (const failure of pkgFailures) {
        if (failure.testCase) {
          failedTestsString += '* ' + failure.testCase;
          const existingIssue = buildcop.findExistingIssue(issues, failure);
          if (existingIssue) {
            failedTestsString += ` (#${existingIssue.number})`;
          }
          failedTestsString += '\n';
        }
      }
      const body =
        GROUPED_MESSAGE +
        `Here are the tests that failed:\n${failedTestsString}\n\n-----\n${buildcop.formatBody(
          testCase,
          commit,
          buildURL
        )}`;
      const newIssue = (
        await context.github.issues.create({
          owner,
          repo,
          title: buildcop.formatGroupedTitle(pkg),
          body,
          labels: LABELS_FOR_NEW_ISSUE,
        })
      ).data;
      context.log.info(`[${owner}/${repo}]: created issue #${newIssue.number}`);
      continue;
    }
    // There is no grouped failure and there are <10 failing tests in this
    // package. Treat each failure independently.
    for (const failure of pkgFailures) {
      const existingIssue = buildcop.findExistingIssue(issues, failure);
      if (!existingIssue) {
        await buildcop.openNewIssue(
          context,
          owner,
          repo,
          commit,
          buildURL,
          failure
        );
        continue;
      }
      context.log.info(
        `[${owner}/${repo}] existing issue #${existingIssue.number}: state: ${existingIssue.state}`
      );
      if (existingIssue.state === 'closed') {
        // If there is an existing closed issue, it might be flaky.

        // If the issue is locked, we can't reopen it, so open a new one.
        if (existingIssue.locked) {
          await buildcop.openNewIssue(
            context,
            owner,
            repo,
            commit,
            buildURL,
            failure,
            `Note: #${existingIssue.number} was also for this test, but it is locked`
          );
          continue;
        }

        // If the existing issue has been closed for more than 10 days, open
        // a new issue instead.
        //
        // The type of closed_at is null. But, it is actually a string if the
        // issue is closed. Convert to unknown then to string as a workaround.
        // If this doesn't work, we'll mark the issue as flaky.
        const closedAtString = (existingIssue.closed_at as unknown) as string;
        if (closedAtString) {
          const closedAt = Date.parse(closedAtString);
          const daysAgo = 10;
          const daysAgoDate = new Date();
          daysAgoDate.setDate(daysAgoDate.getDate() - daysAgo);
          if (closedAt < daysAgoDate.getTime()) {
            await buildcop.openNewIssue(
              context,
              owner,
              repo,
              commit,
              buildURL,
              failure,
              `Note: #${existingIssue.number} was also for this test, but it was closed more than ${daysAgo} days ago. So, I didn't mark it flaky.`
            );
            continue;
          }
        }
        const reason = buildcop.formatBody(failure, commit, buildURL);
        await buildcop.markIssueFlaky(
          existingIssue,
          context,
          owner,
          repo,
          reason
        );
      } else {
        // Don't comment if it's asked to be quiet.
        if (hasLabel(existingIssue, QUIET_LABEL)) {
          continue;
        }

        // Don't comment if it's flaky.
        if (buildcop.isFlaky(existingIssue)) {
          continue;
        }

        // Don't comment if we've already commented with this build failure.
        const [containsFailure] = await buildcop.containsBuildFailure(
          existingIssue,
          context,
          owner,
          repo,
          commit
        );
        if (containsFailure) {
          continue;
        }

        await context.github.issues.createComment({
          owner,
          repo,
          issue_number: existingIssue.number,
          body: buildcop.formatBody(failure, commit, buildURL),
        });
      }
    }
  }
};

buildcop.findGroupedIssue = (
  issues: Octokit.IssuesListForRepoResponseItem[],
  pkg: string
): Octokit.IssuesListForRepoResponseItem | undefined => {
  // Don't reopen grouped issues.
  return issues.find(
    issue =>
      issue.title === buildcop.formatGroupedTitle(pkg) && issue.state === 'open'
  );
};

buildcop.findExistingIssue = (
  issues: Octokit.IssuesListForRepoResponseItem[],
  failure: TestCase
): Octokit.IssuesListForRepoResponseItem | undefined => {
  // Only reopen issues for individual test cases, not for the "everything
  // failed" issue. If the "everything failed" issue is already open, leave it
  // open.
  const matchingIssues = issues.filter(
    issue => issue.title === buildcop.formatTestCase(failure)
  );
  // Prefer open issues in case there are duplicates. There should only be at
  // most one open issue.
  let existingIssue = matchingIssues.find(issue => issue.state === 'open');

  if (
    matchingIssues.length > 0 &&
    !existingIssue &&
    buildcop.formatTestCase(failure) !== EVERYTHING_FAILED_TITLE
  ) {
    matchingIssues.sort(buildcop.issueComparator);
    existingIssue = matchingIssues[0];
  }
  return existingIssue;
};

buildcop.openNewIssue = async (
  context: PubSubContext,
  owner: string,
  repo: string,
  commit: string,
  buildURL: string,
  failure: TestCase,
  extraText?: string
) => {
  context.log.info(
    `[${owner}/${repo}]: creating issue "${buildcop.formatTestCase(
      failure
    )}"...`
  );
  let body = NEW_ISSUE_MESSAGE + '\n\n';
  if (extraText) {
    body = extraText + '\n\n----\n\n';
  }
  body += buildcop.formatBody(failure, commit, buildURL);
  const newIssue = (
    await context.github.issues.create({
      owner,
      repo,
      title: buildcop.formatTestCase(failure),
      body,
      labels: LABELS_FOR_NEW_ISSUE,
    })
  ).data;
  context.log.info(`[${owner}/${repo}]: created issue #${newIssue.number}`);
};

// For every buildcop issue, if it's not flaky and it passed and it didn't
// previously fail in the same build, close it.
buildcop.closeIssues = async (
  results: TestResults,
  issues: Octokit.IssuesListForRepoResponseItem[],
  context: PubSubContext,
  owner: string,
  repo: string,
  commit: string,
  buildURL: string
) => {
  for (const issue of issues) {
    if (issue.state === 'closed') {
      continue;
    }

    const failure = results.failures.find(failure => {
      return issue.title === buildcop.formatTestCase(failure);
    });
    // If the test failed, don't close its issue.
    if (failure) {
      continue;
    }

    const groupedFailure = results.failures.find(failure => {
      return (
        failure.package &&
        issue.title === buildcop.formatGroupedTitle(failure.package)
      );
    });
    // If this is a group issue and a test failed in the package, don't close.
    if (groupedFailure) {
      continue;
    }

    const pass = results.passes.find(pass => {
      // Either this is an individual test case that passed, or it's a group
      // issue with at least one pass (and no failures, given the groupedFailure
      // check above).
      return (
        issue.title === buildcop.formatTestCase(pass) ||
        (pass.package &&
          issue.title === buildcop.formatGroupedTitle(pass.package))
      );
    });
    // If the test did not pass, don't close its issue.
    if (!pass) {
      continue;
    }

    // Don't close flaky issues.
    if (buildcop.isFlaky(issue)) {
      context.log.info(
        `[${owner}/${repo}] #${issue.number} passed, but it's flaky, so I'm not closing it`
      );
      continue;
    }

    // If the issue has a failure in the same build, don't close it.
    // If it passed in one build and failed in another, it's flaky.
    const [containsFailure, failureURL] = await buildcop.containsBuildFailure(
      issue,
      context,
      owner,
      repo,
      commit
    );
    if (containsFailure) {
      const reason = `When run at the same commit (${commit}), this test passed in one build (${buildURL}) and failed in another build (${failureURL}).`;
      await buildcop.markIssueFlaky(issue, context, owner, repo, reason);
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
      body: `Test passed for commit ${commit} (${buildURL})! Closing this issue.`,
    });
    await context.github.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      state: 'closed',
    });
  }
};

buildcop.issueComparator = (
  a: Octokit.IssuesListForRepoResponseItem,
  b: Octokit.IssuesListForRepoResponseItem
) => {
  if (buildcop.isFlaky(a) && !buildcop.isFlaky(b)) {
    return -1;
  }
  if (!buildcop.isFlaky(a) && buildcop.isFlaky(b)) {
    return 1;
  }
  return a.number - b.number;
};

buildcop.isFlaky = (issue: Octokit.IssuesListForRepoResponseItem): boolean => {
  return hasLabel(issue, FLAKY_LABEL);
};

function hasLabel(
  issue: Octokit.IssuesListForRepoResponseItem,
  label: string
): boolean {
  if (issue.labels === undefined) {
    return false;
  }
  for (const l of issue.labels) {
    if (l.name === label) {
      return true;
    }
  }
  return false;
}

buildcop.markIssueFlaky = async (
  existingIssue: Octokit.IssuesListForRepoResponseItem,
  context: PubSubContext,
  owner: string,
  repo: string,
  reason: string
) => {
  context.log.info(
    `[${owner}/${repo}] marking issue #${existingIssue.number} as flaky`
  );
  const existingLabels = existingIssue.labels
    ?.map(l => l.name)
    .filter(l => !l.startsWith('buildcop'));
  let labelsToAdd = LABELS_FOR_FLAKY_ISSUE;
  // If existingLabels contains a priority or type label, don't add the
  // default priority and type labels.
  if (existingLabels?.find(l => l.startsWith('priority:'))) {
    labelsToAdd = labelsToAdd.filter(l => !l.startsWith('priority:'));
  }
  if (existingLabels?.find(l => l.startsWith('type:'))) {
    labelsToAdd = labelsToAdd.filter(l => !l.startsWith('type:'));
  }
  const labels = labelsToAdd.concat(existingLabels);
  await context.github.issues.update({
    owner,
    repo,
    issue_number: existingIssue.number,
    labels,
    state: 'open',
  });
  let body = buildcop.isFlaky(existingIssue)
    ? FLAKY_AGAIN_MESSAGE
    : FLAKY_MESSAGE;
  body += '\n\n' + reason;
  await context.github.issues.createComment({
    owner,
    repo,
    issue_number: existingIssue.number,
    body,
  });
};

buildcop.formatBody = (
  testCase: TestCase,
  commit: string,
  buildURL: string
): string => {
  // Warning: this format is used to detect flaky tests. Don't make breaking
  // changes.
  let body = `commit: ${commit}
buildURL: ${buildURL}
status: ${testCase.passed ? 'passed' : 'failed'}`;
  if (testCase.log) {
    body += `\n<details><summary>Test output</summary><br><pre>${testCase.log}</pre></details>`;
  }
  return body;
};

buildcop.containsBuildFailure = async (
  issue: Octokit.IssuesListForRepoResponseItem,
  context: PubSubContext,
  owner: string,
  repo: string,
  commit: string
): Promise<[boolean, string]> => {
  const text = issue.body;
  if (text.includes(`commit: ${commit}`) && text.includes('status: failed')) {
    const buildURL = buildcop.extractBuildURL(text);
    return [true, buildURL];
  }
  const options = context.github.issues.listComments.endpoint.merge({
    owner,
    repo,
    issue_number: issue.number,
  });
  const comments = await context.github.paginate(options);
  const comment = comments.find(
    comment =>
      comment.body.includes(`commit: ${commit}`) &&
      comment.body.includes('status: failed')
  );
  const containsFailure = comment !== undefined;
  const buildURL = buildcop.extractBuildURL(comment?.body);
  return [containsFailure, buildURL];
};

buildcop.extractBuildURL = (body: string): string => {
  if (!body) {
    return '';
  }
  const matches = body.match(/buildURL: (.*)/);
  if (!matches) {
    return '';
  }
  return matches[1];
};

buildcop.formatTestCase = (failure: TestCase): string => {
  if (!failure.package || !failure.testCase) {
    return EVERYTHING_FAILED_TITLE;
  }

  let pkg = failure.package;
  // pkgShorteners is a regex list where we should keep the matching group of
  // the package.
  const pkgShorteners = [
    /github\.com\/[^/]+\/[^/]+\/(.+)/,
    /com\.google\.cloud\.(.+)/,
    /(.+)\(sponge_log\)/,
    /cloud\.google\.com\/go\/(.+)/,
  ];
  pkgShorteners.forEach(s => {
    const shorten = pkg.match(s);
    if (shorten) {
      pkg = shorten[1];
    }
  });

  let name = failure.testCase;
  // nameShorteners is a regex list where we should keep the matching group of
  // the test name.
  const nameShorteners = [
    /([^/]+)\/.+/, // Keep "group" of "group/of/tests".
  ];
  nameShorteners.forEach(s => {
    const shorten = name.match(s);
    if (shorten) {
      name = shorten[1];
    }
  });

  return `${pkg}: ${name} failed`;
};

buildcop.groupedTestCase = (pkg: string): TestCase => {
  return {
    passed: false,
    package: pkg,
    testCase: 'many tests',
  };
};

buildcop.formatGroupedTitle = (pkg: string): string => {
  return buildcop.formatTestCase(buildcop.groupedTestCase(pkg));
};

buildcop.findTestResults = (xml: string): TestResults => {
  const obj = xmljs.xml2js(xml, {compact: true}) as xmljs.ElementCompact;
  const failures: TestCase[] = [];
  const passes: TestCase[] = [];
  // Python doesn't always have a top-level testsuites element.
  let testsuites = obj['testsuite'];
  if (testsuites === undefined) {
    testsuites = obj['testsuites']['testsuite'];
  }
  if (testsuites === undefined) {
    return {passes: [], failures: []};
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
      if (testsuiteName === 'pytest' || testsuiteName === 'Mocha Tests') {
        pkg = testcase['_attributes'].classname;
      }
      // Ignore skipped tests. They didn't pass and they didn't fail.
      if (testcase['skipped'] !== undefined) {
        continue;
      }
      const failure = testcase['failure'];
      if (failure === undefined) {
        passes.push({
          package: pkg,
          testCase: testcase['_attributes'].name,
          passed: true,
        });
        continue;
      }
      let log = failure['_text'];
      // Java puts its test logs in a CDATA element.
      if (log === undefined) {
        log = failure['_cdata'];
      }
      failures.push({
        package: pkg,
        testCase: testcase['_attributes'].name,
        passed: false,
        log,
      });
    }
  }
  return {
    passes: deduplicateTests(passes),
    failures: deduplicateTests(failures),
  };
};

// deduplicateTests removes tests that have equivalent formatTestCase values.
function deduplicateTests(tests: TestCase[]): TestCase[] {
  const uniqueTests = new Map<string, TestCase>();
  tests.forEach(test => {
    uniqueTests.set(buildcop.formatTestCase(test), test);
  });
  return Array.from(uniqueTests.values());
}
