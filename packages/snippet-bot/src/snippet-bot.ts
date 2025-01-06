// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     https://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable node/no-extraneous-import */

import {Probot, Context} from 'probot';
import {Octokit} from '@octokit/rest';
import {PullRequest} from '@octokit/webhooks-types/schema';
import {RequestError} from '@octokit/types';
import {Configuration, ConfigurationOptions} from './configuration';
import {DEFAULT_CONFIGURATION, CONFIGURATION_FILE_PATH} from './configuration';
import {REFRESH_LABEL, NO_PREFIX_REQ_LABEL, SNIPPET_BOT_LABELS} from './labels';
import {
  ChangesInPullRequest,
  parseRegionTags,
  parseRegionTagsInPullRequest,
  ParseResult,
} from './region-tag-parser';
import {
  Conclusion,
  CheckAggregator,
  formatBody,
  formatExpandable,
  formatRegionTag,
  formatViolations,
  formatMatchingViolation,
  downloadFile,
} from './utils';
import {invalidateCache} from './snippets';
import {
  Violation,
  checkProductPrefixViolations,
  checkRemovingUsedTagViolations,
  checkTagFormat,
} from './violations';
import schema from './config-schema.json';

import {ConfigChecker, getConfig} from '@google-automations/bot-config-utils';
import {
  FileNotFoundError,
  RepositoryFileCache,
} from '@google-automations/git-file-utils';
import {syncLabels} from '@google-automations/label-utils';
import {getContextLogger, GCFLogger, getAuthenticatedOctokit} from 'gcf-utils';
import {addOrUpdateIssueComment} from '@google-automations/issue-utils';
import tmp from 'tmp-promise';
import tar from 'tar';
import {promises as pfs} from 'fs';
import path from 'path';
import {scanServiceConfigsForApiLabels} from './service-configs';
import {
  getDriftApiLabels,
  getApiLabels,
  setApiLabels,
  mergeApiLabels,
} from './api-labels';

// Solely for avoid using `any` type.
interface Label {
  name: string;
}

const DEVREL_SETTINGS_BUCKET =
  process.env.DEVREL_SETTINGS_BUCKET || 'devrel-prod-settings';
const SERVICE_CONFIG_BUCKET =
  process.env.SERVICE_CONFIG_BUCKET || 'drift-product-sync';

const FULL_SCAN_ISSUE_TITLE = 'snippet-bot full scan';

const REFRESH_UI = '- [ ] Refresh this comment';
const REFRESH_STRING = '- [x] Refresh this comment';

// Github issue comment API has a limit of 65536 characters.
const MAX_CHARS_IN_COMMENT = 64000;

const ALLOWED_ORGANIZATIONS = [
  'android',
  'googleapis',
  'GoogleCloudPlatform',
  'googlemaps',
  'googlemaps-samples',
  'terraform-google-modules',
];

async function getFiles(dir: string, allFiles: string[]) {
  const files = (await pfs.readdir(dir)).map(f => path.join(dir, f));
  for (const f of files) {
    if (!(await pfs.stat(f)).isDirectory()) {
      allFiles.push(f);
    }
  }
  await Promise.all(
    files.map(
      async f => (await pfs.stat(f)).isDirectory() && getFiles(f, allFiles)
    )
  );
  return allFiles;
}

