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

import {Storage} from '@google-cloud/storage';
// eslint-disable-next-line node/no-extraneous-import
import {Application} from 'probot';
// eslint-disable-next-line node/no-extraneous-import
import {GitHubAPI} from 'probot/lib/github';
// eslint-disable-next-line node/no-extraneous-import
import Webhooks from '@octokit/webhooks';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const colorsData = require('./colors.json');

interface JSONData {
  github_label: string;
  repo: string;
}

interface Labels {
  name: string;
}

const storage = new Storage();

//adds labels to an issue
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

handler.removeLabel = async function removeLabel(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueNumber: number,
  name: string
) {
  try {
    const data = await github.issues.removeLabel({
      owner,
      repo,
      issue_number: issueNumber,
      name,
    });
    return data;
  } catch (err) {
    return null;
  }
};

//checks whether a specific label exists in a repo
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

//creates a label for a repo
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

//checks existing labels on an issue
handler.checkExistingIssueLabels = async function checkExistingIssueLabels(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueNumber: number
): Promise<Labels[] | null> {
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

// maybeAddAPILabel adds the given label if there isn't already an api: label.
handler.maybeAddAPILabel = async (
  github: GitHubAPI,
  owner: string,
  repo: string,
  issueNumber: number,
  labelsOnIssue: Labels[] | null,
  label: string
): Promise<string | undefined> => {
  if (labelsOnIssue) {
    const found = labelsOnIssue.find((element: {name: string}) =>
      element.name.startsWith('api:')
    );
    if (found) {
      console.log(`${owner}/${repo}#${issueNumber} already has an api: label`);
      return undefined;
    }
    await handler.addLabels(github, owner, repo, issueNumber, [label]);
    return label;
  }
  await handler.addLabels(github, owner, repo, issueNumber, [label]);
  return label;
};

//gets Storage data that maps api to product name
handler.callStorage = async function callStorage(
  bucketName: string,
  srcFileName: string
) {
  // Downloads the file
  const jsonData = (
    await storage.bucket(bucketName).file(srcFileName).download()
  )[0];

  return jsonData.toString();
};

//checks if there is no file in the Cloud Storage system
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

//checks if specific element is in an array of JSON Data
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

// autoDetectLabel tries to detect the right api: label based on the issue
// title.
//
// For example, an issue titled `spanner/transactions: TestSample failed` would
// be labeled `api: spanner`.
handler.autoDetectLabel = (
  jsonArray: JSONData[],
  title: string
): string | undefined => {
  if (!jsonArray) {
    return undefined;
  }
  let firstPart = title.split(':')[0]; // Before the colon, if there is one.
  firstPart = firstPart.split('/')[0]; // Before the slash, if there is one.
  firstPart = firstPart.split('.')[0]; // Before the period, if there is one.
  firstPart = firstPart.toLowerCase(); // Convert to lower case.
  firstPart = firstPart.replace(/\s/, ''); // Remove spaces.

  const wantLabel = `api: ${firstPart}`;
  // Some APIs have "cloud" before the name (e.g. cloudkms and cloudiot).
  // If needed, we could replace common firstParts to known API names.
  const wantLabelCloud = `api: cloud${firstPart}`;
  // Assume jsonArray contains all api: labels. Avoids an extra API call to list
  // the labels on a repo.
  return jsonArray.find(
    element =>
      element.github_label === wantLabel ||
      element.github_label === wantLabelCloud
  )?.github_label;
};

handler.mainLogic = async function mainLogic(
  owner: string,
  repo: string,
  issueNumber: number,
  context: any,
  jsonArray: any
) {
  const objectInJsonArray = handler.checkIfElementIsInArray(
    jsonArray,
    owner,
    repo
  );

  let autoDetectedLabelAdded: string | undefined;

  const labelsOnIssue = await handler.checkExistingIssueLabels(
    context.github,
    owner,
    repo,
    issueNumber
  );

  if (!objectInJsonArray?.github_label) {
    console.log(
      `There was no configured match for the repo ${repo}, trying to auto-detect the right label`
    );
    const autoDetectedLabel = handler.autoDetectLabel(
      jsonArray,
      context.payload.issue.title
    );
    if (autoDetectedLabel) {
      console.log(
        `Auto-detected label ${autoDetectedLabel} for ${owner}/${repo}#${issueNumber}`
      );
      autoDetectedLabelAdded = await handler.maybeAddAPILabel(
        context.github,
        owner,
        repo,
        context.payload.issue.number,
        labelsOnIssue,
        autoDetectedLabel
      );
    } else {
      console.log(
        `Auto-detect did not add a label for ${owner}/${repo}#${issueNumber}: '${context.payload.issue.title}'`
      );
    }
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

  if (labelsOnIssue) {
    const found = labelsOnIssue.find(
      (element: {name: string}) => element.name === githubLabel
    );
    const cleanUpOtherLabels = labelsOnIssue.filter(
      (element: {name: string}) =>
        element.name.startsWith('api') &&
        element.name !== found?.name &&
        element.name !== autoDetectedLabelAdded
    );
    if (found) {
      console.log('This label already exists on this issue');
      return;
    } else {
      await handler.addLabels(context.github, owner, repo, issueNumber, [
        `${objectInJsonArray.github_label}`,
      ]);
    }
    for (const dirtyLabel of cleanUpOtherLabels) {
      await handler.removeLabels(
        context.github,
        owner,
        repo,
        issueNumber,
        dirtyLabel.name
      );
    }
  } else {
    await handler.addLabels(context.github, owner, repo, issueNumber, [
      `${objectInJsonArray.github_label}`,
    ]);
  }

  return;
};

//main function, responds to label being added
function handler(app: Application) {
  //nightly cron that backfills and corrects api labels
  app.on(['schedule.repository'], async context => {
    console.info(`running for org ${context.payload.cron_org}`);
    const owner = context.payload.organization.login;
    const repo = context.payload.repository.name;

    if (context.payload.cron_org !== owner) {
      console.log(`skipping run for ${context.payload.cron_org}`);
      return;
    }

    const jsonData = await handler.callStorage(
      'devrel-prod-settings',
      'public_repos.json'
    );
    const jsonArray = await handler.checkIfFileIsEmpty(jsonData);

    //all the issues in the repository
    const issues = context.github.issues.listForRepo.endpoint.merge({
      owner,
      repo,
    });

    //goes through issues in repository, adds labels as necessary
    for await (const response of context.github.paginate.iterator(issues)) {
      const issue = response.data;
      if (!issue.pull_request) {
        await handler.mainLogic(owner, repo, issue.number, context, jsonArray);
      }
    }
  });

  app.on(['issues.opened', 'issues.reopened'], async context => {
    //job that labels issues when they are opened
    const owner = context.payload.repository.owner.login;
    const repo = context.payload.repository.name;
    const issueNumber = context.payload.issue.number;

    const jsonData = await handler.callStorage(
      'devrel-prod-settings',
      'public_repos.json'
    );

    const jsonArray = await handler.checkIfFileIsEmpty(jsonData);

    await handler.mainLogic(owner, repo, issueNumber, context, jsonArray);
  });
}

export = handler;
