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

import {NodeDependency} from '../src/process-checks/node/dependency';
import {describe, it} from 'mocha';
import assert from 'assert';

const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
});

describe('behavior of Node Dependency process', () => {
  it('should get constructed with the appropriate values', () => {
    const nodeDependency = new NodeDependency(
      'testAuthor',
      'testTitle',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      'body'
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
        body: 'body',
      },
      classRule: {
        author: 'renovate-bot',
        titleRegex:
          /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
        maxFiles: 3,
        fileNameRegex: [/package\.json$/],
        fileRules: [
          {
            dependencyTitle:
              /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
            targetFileToCheck: /^samples\/package.json$/,
            // This would match: -  "version": "^2.3.0" or -  "version": "~2.3.0"
            oldVersion:
              /-[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)",/,
            // This would match: +  "version": "^2.3.0" or +  "version": "~2.3.0"
            newVersion:
              /\+[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)"/,
          },
          {
            dependencyTitle:
              /^(fix|chore)\(deps\): update dependency (@?\S*) to v(\S*)$/,
            targetFileToCheck: /^package.json$/,
            // This would match: -  "version": "^2.3.0" or -  "version": "~2.3.0"
            oldVersion:
              /-[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)",/,
            // This would match: +  "version": "^2.3.0" or +  "version": "~2.3.0"
            newVersion:
              /\+[\s]*"(@?\S*)":[\s]"(?:\^?|~?)([0-9])*\.([0-9]*\.[0-9]*)"/,
          },
        ],
      },
      octokit,
    };

    assert.deepStrictEqual(nodeDependency.incomingPR, expectation.incomingPR);
    assert.deepStrictEqual(nodeDependency.classRule, expectation.classRule);
    assert.deepStrictEqual(nodeDependency.octokit, octokit);
  });

  it('should return false in checkPR if incoming PR does not match classRules', async () => {
    const nodeDependency = new NodeDependency(
      'testAuthor',
      'testTitle',
      3,
      [{filename: 'hello', sha: '2345'}],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      'body'
    );

    assert.deepStrictEqual(await nodeDependency.checkPR(), false);
  });

  it('should return false in checkPR if one of the files did not match additional rules in fileRules', async () => {
    const nodeDependency = new NodeDependency(
      'renovate-bot',
      'fix(deps): update dependency @octokit/auth-app to v16',
      3,
      [
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'package.json',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '@@ -1,7 +1,7 @@\n' +
            ' {\n' +
            '   "name": "@google-cloud/kms",\n' +
            '   "description": "Google Cloud Key Management Service (KMS) API client for Node.js",\n' +
            '-  "@octokit/auth-app": "2.3.0",\n' +
            '+  "@octokit/auth-app": "2.3.1",\n' +
            '   "license": "Apache-2.0",\n' +
            '   "author": "Google LLC",\n' +
            '   "engines": {',
        },
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'maliciousFile',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '@@ -1,7 +1,7 @@\n' +
            ' {\n' +
            '   "name": "@google-cloud/kms",\n' +
            '   "description": "Google Cloud Key Management Service (KMS) API client for Node.js",\n' +
            '-  "version": "2.3.0",\n' +
            '+  "version": "2.3.1",\n' +
            '   "license": "Apache-2.0",\n' +
            '   "author": "Google LLC",\n' +
            '   "engines": {',
        },
      ],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      'body'
    );

    assert.deepStrictEqual(await nodeDependency.checkPR(), false);
  });

  it('should return true in checkPR if incoming PR does match ONE OF the classRules, and no files do not match ANY of the rules', async () => {
    const nodeDependency = new NodeDependency(
      'renovate-bot',
      'fix(deps): update dependency @octokit/auth-app to v16',
      1,
      [
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'package.json',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '@@ -1,7 +1,7 @@\n' +
            ' {\n' +
            '   "name": "@google-cloud/kms",\n' +
            '   "description": "Google Cloud Key Management Service (KMS) API client for Node.js",\n' +
            '-  "@octokit/auth-app": "2.3.0",\n' +
            '+  "@octokit/auth-app": "2.3.1",\n' +
            '   "license": "Apache-2.0",\n' +
            '   "author": "Google LLC",\n' +
            '   "engines": {',
        },
      ],
      'testRepoName',
      'testRepoOwner',
      1,
      octokit,
      'body'
    );

    assert.ok(await nodeDependency.checkPR());
  });
});