async function fullScan(
  context: Context<'issues'>,
  configuration: Configuration,
  logger: GCFLogger
) {
  const installationId = context.payload.installation?.id;
  if (installationId === undefined) {
    throw new Error(
      `Installation ID not provided in ${context.payload.action} event.` +
        ' We cannot authenticate Octokit.'
    );
  }
  const octokit = await getAuthenticatedOctokit(installationId);
  const commentMark = `<!-- probot comment [${installationId}]-->`;
  const owner = context.payload.repository.owner.login;
  const repo = context.payload.repository.name;
  const defaultBranch = context.payload.repository.default_branch;

  if (!context.payload.issue?.title.includes(FULL_SCAN_ISSUE_TITLE)) {
    return;
  }
  // full scan start
  const issueNumber = context.payload.issue.number;

  const url = `https://github.com/${owner}/${repo}/tarball/${defaultBranch}`;
  const tmpDir = tmp.dirSync();
  logger.info(`working directory: ${tmpDir.name}`);

  const file = `${tmpDir.name}/${repo}.tar.gz`;
  // Download the default branch tarball and run full scan.
  try {
    await downloadFile(url, file);
    logger.info(`Downloaded to ${file}`);
    tar.x({
      file: file,
      cwd: tmpDir.name,
      sync: true,
    });
    let archiveDir!: string;
    for (const f of await pfs.readdir(tmpDir.name)) {
      const cur = tmpDir.name + '/' + f;
      const stat = await pfs.lstat(cur);
      if (stat.isDirectory()) {
        archiveDir = cur;
      }
    }
    if (archiveDir === undefined) {
      throw new Error('Failed to extract the archive');
    }
    // Determine the short commit hash from the directory name.
    // We'll use the hash for creating permalink.
    let commitHash = defaultBranch; // Defaulting to the default branch.
    const lastDashIndex = archiveDir.lastIndexOf('-');
    if (lastDashIndex !== -1) {
      commitHash = archiveDir.substr(lastDashIndex + 1);
    }
    logger.info(`Using commit hash "${commitHash}"`);
    const files = await getFiles(archiveDir, []);

    let mismatchedTags = false;
    const failureMessages: string[] = [];

    for (const file of files) {
      if (configuration.ignoredFile(file)) {
        logger.info('ignoring file from configuration: ' + file);
        continue;
      }
      try {
        const fileContents = await pfs.readFile(file, 'utf-8');
        const parseResult = parseRegionTags(
          fileContents,
          file.replace(archiveDir + '/', ''),
          owner,
          repo,
          commitHash
        );
        if (!parseResult.result) {
          mismatchedTags = true;
          for (const violation of parseResult.violations) {
            const formatted = formatMatchingViolation(violation);
            failureMessages.push(`- [ ] ${formatted}`);
          }
        }
      } catch (e) {
        const err = e as Error;
        err.message = `Failed to read the file: ${err.message}`;
        logger.error(err);
        continue;
      }
    }
    let bodyDetail = 'Great job! No unmatching region tags found!';
    if (mismatchedTags) {
      bodyDetail = failureMessages.join('\n');
    }
    await octokit.issues.update({
      owner: owner,
      repo: repo,
      issue_number: issueNumber,
      body: formatBody(
        context.payload.issue.body as string,
        commentMark,
        `## snippet-bot scan result
Life is too short to manually check unmatched region tags.
Here is the result:
${bodyDetail}`
      ),
    });
  } catch (e) {
    const err = e as Error;
    err.message = `Failed to scan files: ${err.message}`;
    logger.error(err);
    await octokit.issues.update({
      owner: owner,
      repo: repo,
      issue_number: issueNumber,
      body: formatBody(
        context.payload.issue.body as string,
        commentMark,
        `## snippet-bot scan result\nFailed running the full scan: ${err}.`
      ),
    });
  } finally {
    // Clean up the directory.
    await pfs.rmdir(tmpDir.name, {recursive: true});
  }
}

