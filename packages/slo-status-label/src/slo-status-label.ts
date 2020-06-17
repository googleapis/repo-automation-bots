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

import {Application, Context} from 'probot'; 
import {GitHubAPI} from 'probot/lib/github';
import {
  PullsListFilesResponse,
  PullsListFilesResponseItem,
  Response,
  ChecksCreateParams
} from '@octokit/rest';
import Ajv, { ErrorObject } from 'ajv';

const schema = require("./../utils/schema.json");

type ValidationResults = {
  isValid: Promise<boolean>,
  errors?: ErrorObject [] | null | undefined
};

function handler(app: Application) {
  app.on(['pull_request.opened', 'pull_request.reopened'], async (context: Context) => {
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const pull_number =  context.payload.number;

      let fileResponse: Response<PullsListFilesResponse>;
      fileResponse = await handler.listFiles(context.github, owner, repo, pull_number, 100); //Add paginate
      const fileList: PullsListFilesResponseItem[] = fileResponse.data;

      for (let i = 0; fileList[i] !== undefined; i++) {
        const file = fileList[i];
        
        if(file.filename === 'issue_slo_rules.json') {       
          handler.handle_slos(context, owner, repo, file.sha);
          break;
        }
      } 
  });
};

handler.handle_slos = async function handle_slos(
  context: Context,
  owner: string,
  repo: string,
  file_sha: string
) {
    const sloString = await handler.getFileContents(context.github, owner, repo, file_sha);
    var sloData = JSON.parse(sloString)

    const res: ValidationResults = await handler.lint(schema, sloData);
    handler.commentPR(context, res.isValid);
    handler.createCheck(context, res);
}

handler.getFileContents = async function getFileContents(
  github: GitHubAPI,
  owner: string,
  repo: string,
  file_sha: string,
) {
    try {
      const blob = await github.git.getBlob({
        owner,
        repo,
        file_sha
      });
      const fileContent = Buffer.from(blob.data.content, 'base64').toString('utf8');
      return fileContent;
    } catch (err) {
      throw new Error(err);
    }
}

handler.listFiles = async function listFiles(
  github: GitHubAPI,
  owner: string,
  repo: string,
  pull_number: number,
  per_page: number
) {
  try {
    const listOfFiles = await github.pulls.listFiles({
      owner,
      repo,
      pull_number,
      per_page
    });
    return listOfFiles;
  } catch (err) {
    throw new Error(err);
  }
};

handler.lint = async function lint (
  schema: JSON, 
  sloData: JSON
) {
  var ajv = new Ajv();
  
  try {
    var validate = ajv.compile(schema);
    var isValid = await validate(sloData);

    const res: ValidationResults = {
      isValid: isValid,
      errors: validate.errors
    }
    return res;
  } catch (err) {
    throw new Error (err);
  }
}

handler.commentPR = async function commentPR(
  context: Context, 
  isValid: Promise<boolean>
) {
  let pullsComment;

  if(!isValid) {
    pullsComment = context.issue({ body: 'ERROR: "issue_slo_rules.json" file is not valid with Json schema' });
    try {
      await context.github.issues.createComment(pullsComment);
    } catch (err) {
        throw new Error (err);
    }
  }
}

handler.createCheck = async function createCheck(
  context: Context,
  validationRes: ValidationResults
) {

  const checkParams: ChecksCreateParams = context.repo({
    name: 'slo-rules-check',
    conclusion: 'success',
    head_sha: context.payload.pull_request.head.sha,
  });

  if(!validationRes.isValid) {
    checkParams.conclusion = 'failure';
    checkParams.output = {
      title: 'Invalid slo rules detected',
      summary: 'issue_slo_rules.json does not follow the slo_rules schema.',
      text: validationRes.errors?.toString()
    }

    try {
      await context.github.checks.create(checkParams); 
    } catch (err) {
        throw new Error (err);
    }
  }

}

export = handler;





