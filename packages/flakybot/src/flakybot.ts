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
 * The flaky bot manages issues for unit tests.
 *
 * The input payload should include:
 *  - xunitXML: the base64 encoded xUnit XML log.
 *  - commit: the commit hash the build was for.
 *  - buildURL: URL to link to for a build.
 *  - repo: the repo being tested (e.g. GoogleCloudPlatform/golang-samples).
 */

// eslint-disable-next-line node/no-extraneous-import
import {Probot, Logger} from 'probot';
import xmljs from 'xml-js';
import {DatastoreLock} from '@google-automations/datastore-lock';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import {components} from '@octokit/openapi-types';
import {logger} from 'gcf-utils';
import {
  getConfigWithDefault,
  ConfigChecker,
} from '@google-automations/bot-config-utils';
import {syncLabels} from '@google-automations/label-utils';
import schema from './config-schema.json';
import {ISSUE_LABEL, FLAKY_LABEL, QUIET_LABEL, FLAKYBOT_LABELS} from './labels';

export interface Config {
  issuePriority: string;
}
export const DEFAULT_CONFIG: Config = {issuePriority: 'p1'};
export const CONFIG_FILENAME = 'flakybot.yaml';

type IssuesListForRepoResponseItem = components['schemas']['issue-simple'];
type IssuesListCommentsResponseData = components['schemas']['issue-comment'][];
type IssuesListForRepoResponseData = IssuesListForRepoResponseItem[];

function getLabelsForFlakyIssue(config: Config): string[] {
  return [
    'type: bug',
    `priority: ${config.issuePriority}`,
    ISSUE_LABEL,
    FLAKY_LABEL,
  ];
}

function getLabelsForNewIssue(config: Config): string[] {
  return ['type: bug', `priority: ${config.issuePriority}`, ISSUE_LABEL];
}

const EVERYTHING_FAILED_TITLE = 'The build failed';

