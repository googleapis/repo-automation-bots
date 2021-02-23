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

import {ProbotOctokit} from 'probot';
import {join} from 'path';
import yaml from 'js-yaml';
import Ajv from 'ajv';
const ajv = new Ajv();

const CONFIGURATION_FILE_PATH = 'auto-approve.yml';

interface File {
  content: string | undefined;
}

interface ErrorMessage {
  wrongProperty: Record<string, any>;
  message: string | undefined;
}
const schema = require(join(
  __dirname,
  '../',
  '../',
  'src',
  'valid-pr-schema.json'
));

function isFile(file: File | unknown): file is File {
  return (file as File).content !== undefined;
}

export function validateYaml(configYaml: string): Boolean {
  try {
    const isYaml = yaml.load(configYaml);
    if (typeof isYaml === 'object') {
      return true;
    } else {
      return false;
    }
  } catch (err) {
    return false;
  }
}

export async function validateSchema(
  configYaml: string | undefined | null | number | object
): Promise<ErrorMessage[] | Boolean | undefined> {
  const validateSchema = await ajv.compile(schema);
  const isValid = await validateSchema(configYaml);
  const errorText = (await validateSchema).errors?.map(x => {
    return {wrongProperty: x.params, message: x.message};
  });
  return isValid ? isValid : errorText;
}

export async function checkCodeOwners(
  octokit: InstanceType<typeof ProbotOctokit>,
  owner: string,
  repo: string,
  codeOwnersPRFile: string | undefined
): Promise<Boolean | string> {
  let codeOwnersFile;
  const createCodeownersMessage = `You must create a CODEOWNERS file for the configuration file for auto-approve.yml that lives in .github/CODEWONERS in your repository, and contains this line: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/; please make sure it is accessible publicly.`;
  const addToExistingCodeownersMessage = `You must add this line to to the CODEOWNERS file for auto-approve.yml to your current pull request: .github/${CONFIGURATION_FILE_PATH}  @googleapis/github-automation/`;
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
      return createCodeownersMessage;
    } else {
      throw err;
    }
  }
  
  if (codeOwnersFile && isFile(codeOwnersFile)) {
    const file = Buffer.from(codeOwnersFile.content, 'base64').toString('utf8');
    if (
      file.match(
        /(\n|^)\.github\/auto-approve\.yml(\s*)@googleapis\/github-automation(\s*)/gm
      )
    ) {
      return true;
    } else {
      if (
        codeOwnersPRFile?.match(
          /(\n|^)\.github\/auto-approve\.yml(\s*)@googleapis\/github-automation(\s*)/gm
        )
      ) {
        return true;
      } else {
        return addToExistingCodeownersMessage;
      }
    }
    // GH forces us to check if the content is a file, so we need to add this else block.
    // but, it should never really be reached.
  } else {
    return createCodeownersMessage;
  }
}
