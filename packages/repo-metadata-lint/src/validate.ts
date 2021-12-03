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

interface Result {
  status: 'success' | 'error';
  errors: Array<string>;
}

const LIBRARY_TYPES = [
  'GAPIC_AUTO',
  'GAPIC_MANUAL',
  'AGENT',
  'MISC',
  'AUTH',
  'various',
  'REST',
];
// Types of libraries that should include api_shortname in .repo-metadata.json.
const API_LIBRARY_TYPES = ['GAPIC_AUTO', 'GAPIC_MANUAL', 'AGENT'];
const RELEASE_LEVELS = ['preview', 'stable'];

// Apply validation logic to .repo-metadata.json.
export class Validate {
  static validate(path: string, repoMetadataContent: string) {
    const result: Result = {status: 'success', errors: []};
    try {
      JSON.parse(repoMetadataContent);
    } catch (err) {
      result.status = 'error';
      result.errors.push(`could not parse ${path}`);
      return result;
    }
    const repoMetadata = JSON.parse(repoMetadataContent);

    if (!repoMetadata.library_type) {
      result.status = 'error';
      result.errors.push(`library_type field missing from ${path}`);
    } else if (!LIBRARY_TYPES.includes(repoMetadata.library_type)) {
      result.status = 'error';
      result.errors.push(
        `invalid library_type ${repoMetadata.library_type} in ${path}`
      );
    }

    // TODO: is there a way we could cross-reference this value with
    // service.yml for a given API.
    if (
      !repoMetadata.api_shortname &&
      API_LIBRARY_TYPES.includes(repoMetadata.library_type)
    ) {
      result.status = 'error';
      result.errors.push(`api_shortname field missing from ${path}`);
    }

    if (!repoMetadata.release_level) {
      result.status = 'error';
      result.errors.push(`release_level field missing from ${path}`);
    } else if (!RELEASE_LEVELS.includes(repoMetadata.release_level)) {
      result.status = 'error';
      result.errors.push(
        `invalid release_level ${repoMetadata.release_level} in ${path}`
      );
    }

    return result;
  }
}
