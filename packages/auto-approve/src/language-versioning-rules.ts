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

export const languageVersioningRules = [
  {
    prAuthor: 'release-please[bot]',
    process: 'release',
    targetFile: 'package.json',
    // This would match: -  "version": "2.3.0"
    oldVersion: '-[\\s]*"(@?\\S*)":[\\s]"([0-9]*)*\\.([0-9]*\\.[0-9]*)",',
    // This would match: +  "version": "2.3.0"
    newVersion: '\\+[\\s]*"(@?\\S*)":[\\s]"([0-9]*)*\\.([0-9]*\\.[0-9]*)",',
  },
  {
    prAuthor: 'renovate-bot',
    process: 'dependency',
    targetFile: 'package.json',
    dependency:
      '^(fix\\(deps\\)|chore\\(deps\\)): update dependency (@?\\S*) to v(\\S*)$',
    // This would match: -  "version": "^2.3.0"
    oldVersion: '-[\\s]*"(@?\\S*)":[\\s]"([\\^0-9]*)*\\.([0-9]*\\.[0-9]*)",',
    // This would match: +  "version": "^2.3.0"
    newVersion: '\\+[\\s]*"(@?\\S*)":[\\s]"([\\^0-9]*)*\\.([0-9]*\\.[0-9]*)",',
  },
  {
    prAuthor: 'renovate-bot',
    process: 'dependency',
    targetFile: 'samples/package.json',
    dependency:
      '^(fix\\(deps\\)|chore\\(deps\\)): update dependency (@?\\S*) to v(\\S*)$',
    // This would match: -  "version": "^2.3.0"
    oldVersion: '-[\\s]*"(@?\\S*)":[\\s]"([\\^0-9]*)*\\.([0-9]*\\.[0-9]*)",',
    // This would match: +  "version": "^2.3.0"
    newVersion: '\\+[\\s]*"(@?\\S*)":[\\s]"([\\^0-9]*)*\\.([0-9]*\\.[0-9]*)",',
  },
];
