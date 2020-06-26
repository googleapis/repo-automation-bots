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

import {Application, Context} from 'probot';
import {GitHubAPI} from 'probot/lib/github';
import {
  PullsListFilesResponse,
  Response,
  ChecksCreateParams,
} from '@octokit/rest';
import Ajv, {ErrorObject} from 'ajv';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const schema = require('./../data/schema.json');

type ValidationResults = {
  isValid: boolean;
  errors?: ErrorObject[] | null | undefined;
};

function handler(app: Application) {
  app.on(
    [
      'pull_request.opened',
      'pull_request.reopened',
      'pull_request.edited',
      'pull_request.synchronize',
    ],
    async (context: Context) => {
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const pull_number = context.payload.number;

      const fileResponse = await handler.listFiles(
        context.github,
        owner,
        repo,
        pull_number,
        100
      );

      if (!fileResponse) {
        return;
      }

      const fileList = fileResponse.data;

      for (const file of fileList) {
        //Checks to see if file is repo level or org level issue_slo_rules.json
        if (
          file.filename === '.github/issue_slo_rules.json' ||
          (repo === '.github' && file.filename === 'issue_slo_rules.json')
        ) {
          await handler.handle_slos(
            context,
            owner,
            repo,
            pull_number,
            file.sha
          );
          break;
        }
      }
    }
  );
}
// Gets file contents, comments on PR if invalid slo rules, and creates a check
handler.handle_slos = async function handle_slos(
  context: Context,
  owner: string,
  repo: string,
  issue_number: number,
  file_sha: string
) {
  const sloString = await handler.getFileContents(
    context.github,
    owner,
    repo,
    file_sha
  );

  if (sloString) {
    const sloData = JSON.parse(sloString);
    const res = await handler.lint(schema, sloData);

    await handler.commentPR(
      context.github,
      owner,
      repo,
      issue_number,
      res.isValid
    );
    await handler.createCheck(context, res);
  }
};

handler.getFileContents = async function getFileContents(
  github: GitHubAPI,
  owner: string,
  repo: string,
  file_sha: string
): Promise<string | undefined> {
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
    console.log(err);
    return;
  }
};

handler.listFiles = async function listFiles(
  github: GitHubAPI,
  owner: string,
  repo: string,
  pull_number: number,
  per_page: number
): Promise<Response<PullsListFilesResponse> | undefined> {
  try {
    const listOfFiles = await github.pulls.listFiles({
      owner,
      repo,
      pull_number,
      per_page,
    });
    return listOfFiles;
  } catch (err) {
    console.log(err);
    return;
  }
};

//Linting the issue_slo_rules.json against the slo schema
handler.lint = async function lint(
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
handler.commentPR = async function commentPR(
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
    console.log(err);
    return;
  }
  return;
};

handler.createCheck = async function createCheck(
  context: Context,
  validationRes: ValidationResults
) {
  const checkParams: ChecksCreateParams = context.repo({
    name: 'slo-rules-check',
    conclusion: 'success',
    head_sha: context.payload.pull_request.head.sha,
  });

  if (!validationRes.isValid) {
    checkParams.conclusion = 'failure';
    checkParams.output = {
      title: 'Invalid slo rules detected',
      summary: 'issue_slo_rules.json does not follow the slo_rules schema.',
      text: JSON.stringify(validationRes.errors, null, 4),
    };
  }

  try {
    await context.github.checks.create(checkParams);
  } catch (err) {
    console.log(err);
    return;
  }
};

export = handler;
