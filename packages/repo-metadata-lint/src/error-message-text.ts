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

import {ValidationResult} from './validate';

const START_GENERATED = 'Result of scan';
const STOP_GENERATED = 'address these problems';
const SCHEMA_URL =
  'https://github.com/googleapis/repo-automation-bots/blob/main/packages/repo-metadata-lint/src/repo-metadata-schema.json';
const APIS_INDEX =
  'https://github.com/googleapis/googleapis/blob/master/api-index-v1.json';

// Helper class to generate and compare error messages based
// on an array of validation errors, potentially across multiple
// .repo-metadata.json files.
export class ErrorMessageText {
  // Generate content for nightly issues on GitHub:
  static forIssueBody(results: ValidationResult[]) {
    let body = `You have a problem with your .repo-metadata.json file${
      results.length > 1 ? 's' : ''
    }:

${START_GENERATED} 📈:

`;
    body += ErrorMessageText.resultsErrors(results);
    body += `\n\n ☝️ Once you ${STOP_GENERATED}, you can close this issue.\n\n`;
    body += '### Need help?';
    body += `\n* [Schema definition](${SCHEMA_URL}): lists valid options for each field.\n* [API index](${APIS_INDEX}): for gRPC libraries **api_shortname** should match the subdomain of an API's **hostName**.`;
    body +=
      '\n* Reach out to **go/github-automation** if you have any questions.';
    return body;
  }
  // Internal helper for the "results of scan" section of issue or
  // failing check:
  private static resultsErrors(results: ValidationResult[]) {
    let body = '';
    for (const result of results) {
      for (const error of result.errors) {
        body += `* ${error}\n`;
      }
      body += '\n';
    }
    return body.trim();
  }
  // Compare an issue that would be opened with existing open issue:
  static eql(issueBody: string, results: ValidationResult[]): boolean {
    const resultsErrors = ErrorMessageText.resultsErrors(results);
    const issueErrors = [];
    let collecting = false;
    // Parse the error output stored in issue:
    for (const line of issueBody.split(/\r?\n/)) {
      if (line.includes(START_GENERATED) && !collecting) {
        collecting = true;
        continue;
      }
      if (line.includes(STOP_GENERATED)) {
        break;
      }
      if (collecting) issueErrors.push(line);
    }
    return resultsErrors.trim() === issueErrors.join('\n').trim();
  }
}
