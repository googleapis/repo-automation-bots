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

import { Application, Octokit } from 'probot';
import { GitHubAPI } from 'probot/lib/github';
import * as path from 'path';
import e = require('express');
import { IssuesListLabelsOnIssueResponseItem } from '@octokit/rest';

const fs = require('fs');
const colorsData = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../src/colors.json'), 'utf8')
);

interface JSONData {
  num_total_prs: number;
  num_open_p1s: number;
  num_open_questions: number;
  num_open_p0s: number;
  language: string;
  api_shortname: string;
  github_label: string;
  num_open_p2s: number;
  is_tracking_issues: boolean;
  repo: string;
  is_tracking_samples: boolean;
  num_open_issues: number;
  num_total_issues: number;
  num_open_prs: number;
  issue_score: number;
  num_slo_violations: number;
  num_commits: number;
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
  srcFileName: string,
  destFileName: string
) {
  const { Storage } = require('@google-cloud/storage');
  const storage = new Storage();
  const destFilename = path.resolve(destFileName);

  const options = {
    // The path to which the file should be downloaded, e.g. "./file.txt"
    destination: destFilename,
  };

  // Downloads the file
  await storage
    .bucket(bucketName)
    .file(srcFileName)
    .download(options);

  console.log(
    `gs://${bucketName}/${srcFileName} downloaded to ${destFilename}.`
  );
  return path.resolve(__dirname, `../../${destFileName}`);
};

handler.checkIfFileIsEmpty = async function checkIfFileIsEmpty(
  jsonData: string
) {
  if (fs.readFileSync(jsonData).length === 0) {
    console.log('JSON file downloaded from Cloud Storage was empty');
    return null;
  } else {
    const jsonArray = JSON.parse(fs.readFileSync(jsonData)).repos;
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

function handler(app: Application) {
  app.on(['issues.opened', 'issues.reopened'], async context => {
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const issueId = context.payload.issue.number;

    const jsonData = await handler.callStorage(
      //TODO: CHANGE THESE SETTINGS TO PROD ONCE DEPLOYED
      'devrel-dev-settings',
      'public_repos.json',
      'src/downloadedfile.txt'
    );

    const jsonArray = await handler.checkIfFileIsEmpty(jsonData);

    let objectInJsonArray: JSONData | null | undefined;
    objectInJsonArray = handler.checkIfElementIsInArray(jsonArray, owner, repo);

    if (objectInJsonArray == null || objectInJsonArray === undefined) {
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

    if (alreadyExists == null || alreadyExists === undefined) {
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
