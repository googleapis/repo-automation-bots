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
import { POINT_CONVERSION_COMPRESSED } from 'constants';
//import * as fs from 'fs';
const fs = require('fs');
const jsonData = path.resolve(__dirname, '../../src/downloadedfile.txt');
const colorsData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/colors.json'), 'utf8'));

async function callStorage() {


  const {Storage} = require('@google-cloud/storage');
  const storage = new Storage();
  const bucketName = 'devrel-dev-settings';
  const srcFilename = 'public_repos.json';
  const destFilename = path.resolve("src/downloadedfile.txt")

  const options = {
  // The path to which the file should be downloaded, e.g. "./file.txt"
  destination: destFilename,
  };

  // Downloads the file
  await storage
  .bucket(bucketName)
  .file(srcFilename)
  .download(options);

  console.log(
  `gs://${bucketName}/${srcFilename} downloaded to ${destFilename}.`
  );
}

async function createLabel(github: GitHubAPI, owner: string, repo: string, name: string, color: string) {
  try {
      const data = await github.issues.createLabel({
          owner: owner,
          repo: repo,
          name: name,
          color: color
      })
      console.log(await data);
      console.log('a');
      return data;
  } catch(err) {
    console.log('b');
      return null;
  }
}

async function addLabels(github: GitHubAPI, owner: string, repo: string, issueNumber: number, labels: string[]) {
  try {
      const data = await github.issues.addLabels({
          owner: owner,
          repo: repo,
          issue_number: issueNumber,
          labels: labels
      })
      console.log('d');
      console.log(await data);
      return data;
  } catch(err) {
    console.log('e');
      return null;
  }
}


export = (app: Application) => {
  

  app.on(
    [
      'issues.opened'
    ],
    async context => {
      
      const owner = context.payload.repository.owner.login;
      console.log(owner);
      const repoName = 'sofisl/'+context.payload.repository.name;
      console.log(repoName);
      const repo = context.payload.repository.name;
      console.log(repo);
      const issueId = context.payload.issue.id;
      console.log(issueId);
      let flag = false;

      //get repo mapping from cloud Storage
      //await callStorage();

      const jsonArray = JSON.parse(fs.readFileSync(jsonData, 'utf8')).repos;

      if (jsonArray.length != 0) {
        jsonArray.forEach((element: any) => {
          let objectValues = Object.values(element);
          let elementNumber = objectValues.indexOf(repoName);
          let colorNumber = jsonArray.findIndex(function(object: any) { return element = object});
          if (elementNumber != -1) {
            const githubLabel = element.github_label;
            console.log(githubLabel);
            createLabel(context.github, 'sofisl', 'mergeOnGreenTest', githubLabel, colorsData[colorNumber].color);
            addLabels(context.github, 'sofisl', repo, issueId, githubLabel);
            flag = true;
            return;
          }
        })
      }

       if (!flag) {
        console.log("There was no match");
       }

       return;
     
    })
};