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
import Ajv, {ErrorObject} from 'ajv';

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

//const sloRules = require('./../../../../.github/issue_slo_rules');

interface ValidationResults {
  isValid: boolean;
  errors?: ErrorObject[] | null;
}

interface PullsListFilesResponseItem {
  filename: string;
  sha: string;
}

interface IssueLabelResponse {
  name: string;
}

enum Priority {
  'P0',
  'P1',
  'P2',
  'P3',
  'P4',
  'P5',
}

interface SLORules {
  appliesTo: {
    gitHubLabels?: string | string[];
    excludedGitHubLabels?: string | string[];
    priority?: Priority;
    issueType?: string;
    issues: boolean;
    prs: boolean;
  };
  complianceSettings: {
    responseTime: string | number;
    resolutionTime: string | number; //Will add responders
  };
}

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

      const fileList = await handler.listFiles(
        context.github,
        owner,
        repo,
        pull_number,
        100
      );

      if (fileList === null) {
        return;
      }

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
      const labelsResponse = context.payload.issue.labels;

      const labels: string[] = [];
      labelsResponse.forEach((label: IssueLabelResponse) =>
        labels.push(label.name.toLowerCase())
      );

      const sloString = await handler.getSloFile(context.github, owner, repo);
      await handler.handle_issues(sloString, labels);
    }
  );
}

// Checking to see if issue applies to any slo in list then checking compiliancy
handler.handle_issues = async function handle_issues(
  sloString: string,
  labels: string[] | null
) {
  const sloList = JSON.parse(sloString);

  for (const slo of sloList) {
    let appliesTo: boolean = Object.keys(slo.appliesTo).length === 0;
    if (!appliesTo) {
      appliesTo = await handler.appliesTo(slo, labels);
    }
    //If applies To then check compliance settings
  }
};

// Lints issue_slo_rules.json file and creates a check on PR. If file is invalid it will comment on PR
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

  if (sloString === null) {
    return;
  }

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
};

handler.getFileContents = async function getFileContents(
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

handler.listFiles = async function listFiles(
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
    console.warn(
      `Error creating comment in repo: ${repo} for issue number: ${issue_number}. error status: ${err.status}`
    );
    return;
  }
};

handler.createCheck = async function createCheck(
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

//Checking if slo applies to a given issue
handler.appliesTo = async function appliesTo(
  slo: SLORules,
  issueLabels: string[] | null
): Promise<boolean> {
  if (issueLabels === null || issueLabels.length === 0) {
    return false;
  }

  const githubLabels = slo.appliesTo.gitHubLabels;
  const validGithubLabels = await handler.validGithubLabels(
    issueLabels,
    githubLabels
  );
  if (!validGithubLabels) {
    return false;
  }

  const excludedGitHubLabels = slo.appliesTo.excludedGitHubLabels;
  const validExcludeLabels = await handler.validExcludedLabels(
    issueLabels,
    excludedGitHubLabels
  );
  if (!validExcludeLabels) {
    return false;
  }

  const priority = String(slo.appliesTo.priority);
  const validPriority = await handler.isValid(
    issueLabels,
    priority,
    'priority: '
  );
  if (!validPriority) {
    return false;
  }

  const issueType = slo.appliesTo.issueType;
  const validIssueType = await handler.isValid(
    issueLabels,
    issueType,
    'type: '
  );
  if (!validIssueType) {
    return false;
  }

  return true;
};

handler.validGithubLabels = async function validGithubLabels(
  issueLabels: string[],
  githubLabels: string | string[] | undefined
): Promise<boolean> {
  if (!githubLabels) {
    return true;
  }

  githubLabels = await handler.convertToArray(githubLabels);
  const isSubSet = githubLabels.every((label: string) =>
    issueLabels.includes(label)
  );
  if (!isSubSet) {
    return false;
  }
  return true;
};

handler.validExcludedLabels = async function validExcludedLabels(
  issueLabels: string[],
  excludedGitHubLabels: string | string[] | undefined
): Promise<boolean> {
  if (!excludedGitHubLabels) {
    return true;
  }

  excludedGitHubLabels = await handler.convertToArray(excludedGitHubLabels);
  const isElementExist = excludedGitHubLabels.some((label: string) =>
    issueLabels.includes(label)
  );
  if (isElementExist) {
    return false;
  }
  return true;
};

handler.isValid = async function isValid(
  issueLabels: string[],
  rule: string | undefined,
  title: string
) {
  if (!rule) {
    return true;
  }

  rule = rule.toLowerCase();
  const includes =
    issueLabels.includes(rule) || issueLabels.includes(title + rule);
  if (!includes) {
    return false;
  }
  return true;
};

handler.convertToArray = async function convertToArray(
  variable: string[] | string
): Promise<string[]> {
  if (typeof variable === 'string') {
    return [variable.toLowerCase()];
  }

  variable.forEach((label: string) => label.toLowerCase());
  return variable;
};

// If the repo level config file does not exists defaults to org config file
handler.getSloFile = async function getSloFile(
  github: GitHubAPI,
  owner: string,
  repo: string
): Promise<string> {
  let path = '.github/issue_slo_rules.json';
  let sloRules: string = await handler.getConfigFileContent(
    github,
    owner,
    repo,
    path
  );
  if (sloRules === 'not found') {
    path = 'issue_slo_rules.json';
    sloRules = await handler.getConfigFileContent(
      github,
      owner,
      '.github',
      path
    );
  }
  return sloRules;
};

handler.getConfigFileContent = async function getConfigFileContent(
  github: GitHubAPI,
  owner: string,
  repo: string,
  path: string
): Promise<string> {
  try {
    const fileResponse = await github.repos.getContents({
      owner,
      repo,
      path,
    });
    const data = fileResponse.data as {content?: string};
    const content = Buffer.from(data.content as string, 'base64').toString(
      'utf8'
    );

    return content;
  } catch (err) {
    if (repo === '.github') {
      //Error if org level does not exist
      throw `Error in finding org level config file in ${owner} \n ${err}`;
    }
    return 'not found';
  }
};

//Method will be used for cloud scheduler
handler.getListOfIssueLabels = async function getListOfIssueLabels(
  github: GitHubAPI,
  owner: string,
  repo: string,
  issue_number: number
): Promise<string[] | null> {
  try {
    const labelsResponse = await github.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number,
    });

    const labels: string[] = [];
    labelsResponse.data.forEach(label => labels.push(label.name.toLowerCase()));
    return labels;
  } catch (err) {
    console.error(`Error in retrieving issue labels in repo ${repo} \n ${err}`);
    return null;
  }
};

export = handler;
