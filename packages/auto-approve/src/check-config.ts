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

import yaml from 'js-yaml';
import Ajv from 'ajv';
import {Octokit} from '@octokit/rest';
import {Configuration, GHFile, ConfigurationV2} from './interfaces';
// eslint-disable-next-line node/no-extraneous-import
import {RequestError} from '@octokit/request-error';

const ajv = new Ajv();

const CONFIGURATION_FILE_PATH = 'auto-approve.yml';

import schema from './valid-pr-schema.json';
import schemaV2 from './valid-pr-schema-v2.json';

function isFile(file: GHFile | unknown): file is GHFile {
  return (file as GHFile).content !== undefined;
}

function isConfigV2(
  config: ConfigurationV2 | Configuration | unknown
): config is ConfigurationV2 {
  return (<ConfigurationV2>config).processes !== undefined;
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
): Promise<string> {
  const parsedYaml =
    typeof configYaml === 'string' ? yaml.load(configYaml) : configYaml;
  let validateSchema;
  if (
    typeof parsedYaml === 'object' &&
    parsedYaml !== null &&
    isConfigV2(parsedYaml as unknown)
  ) {
    validateSchema = await ajv.compile(schemaV2);
  } else {
    validateSchema = await ajv.compile(schema);
  }
  await validateSchema(parsedYaml);
  const errorText = (await validateSchema).errors?.map(x => {
    return {wrongProperty: x.params, message: x.message};
  });
  return JSON.stringify(errorText) ?? '';
}

/**
 * Checks the location of auto-approve, whether it's on the PR or branch, and performs checks if it exists
 *
 * @param octokit Octokit instance to make calls to github API
 * @param owner of the repo of the incoming PR
 * @param repo of the incoming PR
 * @param autoApproveFile if the incoming PR includes an auto-approve file, that file; undefined if not
 * @returns empty string if valid, otherwise an error message.
 */
export async function checkAutoApproveConfig(
  octokit: Octokit,
  owner: string,
  repo: string,
  autoApproveFile: string | Configuration | undefined
): Promise<string> {
  let message = '';

  // If auto-approve is not in the PR, let's try to find it on main branch
  if (!autoApproveFile) {
    try {
      const autoApproveFileFromMain = (
        await octokit.repos.getContent({
          owner,
          repo,
          path: `.github/${CONFIGURATION_FILE_PATH}`,
        })
      ).data;

      // We have to check that it's a file, not a folder
      if (autoApproveFileFromMain && isFile(autoApproveFileFromMain)) {
        autoApproveFile = Buffer.from(
          autoApproveFileFromMain.content,
          'base64'
        ).toString('utf8');

        // Check if the YAML is formatted correctly
        message =
          typeof autoApproveFile === 'string'
            ? validateYaml(autoApproveFile)
            : '';

        // Check if config has correct schema
        message = await validateSchema(autoApproveFile);
      } else {
        // This branch means auto-approve is not on this repo, so we're
        // throwing an error (essentially, skipping the check)
        throw Error('Auto-Approve config does not exist on repo');
      }
    } catch (err) {
      // This branch means auto-approve is not on this repo, so we're
      // throwing an error (essentially, skipping the check)
      throw Error('Auto-Approve config does not exist on repo');
    }
  } else {
    // This means auto-approve is on the PR, meaning we still need to confirm validity
    // Check if the YAML is formatted correctly if it's in a PR
    message =
      typeof autoApproveFile === 'string' ? validateYaml(autoApproveFile) : '';

    // Check if config has correct schema
    message = await validateSchema(autoApproveFile);
  }

  return message;
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
  octokit: Octokit,
  owner: string,
  repo: string,
  codeOwnersPRFile: string | undefined
): Promise<string> {
  let codeOwnersFile;
  let message = '';
  const createCodeownersMessage = `You must create a CODEOWNERS file for the configuration file for auto-approve.yml that lives in .github/CODEWONERS in your repository, and contains this line: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/; please make sure it is accessible publicly.`;
  const addToExistingCodeownersMessage = `You must add this line to the CODEOWNERS file for auto-approve.yml to merge pull requests on this repo: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/`;

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
    } catch (e) {
      const err = e as RequestError;
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
