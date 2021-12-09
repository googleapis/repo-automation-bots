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
import { FileIterator } from './file-iterator';
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
  static validate(path: string, repoMetadataContent: string) {
    const ajv = new Ajv();
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

    // Perform complex validation, e.g., checking URLs.

    // TODO: is there a way we could cross-reference this value with
    // service.yml for a given API.
    if (
      !repoMetadata.api_shortname &&
      API_LIBRARY_TYPES.includes(repoMetadata.library_type)
    ) {
      result.status = 'error';
      result.errors.push(`api_shortname field missing from ${path}`);
    }

    return result;
  }
  static async validApiShortNames(octokit: OctokitType) {
    const iterator = new FileIterator(
      GOOGLEAPIS_OWNER,
      GOOGLEAPIS_REPO,
      octokit
    );
    const apiIndexRaw = await iterator.getFile('api-index-v1.json');
    const apiIndex = JSON.parse(apiIndexRaw) as {
      apis: Array<{hostName: string}>
    };
    const apiShortNames = new Set<string>()
    for (const api of apiIndex.apis) {
      const match = api.hostName.match(/(?<service>[^.]+)/);
      if (match && match.groups) {
        apiShortNames.add(match.groups.service)
      } 
    }
    const apis = Array.from(apiShortNames).sort();
    console.info(apis.length);
    console.info(JSON.stringify(apis, null, 2));
  }
}