async function scanPullRequest(
  context: Context<'pull_request'> | Context<'issue_comment'>,
  pull_request: PullRequest,
  configuration: Configuration,
  logger: GCFLogger,
  refreshing = false
) {
  const installationId = context.payload.installation?.id;
  if (installationId === undefined) {
    throw new Error(
      `Installation ID not provided in ${context.payload.action} event.` +
        ' We cannot authenticate Octokit.'
    );
  }
  const octokit = await getAuthenticatedOctokit(installationId);
  const owner = context.payload.repository.owner.login;
  const repo = context.payload.repository.name;

  const aggregator = new CheckAggregator(
    octokit,
    'snippet-bot check',
    configuration.aggregateChecks()
  );

  let result: ChangesInPullRequest;
  try {
    // Parse the PR diff and recognize added/deleted region tags.
    result = await parseRegionTagsInPullRequest(
      octokit,
      pull_request.diff_url,
      pull_request.base.repo.owner.login,
      pull_request.base.repo.name,
      pull_request.base.sha,
      pull_request.base.ref,
      pull_request.head.repo.owner.login,
      pull_request.head.repo.name,
      pull_request.head.sha,
      pull_request.head.ref
    );
  } catch (e) {
    if (e instanceof FileNotFoundError) {
      logger.info(`ignoring 404 errors upon fetching files: ${e.message}`);
      return;
    } else {
      throw e;
    }
  }

  let mismatchedTags = false;
  let tagsFound = false;
  const failureMessages: string[] = [];

  // Whether to ignore prefix requirement.
  const noPrefixReq = pull_request.labels.some((label: Label) => {
    return label.name === NO_PREFIX_REQ_LABEL;
  });

  // Keep track of start tags in all the files.
  const parseResults = new Map<string, ParseResult>();

  const cache = new RepositoryFileCache(octokit, {
    owner: pull_request.head.repo.owner.login,
    repo: pull_request.head.repo.name,
  });
  // If we found any new files, verify they all have matching region tags.
  for (const file of result.files) {
    if (configuration.ignoredFile(file)) {
      logger.info('ignoring file from configuration: ' + file);
      continue;
    }
    try {
      const contents = await cache.getFileContents(file, pull_request.head.ref);
      const parseResult = parseRegionTags(
        contents.parsedContent,
        file,
        owner,
        repo,
        pull_request.head.sha
      );
      parseResults.set(file, parseResult);
      if (!parseResult.result) {
        mismatchedTags = true;
        for (const violation of parseResult.violations) {
          failureMessages.push(formatMatchingViolation(violation));
        }
      }
      if (parseResult.tagsFound) {
        tagsFound = true;
      }
    } catch (e) {
      if (e instanceof FileNotFoundError) {
        logger.info(`ignoring 404 errors upon fetching ${file}: ${e.message}`);
        return;
      } else {
        throw e;
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  const checkParams = context.repo({
    name: 'Mismatched region tag',
    conclusion: 'success' as Conclusion,
    head_sha: pull_request.head.sha,
    output: {
      title: 'Region tag check',
      summary: 'Region tag successful',
      text: 'Region tag successful',
    },
  });

  if (mismatchedTags) {
    checkParams.conclusion = 'failure';
    checkParams.output = {
      title: 'Mismatched region tag detected.',
      summary: 'Some new files have mismatched region tag',
      text: failureMessages.join('\n'),
    };
  }

  // post the status of commit linting to the PR, using:
  // https://developer.github.com/v3/checks/
  if (
    configuration.alwaysCreateStatusCheck() ||
    configuration.aggregateChecks() ||
    tagsFound
  ) {
    await aggregator.add(checkParams);
  }

  let commentBody = '';

  if (result.changes.length === 0) {
    // If this run is initiated by a user with the force-run label
    // or refresh checkbox, we don't exit.
    //
    // Also, the config `alwaysCreateStatusCheck` is true, we need
    // to create successfull status checks, so we don't exit.
    if (
      !refreshing &&
      !configuration.alwaysCreateStatusCheck() &&
      !configuration.aggregateChecks()
    ) {
      return;
    }
    commentBody += 'No region tags are edited in this PR.\n';
  }

  // Add or update a comment on the PR.
  const prNumber = pull_request.number;

  const apiLabels = await getApiLabels(SERVICE_CONFIG_BUCKET, logger);

  // First check product prefix for added region tags.
  let productPrefixViolations: Array<Violation> = [];
  if (!noPrefixReq) {
    productPrefixViolations = await checkProductPrefixViolations(
      result,
      configuration,
      apiLabels
    );
  }

  // Check tag format.
  let tagFormatViolations: Array<Violation> = [];
  tagFormatViolations = await checkTagFormat(result, configuration);

  const removingUsedTagsViolations = await checkRemovingUsedTagViolations(
    result,
    configuration,
    parseResults,
    pull_request.base.repo.full_name,
    pull_request.base.ref,
    logger
  );
  const removeUsedTagViolations = [
    ...(removingUsedTagsViolations.get('REMOVE_USED_TAG') as Violation[]),
    ...(removingUsedTagsViolations.get(
      'REMOVE_CONFLICTING_TAG'
    ) as Violation[]),
  ];
  const removeSampleBrowserViolations = removingUsedTagsViolations.get(
    'REMOVE_SAMPLE_BROWSER_PAGE'
  ) as Violation[];
  const removeFrozenRegionTagViolations = removingUsedTagsViolations.get(
    'REMOVE_FROZEN_REGION_TAG'
  ) as Violation[];

  // status check for productPrefixViolations
  const prefixCheckParams = context.repo({
    name: 'Region tag product prefix',
    conclusion: 'success' as Conclusion,
    head_sha: pull_request.head.sha,
    output: {
      title: 'No violations',
      summary: 'No violations found',
      text: 'All the tags have appropriate product prefix',
    },
  });

  // status check for removeUsedTagViolations
  const removeUsedTagCheckParams = context.repo({
    name: 'Disruptive region tag removal',
    conclusion: 'success' as Conclusion,
    head_sha: pull_request.head.sha,
    output: {
      title: 'No violations',
      summary: 'No violations found',
      text: 'No disruptive region tag removal',
    },
  });

  // status check for tagFormatViolations
  const tagFormatCheckParams = context.repo({
    name: 'Region tag format',
    conclusion: 'success' as Conclusion,
    head_sha: pull_request.head.sha,
    output: {
      title: 'No violations',
      summary: 'No violations found',
      text: 'All the region tags have the correct format',
    },
  });

  if (
    productPrefixViolations.length > 0 ||
    removeUsedTagViolations.length > 0 ||
    tagFormatViolations.length > 0
  ) {
    commentBody += 'Here is the summary of possible violations 😱';

    // Rendering prefix violations
    if (productPrefixViolations.length > 0) {
      let summary = '';
      if (productPrefixViolations.length === 1) {
        summary =
          'There is a possible violation for not having product prefix.';
      } else {
        summary = `There are ${productPrefixViolations.length} possible violations for not having product prefix.`;
      }
      const productPrefixViolationsDetail = formatViolations(
        productPrefixViolations,
        summary
      );
      commentBody += productPrefixViolationsDetail;
      prefixCheckParams.conclusion = 'failure';
      prefixCheckParams.output = {
        title: 'Missing region tag prefix',
        summary: 'Some region tags do not have appropriate prefix',
        text: productPrefixViolationsDetail,
      };
    }

    // Rendering used tag violations
    if (removeUsedTagViolations.length > 0) {
      let summary = '';
      if (removeUsedTagViolations.length === 1) {
        summary =
          'There is a possible violation for removing region tag in use.';
      } else {
        summary = `There are ${removeUsedTagViolations.length} possible violations for removing region tag in use.`;
      }

      const removeUsedTagViolationsDetail = formatViolations(
        removeUsedTagViolations,
        summary
      );
      commentBody += removeUsedTagViolationsDetail;
      removeUsedTagCheckParams.conclusion = 'failure';
      removeUsedTagCheckParams.output = {
        title: 'Removal of region tags in use',
        summary: '',
        text: removeUsedTagViolationsDetail,
      };
    }

    // Rendering tag format violations.
    if (tagFormatViolations.length > 0) {
      let summary = '';
      if (tagFormatViolations.length === 1) {
        summary = 'There is a format violation for a region tag.';
      } else {
        summary = `There are format violations for ${tagFormatViolations.length} region tags.`;
      }
      const tagFormatViolationsDetail = formatViolations(
        tagFormatViolations,
        summary
      );
      commentBody += tagFormatViolationsDetail;
      tagFormatCheckParams.conclusion = 'failure';
      tagFormatCheckParams.output = {
        title: '',
        summary: 'Some region tags have the wrong format',
        text: tagFormatViolationsDetail,
      };
    }

    commentBody +=
      '**The end of the violation section. All the stuff below is FYI purposes only.**\n\n';
    commentBody += '---\n';
  }

  if (removeSampleBrowserViolations.length > 0) {
    let summary = 'You are about to delete the following sample browser page';
    if (removeSampleBrowserViolations.length > 1) {
      summary += 's';
    }
    summary += '.';
    commentBody += formatViolations(removeSampleBrowserViolations, summary);
    commentBody += '---\n';
  }

  if (removeFrozenRegionTagViolations.length > 0) {
    let summary = 'You are about to delete the following frozen region tag';
    if (removeFrozenRegionTagViolations.length > 1) {
      summary += 's';
    }
    summary += '.';
    commentBody += formatViolations(removeFrozenRegionTagViolations, summary);
    commentBody += '---\n';
  }

  if (result.added > 0 || result.deleted > 0) {
    commentBody += 'Here is the summary of changes.\n';
  }

  if (result.added > 0) {
    const plural = result.added === 1 ? '' : 's';
    const summary = `You are about to add ${result.added} region tag${plural}.`;
    let detail = '';
    for (const change of result.changes) {
      if (change.type === 'add') {
        detail += `- ${formatRegionTag(change)}\n`;
      }
    }
    commentBody += formatExpandable(summary, detail);
  }
  if (result.deleted > 0) {
    const plural = result.deleted === 1 ? '' : 's';
    const summary = `You are about to delete ${result.deleted} region tag${plural}.\n`;
    let detail = '';
    for (const change of result.changes) {
      if (change.type === 'del') {
        detail += `- ${formatRegionTag(change)}\n`;
      }
    }
    commentBody += formatExpandable(summary, detail);
  }

  // Trim the commentBody when it's too long.
  if (commentBody.length > MAX_CHARS_IN_COMMENT) {
    commentBody = commentBody.substring(0, MAX_CHARS_IN_COMMENT);
    // Also trim the string after the last newline to prevent a broken
    // UI rendering.
    const newLineIndex = commentBody.lastIndexOf('\n');
    if (newLineIndex !== -1) {
      commentBody = commentBody.substring(0, newLineIndex);
    }
    commentBody += '\n...(The comment is too long, omitted)\n';
  }

  commentBody += `---
This comment is generated by [snippet-bot](https://github.com/apps/snippet-bot).
If you find problems with this result, please file an issue at:
https://github.com/googleapis/repo-automation-bots/issues.
To update this comment, add \`${REFRESH_LABEL}\` label or use the checkbox below:
${REFRESH_UI}
`;

  // The bot should not add a new comment when there's no region tag
  // changes, so we pass `onlyUpdate` flag.
  const onlyUpdate = result.changes.length === 0;
  await addOrUpdateIssueComment(
    octokit,
    owner,
    repo,
    prNumber,
    installationId as number,
    commentBody,
    {
      onlyUpdate,
    }
  );

  // Status checks for missing region tag prefix
  if (
    configuration.alwaysCreateStatusCheck() ||
    configuration.aggregateChecks() ||
    productPrefixViolations.length > 0
  ) {
    await aggregator.add(prefixCheckParams);
  }

  // Status checks for disruptive region tag removal
  if (
    configuration.alwaysCreateStatusCheck() ||
    configuration.aggregateChecks() ||
    removeUsedTagViolations.length > 0
  ) {
    await aggregator.add(removeUsedTagCheckParams);
  }

  // Status checks for tag format errors
  if (
    configuration.alwaysCreateStatusCheck() ||
    configuration.aggregateChecks() ||
    tagFormatViolations.length > 0
  ) {
    await aggregator.add(tagFormatCheckParams);
  }

  await aggregator.submit();
  // emit metrics
  logger.metric('snippet-bot-violations', {
    target: pull_request.url,
    violation_type: 'UNMATCHED_REGION_TAG',
    count: failureMessages.length,
  });
  logger.metric('snippet-bot-violations', {
    target: pull_request.url,
    violation_type: 'MISSING_PRODUCT_PREFIX',
    count: productPrefixViolations.length,
  });
  logger.metric('snippet-bot-violations', {
    target: pull_request.url,
    violation_type: 'REMOVING_USED_TAG',
    count: removeUsedTagViolations.length,
  });
  logger.metric('snippet-bot-violations', {
    target: pull_request.url,
    violation_type: 'TAG_FORMAT_ERROR',
    count: tagFormatViolations.length,
  });
}

/**
 * Creates a comment mark used for addOrupdateissuecomment.
 * I'll move this function to gcf-utils later.
 */
function getCommentMark(installationId: number | undefined): string {
  return `<!-- probot comment [${installationId}]-->`;
}

export = (app: Probot) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('schedule.repository' as any, async context => {
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        'Installation ID not provided in schedule.repository event.' +
          ' We cannot authenticate Octokit.'
      );
    }
    const logger = getContextLogger(context);
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;
    const configOptions = await getConfig<ConfigurationOptions>(
      octokit,
      owner,
      repo,
      CONFIGURATION_FILE_PATH,
      {schema: schema}
    );
    if (configOptions === null) {
      logger.info(`snippet-bot is not configured for ${owner}/${repo}.`);
      return;
    }
    if (!ALLOWED_ORGANIZATIONS.includes(owner)) {
      logger.info(`snippet-bot not allowed for owner: ${owner}`);
      return;
    }
    await syncLabels(octokit, owner, repo, SNIPPET_BOT_LABELS);
  });

  // Nightly, regenerate the allowed product list and cache into a GCS bucket
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('schedule.global' as any, async context => {
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        'Installation ID not provided in schedule.global event.' +
          ' We cannot authenticate Octokit.'
      );
    }
    const logger = getContextLogger(context);
    const apiLabels = await scanServiceConfigsForApiLabels(octokit, {
      branch: 'master',
      logger,
    });
    logger.info(
      `Found ${apiLabels.products.length} products from service configs.`
    );
    const driftApiLabels = await getDriftApiLabels(
      DEVREL_SETTINGS_BUCKET,
      logger
    );
    logger.info(
      `Found ${driftApiLabels.products.length} products from drift product export.`
    );
    const mergedApiLabels = mergeApiLabels(apiLabels, driftApiLabels);
    logger.info(
      `${mergedApiLabels.products.length} products from combined sources.`
    );
    await setApiLabels(SERVICE_CONFIG_BUCKET, mergedApiLabels);
  });
  app.on('issue_comment.edited', async context => {
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        'Installation ID not provided in issue_comment.edited event.' +
          ' We cannot authenticate Octokit.'
      );
    }
    const logger = getContextLogger(context);
    const commentMark = getCommentMark(context.payload.installation?.id);

    // If the comment is made by bots, and the comment has the refresh
    // checkbox checked, we'll proceed.
    if (
      !context.payload.comment.body.includes(commentMark) ||
      !context.payload.comment.body.includes(REFRESH_STRING)
    ) {
      return;
    }
    const repoUrl = context.payload.repository.full_name;

    const {owner, repo} = context.repo();
    const configOptions = await getConfig<ConfigurationOptions>(
      octokit,
      owner,
      repo,
      CONFIGURATION_FILE_PATH,
      {schema: schema}
    );

    if (configOptions === null) {
      logger.info(`snippet-bot is not configured for ${repoUrl}.`);
      return;
    }
    if (!ALLOWED_ORGANIZATIONS.includes(owner)) {
      logger.info(`snippet-bot not allowed for owner: ${owner}`);
      return;
    }
    const configuration = new Configuration({
      ...DEFAULT_CONFIGURATION,
      ...configOptions,
    });
    logger.info({config: configuration});
    const prNumber = context.payload.issue.number;
    const prResponse = await octokit.pulls.get({
      owner: owner,
      repo: repo,
      pull_number: prNumber,
    });
    // Invalidate the cache for Snippets.
    invalidateCache();

    // Examine the pull request.
    await scanPullRequest(
      context,
      prResponse.data as PullRequest,
      configuration,
      logger,
      true
    );
  });

  app.on(['issues.opened', 'issues.reopened'], async context => {
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        'Installation ID not provided in issues event.' +
          ' We cannot authenticate Octokit.'
      );
    }
    const logger = getContextLogger(context);
    const repoUrl = context.payload.repository.full_name;
    const {owner, repo} = context.repo();
    const configOptions = await getConfig<ConfigurationOptions>(
      octokit,
      owner,
      repo,
      CONFIGURATION_FILE_PATH,
      {schema: schema}
    );

    if (configOptions === null) {
      logger.info(`snippet-bot is not configured for ${repoUrl}.`);
      return;
    }
    if (!ALLOWED_ORGANIZATIONS.includes(owner)) {
      logger.info(`snippet-bot not allowed for owner: ${owner}`);
      return;
    }
    const configuration = new Configuration({
      ...DEFAULT_CONFIGURATION,
      ...configOptions,
    });
    logger.info({config: configuration});
    await fullScan(context, configuration, logger);
  });

  app.on('pull_request.labeled', async context => {
    let octokit: Octokit;
    if (context.payload.installation?.id) {
      octokit = await getAuthenticatedOctokit(context.payload.installation.id);
    } else {
      throw new Error(
        'Installation ID not provided in pull_request.labeled event.' +
          ' We cannot authenticate Octokit.'
      );
    }
    const logger = getContextLogger(context);
    const repoUrl = context.payload.repository.full_name;
    const {owner, repo} = context.repo();
    const configOptions = await getConfig<ConfigurationOptions>(
      octokit,
      owner,
      repo,
      CONFIGURATION_FILE_PATH,
      {schema: schema}
    );

    if (configOptions === null) {
      logger.info(`snippet-bot is not configured for ${repoUrl}.`);
      return;
    }
    if (!ALLOWED_ORGANIZATIONS.includes(owner)) {
      logger.info(`snippet-bot not allowed for owner: ${owner}`);
      return;
    }
    const configuration = new Configuration({
      ...DEFAULT_CONFIGURATION,
      ...configOptions,
    });
    logger.info({config: configuration});
    // Only proceeds if `snippet-bot:force-run` label is added.
    if (context.payload.pull_request.labels === undefined) {
      return;
    }
    // Exits when there's no REFRESH_LABEL
    const labelFound = context.payload.pull_request.labels.some(
      (label: Label) => {
        return label.name === REFRESH_LABEL;
      }
    );
    if (!labelFound) {
      return;
    }
    // Remove the label and proceed.
    try {
      await octokit.issues.removeLabel(context.issue({name: REFRESH_LABEL}));
    } catch (e) {
      const err = e as RequestError;
      // Ignoring 404 errors.
      if (err.status !== 404) {
        throw err;
      }
    }
    // Also invalidate the cache for Snippets.
    invalidateCache();

    // Examine the pull request.
    await scanPullRequest(
      context,
      context.payload.pull_request as PullRequest,
      configuration,
      logger,
      true
    );
  });

  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.synchronize',
      'pull_request.ready_for_review',
    ],
    async context => {
      let octokit: Octokit;
      if (context.payload.installation?.id) {
        octokit = await getAuthenticatedOctokit(
          context.payload.installation.id
        );
      } else {
        throw new Error(
          'Installation ID not provided in pull_request event.' +
            ' We cannot authenticate Octokit.'
        );
      }
      const logger = getContextLogger(context);
      // Exit if the PR is closed.
      if (context.payload.pull_request.state === 'closed') {
        logger.info(
          `The pull request ${context.payload.pull_request.url} is closed, exiting.`
        );
        return;
      }
      // Exit if the PR is a draft.
      if (context.payload.pull_request.draft === true) {
        logger.info(
          `The pull request ${context.payload.pull_request.url} is a draft, exiting.`
        );
        return;
      }
      // If the head repo is null, we can not proceed.
      if (
        context.payload.pull_request.head.repo === undefined ||
        context.payload.pull_request.head.repo === null
      ) {
        logger.info(
          `The head repo is undefined for ${context.payload.pull_request.url}, exiting.`
        );
        return;
      }
      const repoUrl = context.payload.repository.full_name;
      const {owner, repo} = context.repo();

      // We should first check the config schema. Otherwise, we'll miss
      // the opportunity for checking the schema when adding the config
      // file for the first time.
      const configChecker = new ConfigChecker<ConfigurationOptions>(
        schema,
        CONFIGURATION_FILE_PATH
      );
      await configChecker.validateConfigChanges(
        octokit,
        owner,
        repo,
        context.payload.pull_request.head.sha,
        context.payload.pull_request.number
      );

      const configOptions = await getConfig<ConfigurationOptions>(
        octokit,
        owner,
        repo,
        CONFIGURATION_FILE_PATH,
        {schema: schema}
      );
      if (configOptions === null) {
        logger.info(`snippet-bot is not configured for ${repoUrl}.`);
        return;
      }
      if (!ALLOWED_ORGANIZATIONS.includes(owner)) {
        logger.info(`snippet-bot not allowed for owner: ${owner}`);
        return;
      }
      const configuration = new Configuration({
        ...DEFAULT_CONFIGURATION,
        ...configOptions,
      });
      logger.info({config: configuration});
      await scanPullRequest(
        context,
        context.payload.pull_request as PullRequest,
        configuration,
        logger
      );
    }
  );
};
