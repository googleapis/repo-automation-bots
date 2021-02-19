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

import {Probot} from 'probot';
import {logger} from 'gcf-utils';
import {join} from 'path';
import yaml from 'js-yaml';
import Ajv from 'ajv';
const ajv = new Ajv();

interface ErrorMessage {
    wrongProperty: Record<string, any>,
    message: string | undefined
}
const schema = require(join(
  __dirname,
  '../',
  '../',
  'src',
  'valid-pr-schema.json'
));

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
  const errorText = (await validateSchema).errors?.map(x => {return {"wrongProperty": x.params, "message": x.message}})
  console.log(errorText);
  return (isValid ? isValid : errorText);
}
