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
  status: 'success' | 'warn' | 'error';
  errors: Array<string>;
}

// Apply validation logic to .repo-metadata.json.
export class Validate {
  static validate(path: string, repoMetadataContent: string) {
    const result: Result = {status: 'success', errors: []};
    try {
      JSON.parse(repoMetadataContent);
    } catch (err) {
      result.status = 'error';
      result.errors.push(`could not parse ${path}`);
    }
    return result;
  }
}
