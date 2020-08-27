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
import {Application, GitHubAPI} from 'probot';
import {logger} from 'gcf-utils';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const colorsData = require('./colors.json');

export interface DriftRepo {
  github_label: string;
  repo: string;
}

interface Label {
  name: string;
}

const storage = new Storage();

handler.getDriftReposFile = async () => {
  const bucket = 'devrel-prod-settings';
  const file = 'public_repos.json';
  const [contents] = await storage.bucket(bucket).file(file).download();
  return contents.toString();
};

handler.getDriftRepos = async () => {
  const jsonData = await handler.getDriftReposFile();
  if (!jsonData) {
    logger.error(
      new Error('JSON file downloaded from Cloud Storage was empty')
    );
    return null;
  }
  const repos = JSON.parse(jsonData).repos as DriftRepo[];
  return repos;
};

// autoDetectLabel tries to detect the right api: label based on the issue
// title.
//
// For example, an issue titled `spanner/transactions: TestSample failed` would
// be labeled `api: spanner`.
export function autoDetectLabel(
  repos: DriftRepo[],
  title: string
): string | undefined {
  if (!repos || !title) {
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
  firstPart = firstPart.toLowerCase(); // Convert to lower case.
  firstPart = firstPart.replace(/\s/, ''); // Remove spaces.

  // Replace some known firstPart values with their API name.
  const commonConversions = new Map();
  commonConversions.set('video', 'videointelligence');
  firstPart = commonConversions.get(firstPart) || firstPart;

  // Some APIs have "cloud" before the name (e.g. cloudkms and cloudiot).
  const possibleLabels = [`api: ${firstPart}`, `api: cloud${firstPart}`];
  // Assume repos contains all api: labels. Avoids an extra API call to list
  // the labels on a repo.
  return repos.find(repo => possibleLabels.indexOf(repo.github_label) > -1)
    ?.github_label;
}

handler.addLabeltoRepoAndIssue = async function addLabeltoRepoAndIssue(
  owner: string,
  repo: string,
  issueNumber: number,
  issueTitle: string,
  driftRepos: DriftRepo[],
  github: GitHubAPI
) {
  const driftRepo = driftRepos.find(x => x.repo === `${owner}/${repo}`);
  const res = await github.issues
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
    autoDetectedLabel = autoDetectLabel(driftRepos, issueTitle);
  }
  const index = driftRepos?.findIndex(r => driftRepo === r) % colorsData.length;
  const colorNumber = index >= 0 ? index : 0;
  const githubLabel = driftRepo?.github_label || autoDetectedLabel;

  if (githubLabel) {
    try {
      await github.issues.createLabel({
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
        await github.issues
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
        await github.issues
          .removeLabel({
            owner,
            repo,
            issue_number: issueNumber,
            name: dirtyLabel.name,
          })
          .catch(logger.error);
      }
    } else {
      await github.issues
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
  if (!foundSamplesTag && repo.includes('samples')) {
    await github.issues
      .createLabel({
        owner,
        repo,
        name: 'samples',
        color: colorsData[colorNumber].color,
      })
      .catch(logger.error);
    await github.issues
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
  //nightly cron that backfills and corrects api labels
  app.on(['schedule.repository'], async context => {
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
          context.github
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
      context.github
    );
  });

  app.on(['installation.created'], async context => {
    const repositories = context.payload.repositories;
    const driftRepos = await handler.getDriftRepos();
    if (!driftRepos) {
      return;
    }
    for await (const repository of repositories) {
      const [owner, repo] = repository.full_name.split('/');
      const issues = context.github.issues.listForRepo.endpoint.merge({
        owner,
        repo,
      });

      //goes through issues in repository, adds labels as necessary
      for await (const response of context.github.paginate.iterator(issues)) {
        const issues = response.data;
        //goes through each issue in each page
        for (const issue of issues) {
          await handler.addLabeltoRepoAndIssue(
            owner,
            repo,
            issue.number,
            issue.title,
            driftRepos,
            context.github
          );
        }
      }
    }
  });
}
