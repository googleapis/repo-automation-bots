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

import {Storage} from '@google-cloud/storage';
// eslint-disable-next-line node/no-extraneous-import
import {Application, Context} from 'probot';
import {logger} from 'gcf-utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const langlabler = require('./language');
// Default app configs if user didn't specify a .config
const LABEL_PRODUCT_BY_DEFAULT = true;
const LABEL_LANGUAGE_BY_DEFAULT = false;
const DEFAULT_CONFIGS = {
  product: LABEL_PRODUCT_BY_DEFAULT,
  language: {
    issue: LABEL_LANGUAGE_BY_DEFAULT,
    pullrequest: LABEL_LANGUAGE_BY_DEFAULT,
  },
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const colorsData = require('./colors.json');

export interface DriftRepo {
  github_label: string;
  repo: string;
}

export interface DriftApi {
  github_label: string;
}

interface Label {
  name: string;
}

const storage = new Storage();

handler.getDriftFile = async (file: string) => {
  const bucket = 'devrel-prod-settings';
  const [contents] = await storage.bucket(bucket).file(file).download();
  return contents.toString();
};

handler.getDriftRepos = async () => {
  const jsonData = await handler.getDriftFile('public_repos.json');
  if (!jsonData) {
    logger.error(
      new Error('public_repos.json downloaded from Cloud Storage was empty')
    );
    return null;
  }
  return JSON.parse(jsonData).repos as DriftRepo[];
};

handler.getDriftApis = async () => {
  const jsonData = await handler.getDriftFile('apis.json');
  if (!jsonData) {
    logger.error(
      new Error('apis.json downloaded from Cloud Storage was empty')
    );
    return null;
  }
  return JSON.parse(jsonData).apis as DriftApi[];
};

// autoDetectLabel tries to detect the right api: label based on the issue
// title.
//
// For example, an issue titled `spanner/transactions: TestSample failed` would
// be labeled `api: spanner`.
export function autoDetectLabel(
  apis: DriftApi[] | null,
  title: string
): string | undefined {
  if (!apis || !title) {
    return undefined;
  }
  // Regex to match the scope of a Conventional Commit message.
  const conv = /[^(]+\(([^)]+)\):/;
  const match = title.match(conv);

  let firstPart = match ? match[1] : title;

  // Remove common prefixes. For example,
  // https://github.com/GoogleCloudPlatform/java-docs-samples/issues/3578.
  const trimPrefixes = ['com.example.', 'com.google.', 'snippets.'];
  for (const prefix of trimPrefixes) {
    if (firstPart.startsWith(prefix)) {
      firstPart = firstPart.slice(prefix.length);
    }
  }

  if (firstPart.startsWith('/')) firstPart = firstPart.substr(1); // Remove leading /.
  firstPart = firstPart.split(':')[0]; // Before the colon, if there is one.
  firstPart = firstPart.split('/')[0]; // Before the slash, if there is one.
  firstPart = firstPart.split('.')[0]; // Before the period, if there is one.
  firstPart = firstPart.split('_')[0]; // Before the underscore, if there is one.
  firstPart = firstPart.toLowerCase(); // Convert to lower case.
  firstPart = firstPart.replace(/\s/, ''); // Remove spaces.

  // Replace some known firstPart values with their API name.
  const commonConversions = new Map();
  commonConversions.set('video', 'videointelligence');
  firstPart = commonConversions.get(firstPart) || firstPart;

  // Some APIs have "cloud" before the name (e.g. cloudkms and cloudiot).
  const possibleLabels = [`api: ${firstPart}`, `api: cloud${firstPart}`];
  return apis.find(api => possibleLabels.indexOf(api.github_label) > -1)
    ?.github_label;
}

handler.addLabeltoRepoAndIssue = async function addLabeltoRepoAndIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  issueTitle: string,
  driftRepos: DriftRepo[],
  context: Context
) {
  const driftRepo = driftRepos.find(x => x.repo === `${owner}/${repo}`);
  const res = await context.github.issues
    .listLabelsOnIssue({
      owner,
      repo,
      issue_number: issueNumber,
    })
    .catch(logger.error);
  const labelsOnIssue = res ? res.data : undefined;
  let wasNotAdded = true;
  let autoDetectedLabel: string | undefined;

  if (!driftRepo?.github_label) {
    logger.info(
      `There was no configured match for the repo ${repo}, trying to auto-detect the right label`
    );
    const apis = await handler.getDriftApis();
    autoDetectedLabel = autoDetectLabel(apis, issueTitle);
  }
  const index = driftRepos?.findIndex(r => driftRepo === r) % colorsData.length;
  const colorNumber = index >= 0 ? index : 0;
  const githubLabel = driftRepo?.github_label || autoDetectedLabel;

  if (githubLabel) {
    try {
      await context.github.issues.createLabel({
        owner,
        repo,
        name: githubLabel,
        color: colorsData[colorNumber].color,
      });
      logger.info(`Label added to ${owner}/${repo} is ${githubLabel}`);
    } catch (e) {
      // HTTP 422 means the label already exists on the repo
      if (e.status !== 422) {
        e.message = `Error creating label: ${e.message}`;
        logger.error(e);
      }
    }
    if (labelsOnIssue) {
      const foundAPIName = labelsOnIssue.find(
        (element: Label) => element.name === githubLabel
      );
      const cleanUpOtherLabels = labelsOnIssue.filter(
        (element: Label) =>
          element.name.startsWith('api') &&
          element.name !== foundAPIName?.name &&
          element.name !== autoDetectedLabel
      );
      if (foundAPIName) {
        logger.info('The label already exists on this issue');
      } else {
        await context.github.issues
          .addLabels({
            owner,
            repo,
            issue_number: issueNumber,
            labels: [githubLabel],
          })
          .catch(logger.error);
        logger.info(
          `Label added to ${owner}/${repo} for issue ${issueNumber} is ${githubLabel}`
        );
        wasNotAdded = false;
      }
      for (const dirtyLabel of cleanUpOtherLabels) {
        await context.github.issues
          .removeLabel({
            owner,
            repo,
            issue_number: issueNumber,
            name: dirtyLabel.name,
          })
          .catch(logger.error);
      }
    } else {
      await context.github.issues
        .addLabels({
          owner,
          repo,
          issue_number: issueNumber,
          labels: [githubLabel],
        })
        .catch(logger.error);
      logger.info(
        `Label added to ${owner}/${repo} for issue ${issueNumber} is ${githubLabel}`
      );
      wasNotAdded = false;
    }
  }

  let foundSamplesTag: Label | undefined;
  if (labelsOnIssue) {
    foundSamplesTag = labelsOnIssue.find(e => e.name === 'samples');
  }
  const isSampleIssue =
    repo.includes('samples') || issueTitle?.includes('sample');
  if (!foundSamplesTag && isSampleIssue) {
    await context.github.issues
      .createLabel({
        owner,
        repo,
        name: 'samples',
        color: colorsData[colorNumber].color,
      })
      .catch(logger.error);
    await context.github.issues
      .addLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels: ['samples'],
      })
      .catch(logger.error);
    logger.info(
      `Issue ${issueNumber} is in a samples repo but does not have a sample tag, adding it to the repo and issue`
    );
    wasNotAdded = false;
  }

  return wasNotAdded;
};

