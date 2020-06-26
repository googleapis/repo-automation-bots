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
  PullsListFilesResponseItem,
  Response,
  ChecksCreateParams,
} from '@octokit/rest';
// eslint-disable-next-line node/no-extraneous-import
import Ajv, {ErrorObject} from 'ajv';
import {type} from 'os';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const schema = require('./../utils/schema.json');

//const sloRules = require('./../../../../.github/issue_slo_rules');

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

      const fileResponse:
        | Response<PullsListFilesResponse>
        | undefined = await handler.listFiles(
        context.github,
        owner,
        repo,
        pull_number,
        100
      );
      let fileList: PullsListFilesResponseItem[] | undefined;

      if (fileResponse !== undefined) fileList = fileResponse.data;

      for (
        let i = 0;
        fileList !== undefined && fileList[i] !== undefined;
        i++
      ) {
        const file = fileList[i];
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
  app.on(
    [
      'issues.opened',
      'issues.reopened',
      'issues.labeled',
      'issues.unlabeled',
      'issues.edited',
    ],
    async (context: Context) => {
      const owner = context.payload.repository.owner.login;
      const repo = context.payload.repository.name;
      const issue_number = context.payload.issue.number;

      const labelSet = await handler.getSetOfIssueLabels(
        context.github,
        owner,
        repo,
        issue_number
      );

      const sloRules = await handler.getSloFile(context.github, owner, repo);
      await handler.handle_issues(sloRules, labelSet);
    }
  );
}

handler.handle_issues = async function handle_issues(
  sloRules: any,
  labelSet: Set<string> | undefined
) {
  for (let i = 0; i < sloRules.length; i++) {
    let appliesTo: boolean = sloRules[i].appliesTo === undefined;
    if (!appliesTo) {
      appliesTo = await handler.appliesTo(sloRules[i], labelSet);
    }
    //If applies To then check compliance settings
  }
};

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

  if (sloString !== undefined) {
    const sloData = JSON.parse(sloString);
    const res: ValidationResults = await handler.lint(schema, sloData);

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

handler.commentPR = async function commentPR(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issue_number: number,
  isValid: boolean
) {
  if (!isValid) {
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

handler.appliesTo = async function appliesTo(
  slo: any,
  issueLabelSet: Set<string> | undefined
): Promise<boolean> {
  if (issueLabelSet !== undefined && issueLabelSet.size !== 0) {
    const githubLabels = await handler.convertToArray(
      slo.appliesTo.githubLabels
    );
    if (githubLabels !== undefined) {
      const isSubSet: boolean = await handler.isSubSet(
        githubLabels,
        issueLabelSet
      );
      if (!isSubSet) {
        return false;
      }
    }

    const excludedGitHubLabels = await handler.convertToArray(
      slo.appliesTo.excludedGitHubLabels
    );
    if (excludedGitHubLabels !== undefined) {
      const isElementExist: boolean = await handler.isElementExist(
        excludedGitHubLabels,
        issueLabelSet
      );
      if (isElementExist) {
        return false;
      }
    }

    let priority = slo.appliesTo.priority;
    if (priority !== undefined) {
      priority = priority.toLowerCase();
      if (
        !issueLabelSet.has(priority) &&
        !issueLabelSet.has('priority: ' + priority)
      ) {
        return false;
      }
    }

    let issueType = slo.appliesTo.issueType;
    if (issueType !== undefined) {
      issueType = issueType.toLowerCase();
      if (
        !issueLabelSet.has(issueType) &&
        !issueLabelSet.has('type: ' + issueType)
      )
        return false;
    }
  } else {
    if (Object.keys(slo.appliesTo).length > 0) {
      return false;
    }
  }
  return true;
};

handler.convertToArray = async function convertToArray(
  variable: string[] | string
): Promise<string[]> {
  if (typeof variable === 'string') {
    return [variable.toLowerCase()];
  }
  if (variable !== undefined) {
    variable.forEach((label: string) => label.toLowerCase());
  }
  return variable;
};

handler.isSubSet = async function isSubSet(
  sloLabels: string[],
  issueLabelSet: Set<string>
): Promise<boolean> {
  for (let i = 0; i < sloLabels.length; i++) {
    if (!issueLabelSet?.has(sloLabels[i])) {
      return false;
    }
  }
  return true;
};

handler.isElementExist = async function isElementExist(
  sloLabels: string[],
  issueLabelSet: Set<string>
): Promise<boolean> {
  for (let i = 0; i < sloLabels.length; i++) {
    if (issueLabelSet?.has(sloLabels[i])) {
      return true;
    }
  }
  return false;
};

handler.getSetOfIssueLabels = async function getSetOfIssueLabels(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issue_number: number
): Promise<Set<string> | undefined> {
  try {
    const labelsResponse = await github.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number,
    });

    const labelSet: Set<string> = new Set<string>();
    labelsResponse.data.forEach(label =>
      labelSet.add(label.name.toLowerCase())
    );
    return labelSet;
  } catch (err) {
    console.log(err);
    return;
  }
};

handler.getSloFile = async function getSloFile(
  github: GitHubAPI,
  owner: string,
  repo: string
): Promise<string | undefined> {
  let path = '.github/issue_slo_rules.json';
  let sloRules: string | undefined = await handler.getConfigFileContent(github, owner, repo, path);

  if (sloRules === undefined) {
    path = 'issue_slo_rules.json';
    sloRules = await handler.getConfigFileContent(github, owner, '.github', path);
  }
  return sloRules;
};

handler.getConfigFileContent = async function getConfigFileContent(
  github: GitHubAPI,
  owner: string,
  repo: string,
  path: string
): Promise<string | undefined> {
  try {
    const fileResponse = await github.repos.getContents({
      owner,
      repo,
      path,
    });

    const data = fileResponse.data as {content?: string};
    const content = JSON.parse(
      Buffer.from(data.content as string, 'base64').toString('utf8')
    );
    return content;
  } catch {
    return;
  }
};

export = handler;
