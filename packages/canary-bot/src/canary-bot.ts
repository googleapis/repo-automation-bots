// Copyright 2021 Google LLC
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

/* eslint-disable-next-line node/no-extraneous-import */
import {Probot} from 'probot';
/* eslint-disable-next-line node/no-extraneous-import */
import {components} from '@octokit/openapi-types';
import * as fs from 'fs';
import {resolve} from 'path';
import {logger, addOrUpdateIssueComment} from 'gcf-utils';

import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
dayjs.extend(utc);
dayjs.extend(timezone);

type IssuesListForRepoResponseItem = components['schemas']['issue-simple'];
type IssuesListForRepoResponseData = IssuesListForRepoResponseItem[];

const packageJsonFile = fs.readFileSync(
  resolve(__dirname, '../../package.json'),
  'utf-8'
);
const packageJson = JSON.parse(packageJsonFile);
const versionDetails = `${JSON.stringify(packageJson.dependencies, null, 2)}`;

const cronIssueTitle = 'A canary is chirping';
const myRepositoryName = 'repo-automation-bots';
const myOrganizationName = 'googleapis';

function getIssueBody(): string {
  const date = dayjs
    .tz(new Date(), 'America/Los_Angeles')
    .format('YYYY MM-DD HH:mm:ss');
  return (
    `The dependencies and their versions are: \n${versionDetails}\n` +
    `at ${date}\n🐦`
  );
}

export = (app: Probot) => {
  app.on('schedule.repository' as '*', async context => {
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;
    if (repo !== myRepositoryName || owner !== myOrganizationName) {
      return;
    }
    const body = getIssueBody();
    const options = context.octokit.issues.listForRepo.endpoint.merge({
      owner,
      repo,
      per_page: 100,
      state: 'all', // Include open and closed issues.
    });
    const issues = (await context.octokit.paginate(
      options
    )) as IssuesListForRepoResponseData;

    const issue = issues.find(issue => issue.title === cronIssueTitle);

    // Issue found
    if (issue) {
      await context.octokit.issues.update({
        owner: owner,
        repo: repo,
        issue_number: issue.number,
        body: body,
      });
    } else {
      await context.octokit.issues.create({
        owner: owner,
        repo: repo,
        title: cronIssueTitle,
        body: body,
      });
    }
  });

  app.on('schedule.installation' as '*', async context => {
    logger.info(
      `executed scheduled task for installation: ${context.payload.installation.id}`
    );
  });

  app.on('schedule.global' as '*', async () => {
    logger.info('executed global scheduled task');
  });

  app.on(['issues.opened', 'issues.reopened'], async context => {
    if (context.payload.issue.title.includes('canary-bot test')) {
      const {owner, repo} = context.repo();
      await addOrUpdateIssueComment(
        context.octokit,
        owner,
        repo,
        context.payload.issue.number,
        context.payload.installation!.id,
        getIssueBody()
      );
    } else {
      logger.info(
        'The bot is skipping this issue because the title does not include canary-bot test'
      );
    }
  });
};
