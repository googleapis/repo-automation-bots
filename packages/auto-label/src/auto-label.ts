// Copyright 2019 Google LLC
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

import { Application} from 'probot';
import { GitHubAPI } from 'probot/lib/github';
import * as path from 'path';
import e = require('express');

const fs = require('fs');
const colorsData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/colors.json'), 'utf8'));

handler.addLabels = async function addLabels(github: GitHubAPI, owner: string, repo: string, issueNumber: number, labels: string[]) {
  try {
      const data = await github.issues.addLabels({
          owner: owner,
          repo: repo,
          issue_number: issueNumber,
          labels: labels
      })
      return data;
  } catch(err) {
      return null;
  }
}

handler.checkExistingLabels = async function checkExistingLabels(github: GitHubAPI, owner: string, repo: string, name: string) {
  try {
      const data = await github.issues.getLabel({
          owner: owner,
          repo: repo,
          name: name
      })
      return data.data.name;
  } catch(err) {
      return null;
  }
}

handler.createLabel = async function createLabel(github: GitHubAPI, owner: string, repo: string, name: string, color: string) {
  try {
      const data = await github.issues.createLabel({
          owner: owner,
          repo: repo,
          name: name,
          color: color
      })
      return data;
  } catch(err) {
      return null;
  }
}

handler.checkExistingIssueLabels = async function checkExistingIssueLabels(github: GitHubAPI, owner: string, repo: string, issue_number: number) {
  try {
      const data = await github.issues.listLabelsOnIssue({
          owner: owner,
          repo: repo,
          issue_number: issue_number
      });
      console.log("checkLabelsOnIssue ")
      data.data.forEach(element => console.log(element));
      return data.data;
  } catch(err) {
      return null;
  }
}

handler.callStorage = async function callStorage(bucketName: any, srcFileName: any, destFileName: string) {
  const {Storage} = require('@google-cloud/storage');
  const storage = new Storage();
  let destFilename = path.resolve(destFileName);

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
}



function handler(app: Application) {
  app.on(
    [
      'issues.opened',
      'issues.reopened'
    ],
    async context => {
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const issueId = context.payload.issue.number;
      console.log(issueId);
      let flag = false;

      //get repo mapping from cloud Storage
      
      let jsonData = await handler.callStorage('devrel-dev-settings', 'public_repos.json','src/downloadedfile.txt');
      const jsonArray = JSON.parse(fs.readFileSync(jsonData)).repos;

      //const jsonArray = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/downloadedfile.txt'))).repos;
     
      if (jsonArray.length == 0) {
        console.log("JSON file downloaded from Cloud Storage was empty")
        return;
      }
      console.log(owner+"/"+repo);
      let objectInJsonArray = jsonArray.find((element: { repo: string; }) => element.repo === (owner+"/"+repo));
      console.log(objectInJsonArray);
      if(objectInJsonArray == undefined) {
        console.log("There was no match for the repo name: "+repo)
        return;
      }

      let colorNumber = jsonArray.findIndex((object: any) =>  objectInJsonArray === object);
      let githubLabel = objectInJsonArray.github_label
      let alreadyExists = await handler.checkExistingLabels(context.github, owner, repo, githubLabel);  

      if (alreadyExists == undefined || alreadyExists == null) {
        handler.createLabel(context.github, owner, repo, githubLabel, colorsData[colorNumber].color);
      } else {
        console.log("This label already exists on the repository, will check if it also exists on the issue");
      }
      let labelsOnIssue = await handler.checkExistingIssueLabels(context.github, owner, repo, issueId);
      if (labelsOnIssue != undefined && labelsOnIssue != null) {
        let found = labelsOnIssue.find((element: { name: string; }) => element.name === githubLabel);
        if (found == undefined || found == null) {
          handler.addLabels(context.github, owner, repo, issueId, [`${objectInJsonArray.github_label}`]);
          flag = true;
        } else {
         console.log("This label already exists on this issue")
         return;
        }
      } else {
        await handler.addLabels(context.github, owner, repo, issueId, [`${objectInJsonArray.github_label}`]);
        flag = true;
      }
     

       if (!flag) {
        console.log("There was no match for repo name: "+repo);
       }
       
       return;

    })

};


export = handler;

