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
    oldVersion: new RegExp(
      /-[\s]*"(@?\S*)":[\s]"([0-9]*)*\.([0-9]*\.[0-9]*)",/
    ),
    // This would match: +  "version": "2.3.0"
    newVersion: new RegExp(
      /\+[\s]*"(@?\S*)":[\s]"([0-9]*)*\.([0-9]*\.[0-9]*)",/
    ),
  },
  {
    prAuthor: 'renovate-bot',
    process: 'dependency',
    targetFile: 'package.json',
    dependency: /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
    // This would match: -  "version": "^2.3.0" or -  "version": "~2.3.0"
    oldVersion: new RegExp(
      /-[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)",/
    ),
    // This would match: +  "version": "^2.3.0" or +  "version": "~2.3.0"
    newVersion: new RegExp(
      /\+[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)"/
    ),
  },
  {
    prAuthor: 'renovate-bot',
    process: 'dependency',
    targetFile: 'samples/package.json',
    // This would match: fix(deps): update dependency @octokit to v1
    dependency: new RegExp(
      /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/
    ),
    // This would match: -  "version": "^2.3.0" or -  "version": "~2.3.0"
    oldVersion: new RegExp(
      /-[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)",/
    ),
    // This would match: +  "version": "^2.3.0" or +  "version": "~2.3.0"
    newVersion: new RegExp(
      /\+[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)"/
    ),
  },
  {
    prAuthor: 'renovate-bot',
    process: 'dependency',
    targetFile: 'samples/snippets/requirements.txt',
    // This would match: fix(deps): update dependency @octokit to v1
    dependency: new RegExp(
      /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/
    ),
    // This would match: -  google-cloud-storage==1.39.0
    oldVersion: new RegExp(/-[\s]?(@?[^=]*)==([0-9])*\.([0-9]*\.[0-9]*)/),
    // This would match: +  google-cloud-storage==1.40.0
    newVersion: new RegExp(/\+[\s]?(@?[^=]*)==([0-9])*\.([0-9]*\.[0-9]*)/),
  },
  {
    prAuthor: 'renovate-bot',
    process: 'java-dependency',
    targetFile: 'pom.xml',
    // This would match: chore(deps): update dependency com.google.cloud:google-cloud-datacatalog to v1.4.2 or chore(deps): update dependency com.google.apis:google-api-services-policytroubleshooter to v1-rev20210319-1.32.1
    dependency: new RegExp(
      /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/
    ),
    /* This would match:
      <groupId>com.google.apis</groupId>
      <artifactId>google-api-services-policytroubleshooter</artifactId>
      -      <version>v1-rev20210319-1.31.5</version>
      or
      <groupId>com.google.apis</groupId>
      <artifactId>google-api-services-policytroubleshooter</artifactId>
-     <version>v1-rev20210319-1.31.5</version>
    */
    oldVersion: new RegExp(
      /<groupId>([^<]*)<\/groupId>[\s]*<artifactId>([^<]*)<\/artifactId>[\s]*-[\s]*<version>(v[0-9]-rev[0-9]*-([0-9]*)\.([0-9]*\.[0-9])|([0-9]*)\.([0-9]*\.[0-9]*))<\/version>[\s]*/
    ),
    /* This would match:
      <groupId>com.google.cloud</groupId>
      <artifactId>google-cloud-datacatalog</artifactId>
-     <version>1.4.1</version>
+     <version>1.4.2</version>
      or
       <groupId>com.google.apis</groupId>
       <artifactId>google-api-services-policytroubleshooter</artifactId>
-      <version>v1-rev20210319-1.31.5</version>
+      <version>v1-rev20210319-1.32.1</version>
    */
    newVersion: new RegExp(
      /<groupId>([^<]*)<\/groupId>[\s]*<artifactId>([^<]*)<\/artifactId>[\s]*-[\s]*<version>(v[0-9]-rev[0-9]*-[0-9]*\.[0-9]*\.[0-9]|[[0-9]*\.[0-9]*\.[0-9]*)<\/version>[\s]*\+[\s]*<version>(v[0-9]-rev[0-9]*-([0-9]*)\.([0-9]*\.[0-9])|([0-9]*)\.([0-9]*\.[0-9]*))<\/version>/
    ),
  },
];
