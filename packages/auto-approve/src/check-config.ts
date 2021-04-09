// Copyright 2021 Google LLC
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

// This file manages the logic to check whether a given config file is valid

// eslint-disable-next-line node/no-extraneous-import
import {ProbotOctokit} from 'probot';
import yaml from 'js-yaml';
import Ajv from 'ajv';
const ajv = new Ajv();

const CONFIGURATION_FILE_PATH = 'auto-approve.yml';

interface File {
  content: string | undefined;
}

export interface ErrorMessage {
  wrongProperty: Record<string, string>;
  message: string | undefined;
}

import schema from './valid-pr-schema.json';

function isFile(file: File | unknown): file is File {
  return (file as File).content !== undefined;
}

/**
 * Takes in the auto-approve.yml file and checks to see that it is formatted correctly
 *
 * @param configYaml the string of auto-approve.yml
 * @returns undefined if the yaml is valid, otherwise an error message.
 */
export function validateYaml(configYaml: string): string {
  let message = '';
  try {
    const isYaml = yaml.load(configYaml);
    if (!(typeof isYaml === 'object')) {
      message = 'File is not a YAML object';
    }
  } catch (err) {
    message = 'File is not properly configured YAML';
  }

  return message;
}

/**
 * Takes in the auto-approve.yml file and checks to see that the schema matches the valid-pr-schema.json rules
 *
 * @param configYaml the string of auto-approve.yml
 * @returns undefined if the yaml is valid, otherwise an error message.
 */
export async function validateSchema(
  configYaml: string | object
): Promise<ErrorMessage[] | undefined> {
  const parsedYaml =
    typeof configYaml === 'string' ? yaml.load(configYaml) : configYaml;
  const validateSchema = await ajv.compile(schema);
  await validateSchema(parsedYaml);
  const errorText = (await validateSchema).errors?.map(x => {
    return {wrongProperty: x.params, message: x.message};
  });
  return errorText;
}

/**
 * Confirms that the codeowners file contains a line that sets @googleapis/github/automation as codeowners for auto-approve.yml
 *
 * @param octokit Octokit instance to make calls to github API
 * @param owner of the repo of the incoming PR
 * @param repo of the incoming PR
 * @param codeOwnersPRFile if the incoming PR includes a codeowners file, that codeowners file; undefined if not
 * @returns undefined if the yaml is valid, otherwise an error message.
 */
export async function checkCodeOwners(
  octokit: InstanceType<typeof ProbotOctokit>,
  owner: string,
  repo: string,
  codeOwnersPRFile: string | undefined
): Promise<string> {
  let codeOwnersFile;
  let message = '';
  const createCodeownersMessage = `You must create a CODEOWNERS file for the configuration file for auto-approve.yml that lives in .github/CODEWONERS in your repository, and contains this line: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/; please make sure it is accessible publicly.`;
  const addToExistingCodeownersMessage = `You must add this line to to the CODEOWNERS file for auto-approve.yml to your current pull request: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/`;

  // If the CODEOWNERS file is being changed, make sure it includes the following regex. Otherwise, see if the
  // existing CODEOWNERS file has that regex. If the CODEOWNERS file is being changed and the blob does not
  // contain this regex, fail the check
  if (codeOwnersPRFile) {
    if (
      !codeOwnersPRFile?.match(
        /(\n|^)\.github\/auto-approve\.yml(\s*)@googleapis\/github-automation(\s*)/gm
      )
    ) {
      message = addToExistingCodeownersMessage;
    }
  } else {
    // see if CODEOWNERS file exists in the repository
    try {
      codeOwnersFile = (
        await octokit.repos.getContent({
          owner,
          repo,
          path: '.github/CODEOWNERS',
        })
      ).data;
    } catch (err) {
      if (err.status === 403 || err.status === 404) {
        message = createCodeownersMessage;
      } else {
        throw err;
      }
    }

    // if CODEOWNERS exists, make sure it is configured appropriately
    if (codeOwnersFile && isFile(codeOwnersFile)) {
      const file = Buffer.from(codeOwnersFile.content, 'base64').toString(
        'utf8'
      );
      if (
        !file.match(
          /(\n|^)\.github\/auto-approve\.yml(\s*)@googleapis\/github-automation(\s*)/gm
        )
      ) {
        message = addToExistingCodeownersMessage;
      }
    } else {
      // if CODEOWNERS doesn't exist, ask user to create it
      message = createCodeownersMessage;
    }
  }

  return message;
}