const NEW_ISSUE_MESSAGE = `This test failed!

To configure my behavior, see [the Flaky Bot documentation](https://github.com/googleapis/repo-automation-bots/tree/master/packages/flakybot).

If I'm commenting on this issue too often, add the \`flakybot: quiet\` label and
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

export interface FlakyBotPayload {
  repo: string;
  organization: {login: string}; // Filled in by gcf-utils.
  repository: {name: string}; // Filled in by gcf-utils.
  commit: string;
  buildURL: string;

  xunitXML?: string; // Base64 encoded to avoid JSON escaping issues. Fill in to get separate issues for separate tests.
  testsFailed?: boolean; // Whether the entire build failed. Ignored if xunitXML is set.
}

interface PubSubContext {
  octokit: Octokit;
  readonly event: string;
  log: Logger;
  payload: FlakyBotPayload;
}

export function flakybot(app: Probot) {
  app.on('schedule.repository' as '*', async context => {
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;
    await syncLabels(context.octokit, owner, repo, FLAKYBOT_LABELS);
  });
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.edited',
      'pull_request.synchronize',
    ],
    async context => {
      const configChecker = new ConfigChecker<Config>(schema, CONFIG_FILENAME);
      const {owner, repo} = context.repo();
      await configChecker.validateConfigChanges(
        context.octokit,
        owner,
        repo,
        context.payload.pull_request.head.sha,
        context.payload.pull_request.number
      );
    }
  );
  // meta comment about the 'any' here: https://github.com/octokit/webhooks.js/issues/277
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('pubsub.message' as any, async (context: PubSubContext) => {
    const owner = context.payload.organization?.login;
    const repo = context.payload.repository?.name;
    const commit = context.payload.commit || '[TODO: set commit]';
    const buildURL = context.payload.buildURL || '[TODO: set buildURL]';

    const config = await getConfigWithDefault<Config>(
      context.octokit,
      owner,
      repo,
      CONFIG_FILENAME,
      DEFAULT_CONFIG,
      {schema: schema}
    );
    logger.debug(`config: ${config}`);
    context.log.info(`[${owner}/${repo}] processing ${buildURL}`);

    let results: TestResults;
    if (context.payload.xunitXML) {
      const xml = Buffer.from(context.payload.xunitXML, 'base64').toString();
      results = flakybot.findTestResults(xml);
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
    const options = context.octokit.issues.listForRepo.endpoint.merge({
      owner,
      repo,
      per_page: 100,
      labels: ISSUE_LABEL,
      state: 'all', // Include open and closed issues.
    });
    let issues = (await context.octokit.paginate(
      options
    )) as IssuesListForRepoResponseData;

    // If we deduplicate any issues, re-download the issues.
    if (
      await flakybot.deduplicateIssues(results, issues, context, owner, repo)
    ) {
      issues = await context.octokit.paginate(options);
    }

    // Open issues for failing tests (including flaky tests).
    await flakybot.openIssues(
      results.failures,
      issues,
      context,
      config,
      owner,
      repo,
      commit,
      buildURL
    );
    // Close issues for passing tests (unless they're flaky).
    await flakybot.closeIssues(
      results,
      issues,
      context,
      config,
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
flakybot.deduplicateIssues = async (
  results: TestResults,
  issues: IssuesListForRepoResponseData,
  context: PubSubContext,
  owner: string,
  repo: string
) => {
  const tests = results.passes.concat(results.failures);
  issues = issues.filter(
    issue =>
      issue.state === 'open' &&
      tests.find(test => issue.title === flakybot.formatTestCase(test))
  );
  const byTitle = new Map<string, IssuesListForRepoResponseData>();
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
    issues.sort(flakybot.issueComparator);
    // Keep the first issue, close the others.
    const issue = issues.shift();
    for (const dup of issues) {
      context.log.info(
        `[${owner}/${repo}] closing issue #${dup.number} as duplicate of #${issue?.number}`
      );
      await context.octokit.issues.createComment({
        owner,
        repo,
        issue_number: dup.number,
        body: `Closing as a duplicate of #${issue?.number}`,
      });
      await context.octokit.issues.update({
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
flakybot.openIssues = async (
  failures: TestCase[],
  issues: IssuesListForRepoResponseData,
  context: PubSubContext,
  config: Config,
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
    const groupedIssue = flakybot.findGroupedIssue(issues, pkg);
    if (groupedIssue) {
      // Acquire the lock, then fetch the issue and update, release the lock.
      const lock = new DatastoreLock('flakybot', groupedIssue.url);
      // Ignore the failure because it's not fatal.
      await lock.acquire();
      try {
        // We need to re fetch the issue.
        const issue = await context.octokit.issues.get({
          owner: owner,
          repo: repo,
          issue_number: groupedIssue.number,
        });
        // Then update the new issue.
        const groupedIssueToModify =
          issue.data as IssuesListForRepoResponseItem;

        // If a group issue exists, say stuff failed.
        // Don't comment if it's asked to be quiet.
        if (hasLabel(groupedIssueToModify, QUIET_LABEL)) {
          continue;
        }

        // Don't comment if it's flaky.
        if (flakybot.isFlaky(groupedIssueToModify)) {
          continue;
        }
        // Don't comment if we've already commented with this build failure.
        const [containsFailure] = await flakybot.containsBuildFailure(
          groupedIssueToModify,
          context,
          owner,
          repo,
          commit
        );
        if (containsFailure) {
          continue;
        }

        const testCase = flakybot.groupedTestCase(pkg);
        const testString = pkgFailures.length === 1 ? 'test' : 'tests';
        const body = `${
          pkgFailures.length
        } ${testString} failed in this package for commit ${commit} (${buildURL}).\n\n-----\n${flakybot.formatBody(
          testCase,
          commit,
          buildURL
        )}`;
        await context.octokit.issues.createComment({
          owner,
          repo,
          issue_number: groupedIssueToModify.number,
          body,
        });
        continue;
      } finally {
        await lock.release();
      }
    }
    // There is no grouped issue for this package.
    // Check if 10 or more tests failed.
    if (pkgFailures.length >= 10) {
      // Open a new issue listing the failing tests.
      const testCase = flakybot.groupedTestCase(pkg);
      context.log.info(
        `[${owner}/${repo}]: creating issue "${flakybot.formatTestCase(
          testCase
        )}"...`
      );
      let failedTestsString = '';
      for (const failure of pkgFailures) {
        if (failure.testCase) {
          failedTestsString += '* ' + failure.testCase;
          const existingIssue = flakybot.findExistingIssue(issues, failure);
          if (existingIssue) {
            failedTestsString += ` (#${existingIssue.number})`;
          }
          failedTestsString += '\n';
        }
      }
      const body =
        GROUPED_MESSAGE +
        `Here are the tests that failed:\n${failedTestsString}\n\n-----\n${flakybot.formatBody(
          testCase,
          commit,
          buildURL
        )}`;
      const newIssue = (
        await context.octokit.issues.create({
          owner,
          repo,
          title: flakybot.formatGroupedTitle(pkg),
          body,
          labels: getLabelsForNewIssue(config),
        })
      ).data;
      context.log.info(`[${owner}/${repo}]: created issue #${newIssue.number}`);
      continue;
    }
    // There is no grouped failure and there are <10 failing tests in this
    // package. Treat each failure independently.
    for (const failure of pkgFailures) {
      const existingIssue = flakybot.findExistingIssue(issues, failure);
      if (!existingIssue) {
        await flakybot.openNewIssue(
          context,
          config,
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
      // Acquire the lock, then fetch the issue and update, release the lock.
      const lock = new DatastoreLock('flakybot', existingIssue.url);
      // Ignore the failure because it's not fatal.
      await lock.acquire();

      try {
        // We need to re fetch the issue.
        const issue = await context.octokit.issues.get({
          owner: owner,
          repo: repo,
          issue_number: existingIssue.number,
        });
        // Work on the refreshed issue.
        const existingIssueToModify =
          issue.data as IssuesListForRepoResponseItem;
        if (existingIssueToModify.state === 'closed') {
          // If there is an existing closed issue, it might be flaky.

          // If the issue is locked, we can't reopen it, so open a new one.
          if (existingIssueToModify.locked) {
            await flakybot.openNewIssue(
              context,
              config,
              owner,
              repo,
              commit,
              buildURL,
              failure,
              `Note: #${existingIssueToModify.number} was also for this test, but it is locked`
            );
            continue;
          }

          // If the existing issue has been closed for more than 10 days, open
          // a new issue instead.
          //
          // If this doesn't work, we'll mark the issue as flaky.
          const closedAt = parseClosedAt(existingIssueToModify.closed_at);
          if (closedAt) {
            const daysAgo = 10;
            const daysAgoDate = new Date();
            daysAgoDate.setDate(daysAgoDate.getDate() - daysAgo);
            if (closedAt < daysAgoDate.getTime()) {
              await flakybot.openNewIssue(
                context,
                config,
                owner,
                repo,
                commit,
                buildURL,
                failure,
                `Note: #${existingIssueToModify.number} was also for this test, but it was closed more than ${daysAgo} days ago. So, I didn't mark it flaky.`
              );
              continue;
            }
          }
          const reason = flakybot.formatBody(failure, commit, buildURL);
          await flakybot.markIssueFlaky(
            existingIssueToModify,
            context,
            config,
            owner,
            repo,
            reason
          );
        } else {
          // Don't comment if it's asked to be quiet.
          if (hasLabel(existingIssueToModify, QUIET_LABEL)) {
            continue;
          }

          // Don't comment if it's flaky.
          if (flakybot.isFlaky(existingIssueToModify)) {
            continue;
          }

          // Don't comment if we've already commented with this build failure.
          const [containsFailure] = await flakybot.containsBuildFailure(
            existingIssueToModify,
            context,
            owner,
            repo,
            commit
          );
          if (containsFailure) {
            continue;
          }

          await context.octokit.issues.createComment({
            owner,
            repo,
            issue_number: existingIssueToModify.number,
            body: flakybot.formatBody(failure, commit, buildURL),
          });
        }
      } finally {
        await lock.release();
      }
    }
  }
};

flakybot.findGroupedIssue = (
  issues: IssuesListForRepoResponseData,
  pkg: string
): IssuesListForRepoResponseItem | undefined => {
  // Don't reopen grouped issues.
  return issues.find(
    issue =>
      issue.title === flakybot.formatGroupedTitle(pkg) && issue.state === 'open'
  );
};

flakybot.findExistingIssue = (
  issues: IssuesListForRepoResponseData,
  failure: TestCase
): IssuesListForRepoResponseItem | undefined => {
  // Only reopen issues for individual test cases, not for the "everything
  // failed" issue. If the "everything failed" issue is already open, leave it
  // open.
  const matchingIssues = issues.filter(
    issue => issue.title === flakybot.formatTestCase(failure)
  );
  // Prefer open issues in case there are duplicates. There should only be at
  // most one open issue.
  let existingIssue = matchingIssues.find(issue => issue.state === 'open');

  if (
    matchingIssues.length > 0 &&
    !existingIssue &&
    flakybot.formatTestCase(failure) !== EVERYTHING_FAILED_TITLE
  ) {
    matchingIssues.sort(flakybot.issueComparator);
    existingIssue = matchingIssues[0];
  }
  return existingIssue;
};

flakybot.openNewIssue = async (
  context: PubSubContext,
  config: Config,
  owner: string,
  repo: string,
  commit: string,
  buildURL: string,
  failure: TestCase,
  extraText?: string
) => {
  context.log.info(
    `[${owner}/${repo}]: creating issue "${flakybot.formatTestCase(
      failure
    )}"...`
  );
  let body = NEW_ISSUE_MESSAGE + '\n\n';
  if (extraText) {
    body = extraText + '\n\n----\n\n';
  }
  body += flakybot.formatBody(failure, commit, buildURL);
  const newIssue = (
    await context.octokit.issues.create({
      owner,
      repo,
      title: flakybot.formatTestCase(failure),
      body,
      labels: getLabelsForNewIssue(config),
    })
  ).data;
  logger.metric('flakybot.open_new_issue', {
    owner,
    repo,
    number: newIssue.number,
  });
};

// For every flakybot issue, if it's not flaky and it passed and it didn't
// previously fail in the same build, close it.
flakybot.closeIssues = async (
  results: TestResults,
  issues: IssuesListForRepoResponseData,
  context: PubSubContext,
  config: Config,
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
      return issue.title === flakybot.formatTestCase(failure);
    });
    // If the test failed, don't close its issue.
    if (failure) {
      continue;
    }

    const groupedFailure = results.failures.find(failure => {
      return (
        failure.package &&
        issue.title === flakybot.formatGroupedTitle(failure.package)
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
        issue.title === flakybot.formatTestCase(pass) ||
        (pass.package &&
          issue.title === flakybot.formatGroupedTitle(pass.package))
      );
    });
    // If the test did not pass, don't close its issue.
    if (!pass) {
      continue;
    }

    // Don't close flaky issues.
    if (flakybot.isFlaky(issue)) {
      context.log.info(
        `[${owner}/${repo}] #${issue.number} passed, but it's flaky, so I'm not closing it`
      );
      continue;
    }

    // If the issue has a failure in the same build, don't close it.
    // If it passed in one build and failed in another, it's flaky.
    const [containsFailure, failureURL] = await flakybot.containsBuildFailure(
      issue,
      context,
      owner,
      repo,
      commit
    );
    if (containsFailure) {
      const reason = `When run at the same commit (${commit}), this test passed in one build (${buildURL}) and failed in another build (${failureURL}).`;
      await flakybot.markIssueFlaky(
        issue,
        context,
        config,
        owner,
        repo,
        reason
      );
      break;
    }

    // The test passed and there is no previous failure in the same build.
    // If another job in the same build fails in the future, it will reopen
    // the issue.
    context.log.info(
      `[${owner}/${repo}] closing issue #${issue.number}: ${issue.title}`
    );
    await context.octokit.issues.createComment({
      owner,
      repo,
      issue_number: issue.number,
      body: `Test passed for commit ${commit} (${buildURL})! Closing this issue.`,
    });
    await context.octokit.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      state: 'closed',
    });
  }
};