/**
 * Main function, responds to label being added
 */
export function handler(app: Application) {
  // Nightly cron that backfills and corrects api labels
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.on('schedule.repository' as any, async context => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = await context.config(
      'auto-label.yaml',
      DEFAULT_CONFIGS
    );
    if (!config.product) return;

    logger.info(`running for org ${context.payload.cron_org}`);
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;
    if (context.payload.cron_org !== owner) {
      logger.info(`skipping run for ${context.payload.cron_org}`);
      return;
    }
    const driftRepos = await handler.getDriftRepos();
    if (!driftRepos) {
      return;
    }
    //all the issues in the repository
    const issues = context.github.issues.listForRepo.endpoint.merge({
      owner,
      repo,
    });
    let labelWasNotAddedCount = 0;
    //goes through issues in repository, adds labels as necessary
    for await (const response of context.github.paginate.iterator(issues)) {
      const issues = response.data;
      for (const issue of issues) {
        const wasNotAdded = await handler.addLabeltoRepoAndIssue(
          owner,
          repo,
          issue.number,
          issue.title,
          driftRepos,
          context
        );
        if (wasNotAdded) {
          logger.info(
            `label for ${issue.number} in ${owner}/${repo} was not added`
          );
          labelWasNotAddedCount++;
        }
        if (labelWasNotAddedCount > 5) {
          logger.info(
            `${
              owner / repo
            } has 5 issues where labels were not added; skipping the rest of this repo check.`
          );
          return;
        }
      }
    }
  });

  app.on(['issues.opened', 'issues.reopened'], async context => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = await context.config(
      'auto-label.yaml',
      DEFAULT_CONFIGS
    );
    if (!config.product) return;

    //job that labels issues when they are opened
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const issueNumber = context.payload.issue.number;
    const driftRepos = await handler.getDriftRepos();
    if (!driftRepos) {
      return;
    }
    await handler.addLabeltoRepoAndIssue(
      owner,
      repo,
      issueNumber,
      context.payload.issue.title,
      driftRepos,
      context
    );
  });

  app.on(['pull_request.opened'], async context => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const config: any = await context.config(
      'auto-label.yaml',
      DEFAULT_CONFIGS
    );
    if (!config.language) return;
    if (!config.language.pullrequest) return;
    if (langlabler.langLabelExists(context)) return;
    logger.info(
      'Labeling New Pull Request: ' +
        context.payload.repository.name +
        ' #' +
        context.payload.pull_request.number
    );
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const pull_number = context.payload.pull_request.number;
    const filesChanged = await context.github.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });
    const language = langlabler.getPRLanguage(
      filesChanged.data,
      config.language
    );
    if (language) {
      logger.info('Labeling PR with: ' + language);
      await context.github.issues.addLabels({
        owner,
        repo,
        issue_number: pull_number,
        labels: [language],
      });
    }
  });

  app.on(['installation.created'], async context => {
    const repositories = context.payload.repositories;
    const driftRepos = await handler.getDriftRepos();
    if (!LABEL_PRODUCT_BY_DEFAULT) return;
    if (!driftRepos) return;

    for await (const repository of repositories) {
      const [owner, repo] = repository.full_name.split('/');

      // Looks for a config file, breaks if user disabled product labels
      const response = await context.github.repos.getContent({
        owner,
        repo,
        path: '.github/auto-label.yaml',
      });
      if (response && response.status === 200) {
        const config_encoded = response.data.content;
        const config = Buffer.from(config_encoded, 'base64')
          .toString('binary')
          .toLowerCase();
        const disable_product_label = config
          .split('\n')
          .filter(line => line.match(/^product:( *)false/));
        if (disable_product_label.length > 0) break;
      }

      //goes through issues in repository, adds labels as necessary
      for await (const response of context.github.paginate.iterator(
        context.github.issues.listForRepo,
        {
          owner,
          repo,
        }
      )) {
        const issues = response.data;
        //goes through each issue in each page
        for (const issue of issues) {
          await handler.addLabeltoRepoAndIssue(
            owner,
            repo,
            issue.number,
            issue.title,
            driftRepos,
            context
          );
        }
      }
    }
  });
}
