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
import {Octokit} from '@octokit/rest';
import {RepositoryFileCache} from '@google-automations/git-file-utils';
import * as StoreMetadata from './store-metadata';

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

// Manually curated list of allowed api_shortname entries
const EXTRA_ALLOWED_API_SHORTNAMES = [
  'bigquery', // handwritten client that has no protos
  'runtimeconfig', // handwritten client that has no protos
];

interface ApiIndex {
  apis: {hostName: string}[];
}

const GOOGLEAPIS_OWNER = 'googleapis';
const GOOGLEAPIS_REPO = 'googleapis';
const GOOGLEAPIS_DEFAULT_BRANCH = 'master';

// Apply validation logic to .repo-metadata.json.
export class Validate {
  octokit: Octokit;
  cachedApiIndex?: ApiIndex;
  constructor(octokit: Octokit) {
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

    // On success, store an entry in a metadata table. This data is
    // used to answer questions such as API coverage:
    if (result.status === 'success') {
      await StoreMetadata.storeMetadata({
        release_level: repoMetadata.release_level,
        language: repoMetadata.language,
        repository: repoMetadata.repository,
        api_service: `${repoMetadata.api_shortname}.googleapis.com`,
      });
    }

    return result;
  }
  // Returns list of valid API names, based on api-index-v1.json file
  // generated by running https://github.com/googleapis/googleapis-api-index-generator
  // on googleapis/googleapis:
  async validApiShortNames() {
    const apiIndex = await this.getApiIndex();
    const apiShortNames = new Set<string>(EXTRA_ALLOWED_API_SHORTNAMES);
    for (const api of apiIndex.apis) {
      const match = api.hostName.match(/(?<service>[^.]+)/);
      if (match && match.groups) {
        apiShortNames.add(match.groups.service);
      }
    }
    return apiShortNames;
  }

  async getApiIndex(): Promise<ApiIndex> {
    if (!this.cachedApiIndex) {
      const fileCache = new RepositoryFileCache(this.octokit, {
        owner: GOOGLEAPIS_OWNER,
        repo: GOOGLEAPIS_REPO,
      });
      const contents = await fileCache.getFileContents(
        'api-index-v1.json',
        GOOGLEAPIS_DEFAULT_BRANCH
      );
      this.cachedApiIndex = JSON.parse(contents.parsedContent) as ApiIndex;
    }
    return this.cachedApiIndex;
  }
}
