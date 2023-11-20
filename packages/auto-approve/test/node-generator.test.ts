// Copyright 2023 Google LLC
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

import {NodeGeneratorDependency} from '../src/process-checks/node/generator-dependency';
import {describe, it} from 'mocha';
import assert from 'assert';

const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
});

describe('behavior of Node Generator Dependency process', () => {
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
    const nodeDependency = new NodeGeneratorDependency(octokit);

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
    const nodeDependency = new NodeGeneratorDependency(octokit);

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
    const nodeDependency = new NodeGeneratorDependency(octokit);

    assert.ok(await nodeDependency.checkPR(incomingPR));
  });

  it('should return true if one of the files is .pnpm-lock.yaml', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'chore(deps): update dependency @types/object-hash to ^3.0.4',
      fileCount: 2,
      changedFiles: [
        {
          sha: 'e6e7a983e8f030e9ea500f9d2b0006bd5c59dc83',
          filename: 'package.json',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/googleapis/gapic-generator-typescript/blob/46ca94ac4b0eb312df8d23e8e86e4ef22db29566/package.json',
          raw_url:
            'https://github.com/googleapis/gapic-generator-typescript/raw/46ca94ac4b0eb312df8d23e8e86e4ef22db29566/package.json',
          contents_url:
            'https://api.github.com/repos/googleapis/gapic-generator-typescript/contents/package.json?ref=46ca94ac4b0eb312df8d23e8e86e4ef22db29566',
          patch:
            '@@ -56,7 +56,7 @@\n' +
            '     "@types/module-alias": "^2.0.2",\n' +
            '     "@types/node": "^18.11.18",\n' +
            '     "@types/nunjucks": "^3.2.3",\n' +
            '-    "@types/object-hash": "^3.0.3",\n' +
            '+    "@types/object-hash": "^3.0.4",\n' +
            '     "@types/yargs": "^17.0.24",\n' +
            '     "espower-typescript": "^10.0.1",\n' +
            '     "gapic-tools": "^0.1.8",',
        },
        {
          sha: 'e852ef53ac9cc385958320bb0cf867d34198518f',
          filename: 'pnpm-lock.yaml',
          status: 'modified',
          additions: 4,
          deletions: 4,
          changes: 8,
          blob_url:
            'https://github.com/googleapis/gapic-generator-typescript/blob/46ca94ac4b0eb312df8d23e8e86e4ef22db29566/pnpm-lock.yaml',
          raw_url:
            'https://github.com/googleapis/gapic-generator-typescript/raw/46ca94ac4b0eb312df8d23e8e86e4ef22db29566/pnpm-lock.yaml',
          contents_url:
            'https://api.github.com/repos/googleapis/gapic-generator-typescript/contents/pnpm-lock.yaml?ref=46ca94ac4b0eb312df8d23e8e86e4ef22db29566',
          patch:
            '@@ -47,8 +47,8 @@ devDependencies:\n' +
            '     specifier: ^3.2.3\n' +
            '     version: 3.2.3\n' +
            "   '@types/object-hash':\n" +
            '-    specifier: ^3.0.3\n' +
            '-    version: 3.0.3\n' +
            '+    specifier: ^3.0.4\n' +
            '+    version: 3.0.4\n' +
            "   '@types/yargs':\n" +
            '     specifier: ^17.0.24\n' +
            '     version: 17.0.24\n' +
            '@@ -387,8 +387,8 @@ packages:\n' +
            '     resolution: {integrity: sha512-+lFIql0nbWSftazQ27cOYvSLC92SsfjxrU0I/Iys7hoxrBkN8OF+wmxxzx3bLFyFrLgDZ9lUckGcwldE4SfDQA==}\n' +
            '     dev: true\n' +
            ' \n' +
            '-  /@types/object-hash@3.0.3:\n' +
            '-    resolution: {integrity: sha512-Mb0SDIhjhBAz4/rDNU0cYcQR4lSJIwy+kFlm0whXLkx+o0pXwEszwyrWD6gXWumxVbAS6XZ9gXK82LR+Uk+cKQ==}\n' +
            '+  /@types/object-hash@3.0.4:\n' +
            '+    resolution: {integrity: sha512-w4fEy2suq1bepUxHoJRCBHJz0vS5DPAYpSbcgNwOahljxwyJsiKmi8qyes2/TJc+4Avd7fsgP+ZgUuXZjPvdug==}\n' +
            '     dev: true\n' +
            ' \n' +
            '   /@types/semver@7.5.1:',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const nodeDependency = new NodeGeneratorDependency(octokit);

    assert.ok(await nodeDependency.checkPR(incomingPR));
  });

  it('should return true for a correct bzl file', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'chore(deps): update dependency com_google_protobuf to v24.1',
      fileCount: 1,
      changedFiles: [
        {
          sha: 'ac2a01e3e3e4bf5508427e770b9b8fa60bcb7b2e',
          filename: 'repositories.bzl',
          status: 'modified',
          additions: 3,
          deletions: 3,
          changes: 6,
          blob_url:
            'https://github.com/googleapis/gapic-generator-typescript/blob/d23c3e113ec6392aa8475eb8cfde14455673e214/repositories.bzl',
          raw_url:
            'https://github.com/googleapis/gapic-generator-typescript/raw/d23c3e113ec6392aa8475eb8cfde14455673e214/repositories.bzl',
          contents_url:
            'https://api.github.com/repos/googleapis/gapic-generator-typescript/contents/repositories.bzl?ref=d23c3e113ec6392aa8475eb8cfde14455673e214',
          patch:
            '@@ -40,9 +40,9 @@ def gapic_generator_typescript_repositories():\n' +
            '   maybe(\n' +
            '       http_archive,\n' +
            '       name = "com_google_protobuf",\n' +
            '-      sha256 = "850357336189c470e429e9bdffca92229d8cd5b7f84aa2f3b4c5fdb80ce8351b",\n' +
            '-      strip_prefix = "protobuf-24.0",\n' +
            '-      urls = ["https://github.com/protocolbuffers/protobuf/archive/v24.0.tar.gz"],\n' +
            '+      sha256 = "0930b1a6eb840a2295dfcb13bb5736d1292c3e0d61a90391181399327be7d8f1",\n' +
            '+      strip_prefix = "protobuf-24.1",\n' +
            '+      urls = ["https://github.com/protocolbuffers/protobuf/archive/v24.1.tar.gz"],\n' +
            '   )\n' +
            ' \n' +
            " # This is the version of Node.js that would run the generator, it's unrelated to the versions supported by the generated libraries",
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const nodeDependency = new NodeGeneratorDependency(octokit);

    assert.ok(await nodeDependency.checkPR(incomingPR));
  });

  it('should return true for a correct bzl file with multiple submajors', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'chore(deps): update dependency aspect_rules_js to v1.32.0',
      fileCount: 1,
      changedFiles: [
        {
          sha: 'ddc35986479f5fda7eadcd8084fb62bd6ae517e6',
          filename: 'repositories.bzl',
          status: 'modified',
          additions: 3,
          deletions: 3,
          changes: 6,
          blob_url:
            'https://github.com/googleapis/gapic-generator-typescript/blob/0d6f4748590555e65382b27cf11bf19b5ff575c1/repositories.bzl',
          raw_url:
            'https://github.com/googleapis/gapic-generator-typescript/raw/0d6f4748590555e65382b27cf11bf19b5ff575c1/repositories.bzl',
          contents_url:
            'https://api.github.com/repos/googleapis/gapic-generator-typescript/contents/repositories.bzl?ref=0d6f4748590555e65382b27cf11bf19b5ff575c1',
          patch:
            '@@ -5,9 +5,9 @@ def gapic_generator_typescript_repositories():\n' +
            '   maybe(\n' +
            '     http_archive,\n' +
            '     name = "aspect_rules_js",\n' +
            '-    sha256 = "7b2a4d1d264e105eae49a27e2e78065b23e2e45724df2251eacdd317e95bfdfd",\n' +
            '-    strip_prefix = "rules_js-1.31.0",\n' +
            '-    url = "https://github.com/aspect-build/rules_js/archive/refs/tags/v1.31.0.tar.gz",\n' +
            '+    sha256 = "bdbd6df52fc7963f55281fe0a140e21de8ec587ab711a8a2fff0715b6710a4f8",\n' +
            '+    strip_prefix = "rules_js-1.32.0",\n' +
            '+    url = "https://github.com/aspect-build/rules_js/archive/refs/tags/v1.32.0.tar.gz",\n' +
            '   )\n' +
            ' \n' +
            '   maybe(',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const nodeDependency = new NodeGeneratorDependency(octokit);

    assert.ok(await nodeDependency.checkPR(incomingPR));
  });

  it('should allow for package-lock.json and yarn.locks to  be approved', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'chore(deps): update dependency @types/module-alias to ^2.0.4',
      fileCount: 4,
      changedFiles: [
        {
          sha: '47b7a23cfa41986bc1fbeb5f204a688c407bd662',
          filename: 'package-lock.json',
          status: 'modified',
          additions: 4,
          deletions: 4,
          changes: 8,
          blob_url:
            'https://github.com/googleapis/gapic-generator-typescript/blob/fa9de0ca47f16632a766dfe2a3693e6ebbbcf3e4/package-lock.json',
          raw_url:
            'https://github.com/googleapis/gapic-generator-typescript/raw/fa9de0ca47f16632a766dfe2a3693e6ebbbcf3e4/package-lock.json',
          contents_url:
            'https://api.github.com/repos/googleapis/gapic-generator-typescript/contents/package-lock.json?ref=fa9de0ca47f16632a766dfe2a3693e6ebbbcf3e4',
          patch:
            '@@ -26,7 +26,7 @@\n' +
            '       "devDependencies": {\n' +
            '         "@bazel/bazelisk": "^1.18.0",\n' +
            '         "@types/mocha": "^10.0.2",\n' +
            '-        "@types/module-alias": "^2.0.2",\n' +
            '+        "@types/module-alias": "^2.0.4",\n' +
            '         "@types/node": "^18.11.18",\n' +
            '         "@types/nunjucks": "^3.2.4",\n' +
            '         "@types/object-hash": "^3.0.4",\n' +
            '@@ -948,9 +948,9 @@\n' +
            '       "dev": true\n' +
            '     },\n' +
            '     "node_modules/@types/module-alias": {\n' +
            '-      "version": "2.0.2",\n' +
            '-      "resolved": "https://registry.npmjs.org/@types/module-alias/-/module-alias-2.0.2.tgz",\n' +
            '-      "integrity": "sha512-Oeo5NEjAceFgN8OzGiLXPswgv2GBmrDGuTnLS0sQ8g4Mq5sB5c97Hu5B+n9Gu/j+5Y+oUb4TSawHXkZ8MENGyw==",\n' +
            '+      "version": "2.0.4",\n' +
            '+      "resolved": "https://registry.npmjs.org/@types/module-alias/-/module-alias-2.0.4.tgz",\n' +
            '+      "integrity": "sha512-5+G/QXO/DvHZw60FjvbDzO4JmlD/nG5m2/vVGt25VN1eeP3w2bCoks1Wa7VuptMPM1TxJdx6RjO70N9Fw0nZPA==",\n' +
            '       "dev": true\n' +
            '     },\n' +
            '     "node_modules/@types/node": {',
        },
        {
          sha: '9e843cbdfa997155d1fbd69e1e288862460191dd',
          filename: 'package.json',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/googleapis/gapic-generator-typescript/blob/fa9de0ca47f16632a766dfe2a3693e6ebbbcf3e4/package.json',
          raw_url:
            'https://github.com/googleapis/gapic-generator-typescript/raw/fa9de0ca47f16632a766dfe2a3693e6ebbbcf3e4/package.json',
          contents_url:
            'https://api.github.com/repos/googleapis/gapic-generator-typescript/contents/package.json?ref=fa9de0ca47f16632a766dfe2a3693e6ebbbcf3e4',
          patch:
            '@@ -54,7 +54,7 @@\n' +
            '   "devDependencies": {\n' +
            '     "@bazel/bazelisk": "^1.18.0",\n' +
            '     "@types/mocha": "^10.0.2",\n' +
            '-    "@types/module-alias": "^2.0.2",\n' +
            '+    "@types/module-alias": "^2.0.4",\n' +
            '     "@types/node": "^18.11.18",\n' +
            '     "@types/nunjucks": "^3.2.4",\n' +
            '     "@types/object-hash": "^3.0.4",',
        },
        {
          sha: '4a9621187881844d2e22fd6b91bbea7c1bfecd4a',
          filename: 'pnpm-lock.yaml',
          status: 'modified',
          additions: 4,
          deletions: 4,
          changes: 8,
          blob_url:
            'https://github.com/googleapis/gapic-generator-typescript/blob/fa9de0ca47f16632a766dfe2a3693e6ebbbcf3e4/pnpm-lock.yaml',
          raw_url:
            'https://github.com/googleapis/gapic-generator-typescript/raw/fa9de0ca47f16632a766dfe2a3693e6ebbbcf3e4/pnpm-lock.yaml',
          contents_url:
            'https://api.github.com/repos/googleapis/gapic-generator-typescript/contents/pnpm-lock.yaml?ref=fa9de0ca47f16632a766dfe2a3693e6ebbbcf3e4',
          patch:
            '@@ -41,8 +41,8 @@ devDependencies:\n' +
            '     specifier: ^10.0.2\n' +
            '     version: 10.0.2\n' +
            "   '@types/module-alias':\n" +
            '-    specifier: ^2.0.2\n' +
            '-    version: 2.0.2\n' +
            '+    specifier: ^2.0.4\n' +
            '+    version: 2.0.4\n' +
            "   '@types/node':\n" +
            '     specifier: ^18.11.18\n' +
            '     version: 18.13.0\n' +
            '@@ -550,8 +550,8 @@ packages:\n' +
            '     resolution: {integrity: sha512-NaHL0+0lLNhX6d9rs+NSt97WH/gIlRHmszXbQ/8/MV/eVcFNdeJ/GYhrFuUc8K7WuPhRhTSdMkCp8VMzhUq85w==}\n' +
            '     dev: true\n' +
            ' \n' +
            '-  /@types/module-alias@2.0.2:\n' +
            '-    resolution: {integrity: sha512-Oeo5NEjAceFgN8OzGiLXPswgv2GBmrDGuTnLS0sQ8g4Mq5sB5c97Hu5B+n9Gu/j+5Y+oUb4TSawHXkZ8MENGyw==}\n' +
            '+  /@types/module-alias@2.0.4:\n' +
            '+    resolution: {integrity: sha512-5+G/QXO/DvHZw60FjvbDzO4JmlD/nG5m2/vVGt25VN1eeP3w2bCoks1Wa7VuptMPM1TxJdx6RjO70N9Fw0nZPA==}\n' +
            '     dev: true\n' +
            ' \n' +
            '   /@types/node@18.13.0:',
        },
        {
          sha: '7d38d61b7d2ed761db882221e05129582a6a952b',
          filename: 'yarn.lock',
          status: 'modified',
          additions: 4,
          deletions: 4,
          changes: 8,
          blob_url:
            'https://github.com/googleapis/gapic-generator-typescript/blob/fa9de0ca47f16632a766dfe2a3693e6ebbbcf3e4/yarn.lock',
          raw_url:
            'https://github.com/googleapis/gapic-generator-typescript/raw/fa9de0ca47f16632a766dfe2a3693e6ebbbcf3e4/yarn.lock',
          contents_url:
            'https://api.github.com/repos/googleapis/gapic-generator-typescript/contents/yarn.lock?ref=fa9de0ca47f16632a766dfe2a3693e6ebbbcf3e4',
          patch:
            '@@ -498,10 +498,10 @@\n' +
            '   resolved "https://registry.npmjs.org/@types/mocha/-/mocha-10.0.2.tgz"\n' +
            '   integrity sha512-NaHL0+0lLNhX6d9rs+NSt97WH/gIlRHmszXbQ/8/MV/eVcFNdeJ/GYhrFuUc8K7WuPhRhTSdMkCp8VMzhUq85w==\n' +
            ' \n' +
            '-"@types/module-alias@^2.0.2":\n' +
            '-  version "2.0.2"\n' +
            '-  resolved "https://registry.npmjs.org/@types/module-alias/-/module-alias-2.0.2.tgz"\n' +
            '-  integrity sha512-Oeo5NEjAceFgN8OzGiLXPswgv2GBmrDGuTnLS0sQ8g4Mq5sB5c97Hu5B+n9Gu/j+5Y+oUb4TSawHXkZ8MENGyw==\n' +
            '+"@types/module-alias@^2.0.4":\n' +
            '+  version "2.0.4"\n' +
            '+  resolved "https://registry.npmjs.org/@types/module-alias/-/module-alias-2.0.4.tgz"\n' +
            '+  integrity sha512-5+G/QXO/DvHZw60FjvbDzO4JmlD/nG5m2/vVGt25VN1eeP3w2bCoks1Wa7VuptMPM1TxJdx6RjO70N9Fw0nZPA==\n' +
            ' \n' +
            ' "@types/node@*", "@types/node@>=12.12.47", "@types/node@>=13.7.0", "@types/node@^18.11.18":\n' +
            '   version "18.17.14"',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const nodeDependency = new NodeGeneratorDependency(octokit);

    assert.ok(await nodeDependency.checkPR(incomingPR));
  });

  it('should update ci.yaml files', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'chore(deps): update actions/checkout digest to b4ffde6',
      fileCount: 1,
      changedFiles: [
        {
          sha: '988992a0b7d84efc67acb03c0b14314d1d4f6918',
          filename: '.github/workflows/ci.yaml',
          status: 'modified',
          additions: 2,
          deletions: 2,
          changes: 4,
          blob_url:
            'https://github.com/googleapis/gapic-generator-typescript/blob/83bc0cb7d92a992d4c9a5e493ca55c70ce31a6c0/.github%2Fworkflows%2Fci.yaml',
          raw_url:
            'https://github.com/googleapis/gapic-generator-typescript/raw/83bc0cb7d92a992d4c9a5e493ca55c70ce31a6c0/.github%2Fworkflows%2Fci.yaml',
          contents_url:
            'https://api.github.com/repos/googleapis/gapic-generator-typescript/contents/.github%2Fworkflows%2Fci.yaml?ref=83bc0cb7d92a992d4c9a5e493ca55c70ce31a6c0',
          patch:
            '@@ -16,7 +16,7 @@ jobs:\n' +
            '     # time.\n' +
            ' \n' +
            '     steps:\n' +
            '-    - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4\n' +
            '+    - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4\n' +
            ' \n' +
            '     - name: Cache Bazel files\n' +
            '       id: cache-bazel\n' +
            '@@ -142,7 +142,7 @@ jobs:\n' +
            '   lint:\n' +
            '     runs-on: ubuntu-latest\n' +
            '     steps:\n' +
            '-      - uses: actions/checkout@8ade135a41bc03ea155e62e844d188df1ea18608 # v4\n' +
            '+      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4\n' +
            '       - uses: actions/setup-node@v3\n' +
            '         with:\n' +
            '           node-version: 14',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const nodeDependency = new NodeGeneratorDependency(octokit);

    assert.ok(await nodeDependency.checkPR(incomingPR));
  });
});
