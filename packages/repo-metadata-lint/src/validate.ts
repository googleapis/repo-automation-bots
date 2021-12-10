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
//

import Ajv from 'ajv';
import schema from './repo-metadata-schema.json';
import * as fileIterator from './file-iterator';
import {OctokitType} from './utils/octokit-util';

export interface ValidationResult {
  status: 'success' | 'error';
  errors: Array<string>;
}

// Types of libraries that should include api_shortname in .repo-metadata.json.
const API_LIBRARY_TYPES = [
  'GAPIC_AUTO',
  'GAPIC_MANUAL',
  'AGENT',
  'GAPIC_COMBO',
];

const GOOGLEAPIS_OWNER = 'googleapis';
const GOOGLEAPIS_REPO = 'googleapis';

// Apply validation logic to .repo-metadata.json.
export class Validate {
  octokit: OctokitType;
  constructor(octokit: OctokitType) {
    this.octokit = octokit;
  }
  async validate(path: string, repoMetadataContent: string) {
    const ajv = new Ajv({
      allErrors: true,
    });
    const validate = ajv.compile(schema);
    const result: ValidationResult = {status: 'success', errors: []};

    // Parse JSON content.
    try {
      JSON.parse(repoMetadataContent);
    } catch (err) {
      result.status = 'error';
      result.errors.push(`could not parse ${path}`);
      return result;
    }
    const repoMetadata = JSON.parse(repoMetadataContent);

    // Perform simple validation using JSON schema.
    const valid = validate(repoMetadata);
    if (valid === false) {
      result.status = 'error';
      for (const error of validate.errors || []) {
        result.errors.push(
          `${
            error.instancePath
              ? error.instancePath.replace(/^\/(.*)/, '$1 ')
              : ''
          }${error.message} in ${path}`
        );
      }
    }

    // Conditionally validate api_shortname for GAPIC libraries:
    if (API_LIBRARY_TYPES.includes(repoMetadata.library_type)) {
      if (!repoMetadata.api_shortname) {
        result.status = 'error';
        result.errors.push(`api_shortname field missing from ${path}`);
      } else {
        const apiShortNames = await this.validApiShortNames();
        if (!apiShortNames.has(repoMetadata.api_shortname)) {
          result.status = 'error';
          result.errors.push(
            `api_shortname '${repoMetadata.api_shortname}' invalid in ${path}`
          );
        }
      }
    }

    return result;
  }
  async validApiShortNames() {
    const iterator = new fileIterator.FileIterator(
      GOOGLEAPIS_OWNER,
      GOOGLEAPIS_REPO,
      this.octokit
    );
    const apiIndexRaw = await iterator.getFile('api-index-v1.json');
    const apiIndex = JSON.parse(apiIndexRaw) as {
      apis: Array<{hostName: string}>;
    };
    const apiShortNames = new Set<string>();
    for (const api of apiIndex.apis) {
      const match = api.hostName.match(/(?<service>[^.]+)/);
      if (match && match.groups) {
        apiShortNames.add(match.groups.service);
      }
    }
    return apiShortNames;
  }
}
