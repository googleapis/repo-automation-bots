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

import {GitHubAPI} from 'probot/lib/github';
import Ajv, {ErrorObject} from 'ajv';
import { Context } from 'probot';


// eslint-disable-next-line @typescript-eslint/no-var-requires
const schema = require('./../data/schema.json');

type Conclusion =
  | 'success'
  | 'failure'
  | 'neutral'
  | 'cancelled'
  | 'timed_out'
  | 'action_required'
  | undefined;

interface ValidationResults {
  isValid: boolean;
  errors?: ErrorObject[] | null;
}

interface PullsListFilesResponseItem {
  filename: string;
  sha: string;
}

handle_lint.listFiles = async function listFiles(
    github: GitHubAPI,
    owner: string,
    repo: string,
    pull_number: number,
    per_page: number
  ): Promise<PullsListFilesResponseItem[] | null> {
    try {
      const listOfFiles = await github.pulls.listFiles({
        owner,
        repo,
        pull_number,
        per_page,
      });
      return listOfFiles.data;
    } catch (err) {
      console.warn(
        `Error getting list of files in repo: ${repo} for issue number: ${pull_number}. error status:${err.status}`
      );
      return null;
    }
};

// Lints issue_slo_rules.json file and creates a check on PR. If file is invalid it will comment on PR
handle_lint.handle_slos = async function handle_slos(
    context: Context,
    owner: string,
    repo: string,
    issue_number: number,
    file_sha: string
  ) {
    const sloString = await handle_lint.getFileShaContents(
      context.github,
      owner,
      repo,
      file_sha
    );
  
    if (!sloString) {
      return;
    }
  
    const sloData = JSON.parse(sloString);
    const res = await handle_lint.lint(schema, sloData);
  
    await handle_lint.commentPR(
      context.github,
      owner,
      repo,
      issue_number,
      res.isValid
    );
    await handle_lint.createCheck(context, res);
  };
  
  handle_lint.getFileShaContents = async function getFileShaContents(
    github: GitHubAPI,
    owner: string,
    repo: string,
    file_sha: string
  ): Promise<string | null> {
    try {
      const blob = await github.git.getBlob({
        owner,
        repo,
        file_sha,
      });
      const fileContent = Buffer.from(blob.data.content, 'base64').toString(
        'utf8'
      );
      return fileContent;
    } catch (err) {
      console.warn(
        `Error getting file content in repo:${repo}. error status:${err.status}`
      );
      return null;
    }
  };
  
  //Linting the issue_slo_rules.json against the slo schema
  handle_lint.lint = async function lint(
    schema: JSON,
    sloData: JSON
  ): Promise<ValidationResults> {
    const ajv = new Ajv();
    const validate = await ajv.compile(schema);
    const isValid = await validate(sloData);
  
    return {
      isValid: isValid,
      errors: validate.errors,
    } as ValidationResults;
  };
  
  //Comments on PR only if the issue_slo_rules.json is invalid
  handle_lint.commentPR = async function commentPR(
    github: GitHubAPI,
    owner: string,
    repo: string,
    issue_number: number,
    isValid: boolean
  ) {
    if (isValid) {
      return;
    }
    const body =
      'ERROR: "issue_slo_rules.json" file is not valid with JSON schema';
    try {
      await github.issues.createComment({
        owner,
        repo,
        issue_number,
        body,
      });
    } catch (err) {
      console.warn(
        `Error creating comment in repo: ${repo} for issue number: ${issue_number}. error status: ${err.status}`
      );
      return;
    }
  };
  
  handle_lint.createCheck = async function createCheck(
    context: Context,
    validationRes: ValidationResults
  ) {
    let checkParams = context.repo({
      name: 'slo-rules-check',
      head_sha: context.payload.pull_request.head.sha,
      conclusion: 'success' as Conclusion,
    });
  
    if (!validationRes.isValid) {
      checkParams = context.repo({
        name: 'slo-rules-check',
        head_sha: context.payload.pull_request.head.sha,
        conclusion: 'failure' as Conclusion,
        output: {
          title: 'Commit message did not follow Conventional Commits',
          summary: 'issue_slo_rules.json does not follow the slo_rules schema.',
          text: JSON.stringify(validationRes.errors, null, 4),
        },
      });
    }
    try {
      await context.github.checks.create(checkParams);
    } catch (err) {
      console.error(
        `Error creating check in repo ${context.payload.repository.name} \n ${err}`
      );
      return;
    }
  };

export async function handle_lint (
    context: Context,
    owner: string,
    repo: string,
    pullNumber: number
) {
    const fileList = await handle_lint.listFiles(
        context.github,
        owner,
        repo,
        pullNumber,
        100
      );

      if (!fileList) {
        return;
      }

      for (const file of fileList) {
        //Checks to see if file is repo level or org level issue_slo_rules.json
        if (
          file.filename === '.github/issue_slo_rules.json' ||
          (repo === '.github' && file.filename === 'issue_slo_rules.json')
        ) {
          await handle_lint.handle_slos(context, owner, repo, pullNumber, file.sha);
          break;
        }
      }
}