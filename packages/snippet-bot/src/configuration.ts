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

import Ajv from 'ajv';
import yaml from 'js-yaml';
import * as minimatch from 'minimatch';
import schema from './config-schema.json';

// configure the schema validator once
const ajv = new Ajv();
const validateSchema = ajv.compile(schema);

export interface ConfigurationOptions {
  ignoreFiles: string[];
  alwaysCreateStatusCheck: boolean;
}

export const DEFAULT_CONFIGURATION: ConfigurationOptions = {
  ignoreFiles: [],
  alwaysCreateStatusCheck: false,
};

export const CONFIGURATION_FILE_PATH = 'snippet-bot.yml';

export class Configuration {
  private options: ConfigurationOptions;
  private minimatches: minimatch.IMinimatch[];

  constructor(options: ConfigurationOptions) {
    this.options = options;
    this.minimatches = options.ignoreFiles.map(pattern => {
      return new minimatch.Minimatch(pattern);
    });
  }

  ignoredFile(filename: string): boolean {
    return this.minimatches.some(mm => {
      return mm.match(filename);
    });
  }
  alwaysCreateStatusCheck(): boolean {
    return this.options.alwaysCreateStatusCheck;
  }
}

/**
 * Given a config in its raw yaml form, validate that it matches our config
 * schema.  Return any validation errors from ajv.
 * @param configYaml Raw text containing the YAML to validate.
 * @returns
 */
export async function validateConfiguration(configYaml: string) {
  const config = yaml.load(configYaml) as ConfigurationOptions;
  let isValid = false;
  let errorText: string | undefined;
  if (typeof config === 'object') {
    isValid = await validateSchema(config);
    if (!isValid) {
      errorText = JSON.stringify(validateSchema.errors, null, 4);
    }
  } else {
    errorText = `.github/${CONFIGURATION_FILE_PATH} is not valid YAML 😱`;
  }
  return {isValid, errorText};
}
