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

import {JavaDependency} from '../src/process-checks/java/dependency';
import {describe, it} from 'mocha';
import assert from 'assert';

describe('behavior of UpdateDiscoveryArtifacts process', () => {
  it('should get constructed with the appropriate values', () => {
    const javaDependency = new JavaDependency(
      'testAuthor',
      'testTitle',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1
    );

    const expectation = {
      incomingPR: {
        author: 'testAuthor',
        title: 'testTitle',
        fileCount: 3,
        changedFiles: [{filename: 'hello', sha: '2345'}],
        repoName: 'testRepoName',
        repoOwner: 'testRepoOwner',
        prNumber: 1,
      },
      classRule: {
        author: 'renovate-bot',
        titleRegex:
          /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
        maxFiles: 50,
        fileNameRegex: [/pom.xml$/],
        fileRules: [
          {
            targetFileToCheck: /pom.xml$/,
            // This would match: chore(deps): update dependency com.google.cloud:google-cloud-datacatalog to v1.4.2 or chore(deps): update dependency com.google.apis:google-api-services-policytroubleshooter to v1-rev20210319-1.32.1
            dependencyTitle: new RegExp(
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
        ],
      },
    };

    assert.deepStrictEqual(javaDependency.incomingPR, expectation.incomingPR);
    assert.deepStrictEqual(javaDependency.classRule, expectation.classRule);
  });

  it('should return false in checkPR if incoming PR does not match classRules', () => {
    const javaDependency = new JavaDependency(
      'testAuthor',
      'testTitle',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1
    );

    assert.deepStrictEqual(javaDependency.checkPR(), false);
  });

  it('should return false in checkPR if one of the files did not match additional rules in fileRules', () => {
    const javaDependency = new JavaDependency(
      'renovate-bot',
      'fix(deps): update dependency cloud.google.com to v16',
      3,
      [
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'iam/api-client/pom.xml',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '@@ -71,7 +71,7 @@\n' +
            '     <dependency>\n' +
            '       <groupId>com.google.cloud</groupId>\n' +
            '       <artifactId>google-cloud-datacatalog</artifactId>\n' +
            '-      <version>v1-rev20210319-1.31.5</version>\n' +
            '+      <version>v1-rev20210319-1.32.1</version>\n' +
            '     </dependency>\n',
        },
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'maliciousFile',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '@@ -71,7 +71,7 @@\n' +
            '     <dependency>\n' +
            '       <groupId>com.google.cloud</groupId>\n' +
            '       <artifactId>google-cloud-datacatalog</artifactId>\n' +
            '-      <version>v1-rev20210319-1.31.5</version>\n' +
            '+      <version>v1-rev20210319-1.32.1</version>\n' +
            '     </dependency>\n',
        },
      ],
      'testRepoName',
      'testRepoOwner',
      1
    );

    assert.deepStrictEqual(javaDependency.checkPR(), false);
  });

  it('should return true in checkPR if incoming PR does match classRules', () => {
    const javaDependency = new JavaDependency(
      'renovate-bot',
      'fix(deps): update dependency com.google.cloud:google-cloud-datacatalog to v16',
      3,
      [
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'iam/api-client/pom.xml',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '@@ -71,7 +71,7 @@\n' +
            '     <dependency>\n' +
            '       <groupId>com.google.cloud</groupId>\n' +
            '       <artifactId>google-cloud-datacatalog</artifactId>\n' +
            '-      <version>v1-rev20210319-1.31.5</version>\n' +
            '+      <version>v1-rev20210319-1.32.1</version>\n' +
            '     </dependency>\n',
        },
      ],
      'testRepoName',
      'testRepoOwner',
      1
    );

    assert.ok(javaDependency.checkPR());
  });
});