flakybot.issueComparator = (
  a: IssuesListForRepoResponseItem,
  b: IssuesListForRepoResponseItem
) => {
  if (a.state === 'open' && b.state !== 'open') {
    return -1;
  }
  if (a.state !== 'open' && b.state === 'open') {
    return 1;
  }
  // The issues are either both open or both not-open.
  if (flakybot.isFlaky(a) && !flakybot.isFlaky(b)) {
    return -1;
  }
  if (!flakybot.isFlaky(a) && flakybot.isFlaky(b)) {
    return 1;
  }
  const aClose = parseClosedAt(a.closed_at);
  const bClose = parseClosedAt(b.closed_at);
  if (aClose && bClose) {
    return bClose - aClose; // Later close time first.
  }
  return a.number - b.number; // Earlier issue number first.
};

flakybot.isFlaky = (issue: IssuesListForRepoResponseItem): boolean => {
  return hasLabel(issue, FLAKY_LABEL);
};

function hasLabel(
  issue: IssuesListForRepoResponseItem,
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

flakybot.markIssueFlaky = async (
  existingIssue: IssuesListForRepoResponseItem,
  context: PubSubContext,
  config: Config,
  owner: string,
  repo: string,
  reason: string
) => {
  context.log.info(
    `[${owner}/${repo}] marking issue #${existingIssue.number} as flaky`
  );
  const existingLabels = existingIssue.labels
    ?.map(l => l.name as string) // "as string" is workaround for https://github.com/github/rest-api-description/issues/112
    .filter(l => !l.startsWith('flakybot'));
  let labelsToAdd = getLabelsForFlakyIssue(config);
  // If existingLabels contains a priority or type label, don't add the
  // default priority and type labels.
  if (existingLabels?.find(l => l.startsWith('priority:'))) {
    labelsToAdd = labelsToAdd.filter(l => !l.startsWith('priority:'));
  }
  if (existingLabels?.find(l => l.startsWith('type:'))) {
    labelsToAdd = labelsToAdd.filter(l => !l.startsWith('type:'));
  }
  const labels = labelsToAdd.concat(existingLabels);
  await context.octokit.issues.update({
    owner,
    repo,
    issue_number: existingIssue.number,
    labels,
    state: 'open',
  });
  let body = flakybot.isFlaky(existingIssue)
    ? FLAKY_AGAIN_MESSAGE
    : FLAKY_MESSAGE;
  body += '\n\n' + reason;
  await context.octokit.issues.createComment({
    owner,
    repo,
    issue_number: existingIssue.number,
    body,
  });
};

flakybot.formatBody = (
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

flakybot.containsBuildFailure = async (
  issue: IssuesListForRepoResponseItem,
  context: PubSubContext,
  owner: string,
  repo: string,
  commit: string
): Promise<[boolean, string]> => {
  const text = issue.body as string; // "as string" because it's complicated: https://github.com/github/rest-api-description/issues/113
  if (text.includes(`commit: ${commit}`) && text.includes('status: failed')) {
    const buildURL = flakybot.extractBuildURL(text);
    return [true, buildURL];
  }
  const options = context.octokit.issues.listComments.endpoint.merge({
    owner,
    repo,
    issue_number: issue.number,
  });
  const comments = (await context.octokit.paginate(
    options
  )) as IssuesListCommentsResponseData;
  const comment = comments.find(
    comment =>
      (comment.body as string).includes(`commit: ${commit}`) &&
      (comment.body as string).includes('status: failed')
  );
  const containsFailure = comment !== undefined;
  let buildURL = '';
  if (comment) {
    buildURL = flakybot.extractBuildURL(comment.body!);
  }
  return [containsFailure, buildURL];
};

flakybot.extractBuildURL = (body: string): string => {
  if (!body) {
    return '';
  }
  const matches = body.match(/buildURL: (.*)/);
  if (!matches) {
    return '';
  }
  return matches[1];
};

flakybot.formatTestCase = (failure: TestCase): string => {
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

flakybot.groupedTestCase = (pkg: string): TestCase => {
  return {
    passed: false,
    package: pkg,
    testCase: 'many tests',
  };
};

flakybot.formatGroupedTitle = (pkg: string): string => {
  return flakybot.formatTestCase(flakybot.groupedTestCase(pkg));
};

flakybot.findTestResults = (xml: string): TestResults => {
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
    // Ruby doesn't always have _attributes.
    const testsuiteName = suite['_attributes']?.name;
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
      if (
        !testsuiteName ||
        testsuiteName === 'pytest' ||
        testsuiteName === 'Mocha Tests'
      ) {
        pkg = testcase['_attributes'].classname;
      }
      // Ignore skipped tests. They didn't pass and they didn't fail.
      if (testcase['skipped'] !== undefined) {
        continue;
      }
      // Treat errors and failures the same way.
      const failure = testcase['failure'] || testcase['error'];
      if (failure === undefined) {
        passes.push({
          package: pkg,
          testCase: testcase['_attributes'].name,
          passed: true,
        });
        continue;
      }
      // Java puts its test logs in a CDATA element; other languages use _text.
      const log = failure['_text'] || failure['_cdata'] || '';
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
    uniqueTests.set(flakybot.formatTestCase(test), test);
  });
  return Array.from(uniqueTests.values());
}

// parseClosedAt parses the closed_at field into a date number.
function parseClosedAt(closedAt: string | null): number | undefined {
  // The type of closed_at is null. But, it is actually a string if the
  // issue is closed. Convert to unknown then to string as a workaround.
  const closedAtString = closedAt as unknown as string;
  if (closedAtString) {
    return Date.parse(closedAtString);
  }
  return undefined;
}
