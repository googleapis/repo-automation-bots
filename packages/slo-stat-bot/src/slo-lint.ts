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

// eslint-disable-next-line node/no-extraneous-import
import {ProbotOctokit, Context} from 'probot';
import Ajv, {ErrorObject} from 'ajv';
import addFormats from 'ajv-formats';
import {logger} from 'gcf-utils';
import {convertToArray} from './slo-appliesTo';
import {SLORules} from './types';

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
  errors?: ErrorObject[] | ErrorMessage | undefined;
}

interface PullsListFilesResponseItem {
  filename: string;
  sha: string;
}

interface ErrorMessage {
  [index: string]: string;
}

/**
 * Function gets list of files changed on the pr
 * @param github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param number of issue or pr
 * @param perPage number of files that is listed per API call
 * @returns an array of PullsListFilesResponseItem containing the filename and sha
 */
async function listFiles(
  github: InstanceType<typeof ProbotOctokit>,
  owner: string,
  repo: string,
  number: number,
  per_page: number
): Promise<PullsListFilesResponseItem[] | null> {
  try {
    const listOfFiles = await github.pulls.listFiles({
      owner,
      repo,
      pull_number: number,
      per_page,
    });
    return listOfFiles.data;
  } catch (err) {
    logger.warn(
      `Error getting list of files in repo: ${repo} for issue number: ${number}. error status:${err.status}`
    );
    return null;
  }
}

/**
 * Function lints issue_slo_rules.json file and creates a check on PR. If file is invalid it will comment on PR
 * @param context of issue or pr
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param number of issue or pr
 * @param fileSha number of files that is listed per API call
 * @returns void
 */
export const handleSlos = async function handleSlos(
  context: Context,
  owner: string,
  repo: string,
  number: number,
  fileSha: string
) {
  const sloString = await getFileShaContents(
    context.octokit,
    owner,
    repo,
    fileSha
  );

  if (!sloString) {
    return;
  }

  const sloData = JSON.parse(sloString);
  const res = await lint(schema, sloData);

  await commentPR(context.octokit, owner, repo, number, res.isValid);
  await createCheck(context, res);
};

/**
 * Function gets file sha of issue_slo_rules.json and its content
 * @param github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param fileSha number of files that is listed per API call
 * @returns json string of the slo rules content
 */
async function getFileShaContents(
  github: InstanceType<typeof ProbotOctokit>,
  owner: string,
  repo: string,
  fileSha: string
): Promise<string | null> {
  try {
    const blob = await github.git.getBlob({
      owner,
      repo,
      file_sha: fileSha,
    });
    const fileContent = Buffer.from(blob.data.content, 'base64').toString(
      'utf8'
    );
    return fileContent;
  } catch (err) {
    logger.warn(
      `Error getting file content in repo:${repo}. error status:${err.status}`
    );
    return null;
  }
}

/**
 * Function lints the issue_slo_rules.json against the slo schema
 * @param schema of slo rules from data folder
 * @param sloData object of slo rules
 * @returns validation results object that contains a boolean value if its valid or not and an error object if it is invalid
 */
export const lint = async function lint(
  schema: JSON,
  sloData: SLORules[]
): Promise<ValidationResults> {
  const ajv = new Ajv();
  addFormats(ajv);
  const validate = ajv.compile(schema);
  let isValid = await validate(sloData);

  if (validate.errors) {
    return {
      isValid: isValid,
      errors: validate.errors,
    } as ValidationResults;
  }

  //Check for contradicting SLOs
  let errors: ErrorMessage | undefined;
  for (const slo of sloData) {
    isValid = !(await sloContradicts(slo));

    if (!isValid) {
      const sloString = JSON.stringify(slo);
      errors = {
        message: `Same label is in both gitHubLabels and excludedGitHubLabels for slo:  ${sloString}`,
      };
      break;
    }
  }

  return {
    isValid: isValid,
    errors: errors,
  } as ValidationResults;
};

/**
 * Function checks to see if there is a label in both gitHubLabels and excludedGitHubLabels
 * @param slo rule
 * @returns boolean value if slo is self contradicting
 */
async function sloContradicts(slo: SLORules): Promise<boolean | undefined> {
  const githubLabels = convertToArray(slo.appliesTo.gitHubLabels);
  const excludedGitHubLabels = convertToArray(
    slo.appliesTo.excludedGitHubLabels
  );

  const isInValid = excludedGitHubLabels?.some(label =>
    githubLabels?.includes(label)
  );

  return isInValid;
}

/**
 * Function comments on PR only if issue_slo_rules.json is invalid
 * @param github unique installation id for each function
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param number of issue or pr
 * @param isValid determines if slo rules are valid or invalid with the schema
 * @returns void
 */
async function commentPR(
  github: InstanceType<typeof ProbotOctokit>,
  owner: string,
  repo: string,
  number: number,
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
      issue_number: number,
      body,
    });
  } catch (err) {
    logger.warn(
      `Error creating comment in repo: ${repo} for issue number: ${number}. error status: ${err.status}`
    );
    return;
  }
}

/**
 * Function creates a success or failure check on pr based on validation results
 * @param context of issue or pr
 * @param validationRes validation results object that contains a boolean value if its valid or not and an error object if it is invalid
 * @returns void
 */
async function createCheck(context: Context, validationRes: ValidationResults) {
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
    await context.octokit.checks.create(checkParams);
  } catch (err) {
    logger.error(
      `Error creating check in repo ${context.payload.repository.name} \n ${err.message}`
    );
    return;
  }
}

/**
 * Function checks for existence of changed issue_slo_rules.json file either on repo or org level.
 * If it exists, then it handles logic for linting, creating check, and commenting on failed PRs
 * @param context of issue or pr
 * @param owner of issue or pr
 * @param repo of issue or pr
 * @param number of issue or pr
 * @returns void
 */
export async function handleLint(
  context: Context,
  owner: string,
  repo: string,
  number: number
) {
  const fileList = await listFiles(context.octokit, owner, repo, number, 100);

  if (!fileList) {
    return;
  }

  for (const file of fileList) {
    if (
      file.filename === '.github/issue_slo_rules.json' ||
      (repo === '.github' && file.filename === 'issue_slo_rules.json')
    ) {
      await handleSlos(context, owner, repo, number, file.sha);
      break;
    }
  }
}
