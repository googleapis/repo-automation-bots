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

import {PythonDependency} from '../src/process-checks/python/dependency';
import {describe, it} from 'mocha';
import assert from 'assert';

describe('behavior of Python Dependency process', () => {
  it('should get constructed with the appropriate values', () => {
    const pythonDependency = new PythonDependency(
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
        maxFiles: 3,
        fileNameRegex: [/requirements.txt$/],
        fileRules: [
          {
            targetFileToCheck: /^samples\/snippets\/requirements.txt$/,
            // This would match: fix(deps): update dependency @octokit to v1
            dependencyTitle: new RegExp(
              /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/
            ),
            // This would match: '-google-cloud-storage==1.39.0
            oldVersion: new RegExp(
              /[\s]-(@?[^=0-9]*)==([0-9])*\.([0-9]*\.[0-9]*)/
            ),
            // This would match: '+google-cloud-storage==1.40.0
            newVersion: new RegExp(
              /[\s]\+(@?[^=0-9]*)==([0-9])*\.([0-9]*\.[0-9]*)/
            ),
          },
        ],
      },
    };

    assert.deepStrictEqual(pythonDependency.incomingPR, expectation.incomingPR);
    assert.deepStrictEqual(pythonDependency.classRule, expectation.classRule);
  });

  it('should return false in checkPR if incoming PR does not match classRules', () => {
    const pythonDependency = new PythonDependency(
      'testAuthor',
      'testTitle',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1
    );

    assert.deepStrictEqual(pythonDependency.checkPR(), false);
  });

  it('should return false in checkPR if one of the files did not match additional rules in fileRules', () => {
    const pythonDependency = new PythonDependency(
      'renovate-bot',
      'fix(deps): update dependency cloud.google.com to v16',
      3,
      [
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'requirements.txt',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '@@ -71,7 +71,7 @@\n' +
            '-      google-cloud-storage==1.42.3' +
            '+      google-cloud-storage==1.43.0',
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

    assert.deepStrictEqual(pythonDependency.checkPR(), false);
  });

  it('should return true in checkPR if incoming PR does match classRules', () => {
    const pythonDependency = new PythonDependency(
      'renovate-bot',
      'fix(deps): update dependency google-cloud-storage to v16',
      3,
      [
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'samples/snippets/requirements.txt',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '@@ -1,2 +1,2 @@\n' +
            ' google-cloud-videointelligence==2.5.1\n' +
            '-google-cloud-storage==1.42.3\n' +
            '+google-cloud-storage==1.43.0',
        },
      ],
      'testRepoName',
      'testRepoOwner',
      1
    );

    assert.ok(pythonDependency.checkPR());
  });
});
