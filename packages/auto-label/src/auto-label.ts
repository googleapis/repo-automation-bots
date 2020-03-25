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
//

import { Application } from 'probot';
import { GitHubAPI } from 'probot/lib/github';
import * as path from 'path';

const fs = require('fs');
const colorsData = require('./colors.json');

interface JSONData {
  github_label: string;
  repo: string;
}

handler.addLabels = async function addLabels(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueNumber: number,
  labels: string[]
) {
  try {
    const data = await github.issues.addLabels({
      owner,
      repo,
      issue_number: issueNumber,
      labels,
    });
    return data;
  } catch (err) {
    return null;
  }
};

handler.checkExistingLabels = async function checkExistingLabels(
  github: GitHubAPI,
  owner: string,
  repo: string,
  name: string
) {
  try {
    const data = await github.issues.getLabel({
      owner,
      repo,
      name,
    });
    return data.data.name;
  } catch (err) {
    return null;
  }
};

handler.createLabel = async function createLabel(
  github: GitHubAPI,
  owner: string,
  repo: string,
  name: string,
  color: string
) {
  try {
    const data = await github.issues.createLabel({
      owner,
      repo,
      name,
      color,
    });
    return data;
  } catch (err) {
    return null;
  }
};

handler.checkExistingIssueLabels = async function checkExistingIssueLabels(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueNumber: number
) {
  try {
    const data = await github.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number: issueNumber,
    });
    if (data.data === undefined) {
      return null;
    } else {
      return data.data;
    }
  } catch (err) {
    return null;
  }
};

handler.callStorage = async function callStorage(
  bucketName: string,
  srcFileName: string
) {
  const { Storage } = require('@google-cloud/storage');
  const storage = new Storage();

  // Downloads the file
  const jsonData = (
    await storage
      .bucket(bucketName)
      .file(srcFileName)
      .download()
  )[0];

  return jsonData.toString();
};

handler.checkIfFileIsEmpty = async function checkIfFileIsEmpty(
  jsonData: string
) {
  if (jsonData.length === 0) {
    console.log('JSON file downloaded from Cloud Storage was empty');
    return null;
  } else {
    const jsonArray = JSON.parse(jsonData).repos;
    return jsonArray;
  }
};

handler.checkIfElementIsInArray = function checkIfElementIsInArray(
  jsonArray: JSONData[],
  owner: string,
  repo: string
) {
  if (jsonArray) {
    const objectInJsonArray = jsonArray.find(
      (element: JSONData) => element.repo === owner + '/' + repo
    );
    return objectInJsonArray;
  } else {
    return null;
  }
};

const BACKFILL_LABEL = 'auto-label:backfill';
function handler(app: Application) {

  app.on('pull_request.labeled', async context => {
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    // if missing the label, skip
    if (
      !context.payload.pull_request.labels.some(
        label => label.name === BACKFILL_LABEL
      )
    ) {
      app.log.info(
        `ignoring non-backfill label action (${context.payload.pull_request.labels.join(
          ', '
        )})`
      );
      return;
    }

    const issues = context.github.issues.listForRepo.endpoint.merge({ owner, repo });
    for await (const response of context.github.paginate.iterator(issues)) {
      const issue = response.data;
    })
  )
 
  });

  app.on(['issues.opened', 'issues.reopened'], async context => {
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const issueId = context.payload.issue.number;

    const jsonData = await handler.callStorage(
      'devrel-prod-settings',
      'public_repos.json'
    );

    const jsonArray = await handler.checkIfFileIsEmpty(jsonData);

    let objectInJsonArray: JSONData | null | undefined;
    objectInJsonArray = handler.checkIfElementIsInArray(jsonArray, owner, repo);

    if (objectInJsonArray === null || objectInJsonArray === undefined) {
      console.log('There was no match for the repo name: ' + repo);
      return;
    }

    const colorNumber = jsonArray.findIndex(
      (object: JSONData) => objectInJsonArray === object
    );
    const githubLabel = objectInJsonArray.github_label;
    const alreadyExists = await handler.checkExistingLabels(
      context.github,
      owner,
      repo,
      githubLabel
    );

    if (alreadyExists === null || alreadyExists === undefined) {
      handler.createLabel(
        context.github,
        owner,
        repo,
        githubLabel,
        colorsData[colorNumber].color
      );
    } else {
      console.log(
        'This label already exists on the repository, will check if it also exists on the issue'
      );
    }

    const labelsOnIssue = await handler.checkExistingIssueLabels(
      context.github,
      owner,
      repo,
      issueId
    );

    if (labelsOnIssue) {
      const found = labelsOnIssue.find(
        (element: { name: string }) => element.name === githubLabel
      );
      if (found) {
        console.log('This label already exists on this issue');
        return;
      } else {
        handler.addLabels(context.github, owner, repo, issueId, [
          `${objectInJsonArray.github_label}`,
        ]);
      }
    } else {
      await handler.addLabels(context.github, owner, repo, issueId, [
        `${objectInJsonArray.github_label}`,
      ]);
    }

    return;
  });
}

export = handler;
