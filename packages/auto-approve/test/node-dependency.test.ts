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
const fetch = require('node-fetch');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
  request: {fetch},
});

describe('behavior of Node Dependency process', () => {
  it('should return false in checkPR if incoming PR does not match classRules', async () => {
    const incomingPR = {
      author: 'testAuthor',
      title: 'testTitle',
      fileCount: 3,
      changedFiles: [{filename: 'hello', sha: '2345'}],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const nodeDependency = new NodeDependency(octokit);

    assert.deepStrictEqual(await nodeDependency.checkPR(incomingPR), false);
  });

  it('should return false in checkPR if one of the files did not match additional rules in fileRules', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'fix(deps): update dependency @octokit/auth-app to v16',
      fileCount: 3,
      changedFiles: [
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
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const nodeDependency = new NodeDependency(octokit);

    assert.deepStrictEqual(await nodeDependency.checkPR(incomingPR), false);
  });

  it('should return true in checkPR if incoming PR does match ONE OF the classRules, and no files do not match ANY of the rules', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'fix(deps): update dependency @octokit/auth-app to v16',
      fileCount: 1,
      changedFiles: [
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
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const nodeDependency = new NodeDependency(octokit);

    assert.ok(await nodeDependency.checkPR(incomingPR));
  });

  it('should return true in checkPR if incoming PR has ^ or ~ characters', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'fix(deps): update dependency recast to ^0.23.0',
      fileCount: 1,
      changedFiles: [
        {
          sha: '64d9442dc0e7b39caafa07604186d58e57f1745d',
          filename: 'packages/typeless-sample-bot/package.json',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/googleapis/google-cloud-node/blob/d17c6c9f32fc7c62a6d728969e4e6982766eb2d0/packages%2Ftypeless-sample-bot%2Fpackage.json',
          raw_url:
            'https://github.com/googleapis/google-cloud-node/raw/d17c6c9f32fc7c62a6d728969e4e6982766eb2d0/packages%2Ftypeless-sample-bot%2Fpackage.json',
          contents_url:
            'https://api.github.com/repos/googleapis/google-cloud-node/contents/packages%2Ftypeless-sample-bot%2Fpackage.json?ref=d17c6c9f32fc7c62a6d728969e4e6982766eb2d0',
          patch:
            '@@ -33,7 +33,7 @@\n' +
            '     "@babel/traverse": "^7.18.10",\n' +
            '     "chalk": "^5.0.1",\n' +
            '     "debug": "^4.3.4",\n' +
            '-    "recast": "^0.22.0",\n' +
            '+    "recast": "^0.23.0"\n' +
            '   },\n' +
            '   "devDependencies": {',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const nodeDependency = new NodeDependency(octokit);

    assert.ok(await nodeDependency.checkPR(incomingPR));
  });
});
