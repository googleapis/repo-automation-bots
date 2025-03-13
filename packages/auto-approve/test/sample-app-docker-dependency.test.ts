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

import {DockerDependency} from '../src/process-checks/sample-application-repos/docker-dependency';
import {describe, it} from 'mocha';
import assert from 'assert';

const {Octokit} = require('@octokit/rest');
const fetch = require('node-fetch');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
  request: {fetch},
});

describe('behavior of Docker Dependency process', () => {
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
    const dockerDependency = new DockerDependency(octokit);

    assert.deepStrictEqual(await dockerDependency.checkPR(incomingPR), false);
  });

  it('should return false in checkPR if one of the files did not match additional rules in fileRules', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'chore(deps): update python:3.11.2-slim docker digest to 161a527',
      fileCount: 4,
      changedFiles: [
        {
          sha: '4d828717fba5ab21a2d8adab12717360e8a79891',
          filename: 'src/contacts/Dockerfile',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Fcontacts%2FDockerfile',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Fcontacts%2FDockerfile',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Fcontacts%2FDockerfile?ref=f32f1f47b3d9468570170b3797350dc89e5a726c',
          patch:
            '@@ -13,7 +13,7 @@\n' +
            ' # limitations under the License.\n' +
            ' \n' +
            ' # Use the official Python docker container, slim version, running Debian\n' +
            '-FROM python:3.11.2-slim@sha256:e38263b5fe3d95519afc3a17c0abbc50f6a1eba9d8881276770feb257df51600 as base\n' +
            '+FROM python:3.11.2-slim@sha256:161a52751dd68895c01350e44e9761e3965e4cef0f983bc5b6c57fd36d7e513c as base\n' +
            ' \n' +
            ' FROM base as builder\n' +
            ' ',
        },
        {
          sha: '549d443b72650374e63e8fb98885810429e03cd9',
          filename:
            'extras/postgres-hpa/kubernetes-manifests/pgpool-operator.yaml',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Ffrontend%2FDockerfile',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Ffrontend%2FDockerfile',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Ffrontend%2FDockerfile?ref=f32f1f47b3d9468570170b3797350dc89e5a726c',
          patch:
            'image: python:3.11-bullseye@sha256:89cbc1829d74f72436c96302c49218291eb464705c726cc27d71c32fec1d9082',
        },
        {
          sha: '840ef5b465f1cb2faabbeac5d98a91bf1031004b',
          filename: 'src/loadgenerator/Dockerfile',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Floadgenerator%2FDockerfile',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Floadgenerator%2FDockerfile',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Floadgenerator%2FDockerfile?ref=f32f1f47b3d9468570170b3797350dc89e5a726c',
          patch:
            '@@ -13,7 +13,7 @@\n' +
            ' # limitations under the License.\n' +
            ' \n' +
            ' # Use the official Python docker container, slim version, running Debian\n' +
            '-FROM python:3.11.2-slim@sha256:e38263b5fe3d95519afc3a17c0abbc50f6a1eba9d8881276770feb257df51600 as base\n' +
            '+FROM python:3.11.2-slim@sha256:161a52751dd68895c01350e44e9761e3965e4cef0f983bc5b6c57fd36d7e513c as base\n' +
            ' \n' +
            ' FROM base as builder\n' +
            ' ',
        },
        {
          sha: '9c19c0f88c175d2d981474388ef430b7903cdac0',
          filename: 'src/userservice/Dockerfile',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Fuserservice%2FDockerfile',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Fuserservice%2FDockerfile',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Fuserservice%2FDockerfile?ref=f32f1f47b3d9468570170b3797350dc89e5a726c',
          patch:
            '@@ -13,7 +13,7 @@\n' +
            ' # limitations under the License.\n' +
            ' \n' +
            ' # Use the official Python docker container, slim version, running Debian\n' +
            '-FROM python:3.11.2-slim@sha256:e38263b5fe3d95519afc3a17c0abbc50f6a1eba9d8881276770feb257df51600 as base\n' +
            '+FROM python:3.11.2-slim@sha256:161a52751dd68895c01350e44e9761e3965e4cef0f983bc5b6c57fd36d7e513c as base\n' +
            ' \n' +
            ' FROM base as builder\n' +
            ' ',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const dockerDependency = new DockerDependency(octokit);

    assert.deepStrictEqual(await dockerDependency.checkPR(incomingPR), false);
  });

  it('should return true in checkPR if incoming PR does match classRules', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'chore(deps): update python:3.11.2-slim docker digest to 161a527',
      fileCount: 4,
      changedFiles: [
        {
          sha: '4d828717fba5ab21a2d8adab12717360e8a79891',
          filename: 'src/contacts/Dockerfile',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Fcontacts%2FDockerfile',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Fcontacts%2FDockerfile',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Fcontacts%2FDockerfile?ref=f32f1f47b3d9468570170b3797350dc89e5a726c',
          patch:
            '@@ -13,7 +13,7 @@\n' +
            ' # limitations under the License.\n' +
            ' \n' +
            ' # Use the official Python docker container, slim version, running Debian\n' +
            '-FROM python:3.11.2-slim@sha256:e38263b5fe3d95519afc3a17c0abbc50f6a1eba9d8881276770feb257df51600 as base\n' +
            '+FROM python:3.11.2-slim@sha256:161a52751dd68895c01350e44e9761e3965e4cef0f983bc5b6c57fd36d7e513c as base\n' +
            ' \n' +
            ' FROM base as builder\n' +
            ' ',
        },
        {
          sha: '549d443b72650374e63e8fb98885810429e03cd9',
          filename: 'src/frontend/Dockerfile',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Ffrontend%2FDockerfile',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Ffrontend%2FDockerfile',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Ffrontend%2FDockerfile?ref=f32f1f47b3d9468570170b3797350dc89e5a726c',
          patch:
            '@@ -13,7 +13,7 @@\n' +
            ' # limitations under the License.\n' +
            ' \n' +
            ' # Use the official Python docker container, slim version, running Debian\n' +
            '-FROM python:3.11.2-slim@sha256:e38263b5fe3d95519afc3a17c0abbc50f6a1eba9d8881276770feb257df51600 as base\n' +
            '+FROM python:3.11.2-slim@sha256:161a52751dd68895c01350e44e9761e3965e4cef0f983bc5b6c57fd36d7e513c as base\n' +
            ' \n' +
            ' FROM base as builder\n' +
            ' ',
        },
        {
          sha: '840ef5b465f1cb2faabbeac5d98a91bf1031004b',
          filename: 'src/loadgenerator/Dockerfile',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Floadgenerator%2FDockerfile',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Floadgenerator%2FDockerfile',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Floadgenerator%2FDockerfile?ref=f32f1f47b3d9468570170b3797350dc89e5a726c',
          patch:
            '@@ -13,7 +13,7 @@\n' +
            ' # limitations under the License.\n' +
            ' \n' +
            ' # Use the official Python docker container, slim version, running Debian\n' +
            '-FROM python:3.11.2-slim@sha256:e38263b5fe3d95519afc3a17c0abbc50f6a1eba9d8881276770feb257df51600 as base\n' +
            '+FROM python:3.11.2-slim@sha256:161a52751dd68895c01350e44e9761e3965e4cef0f983bc5b6c57fd36d7e513c as base\n' +
            ' \n' +
            ' FROM base as builder\n' +
            ' ',
        },
        {
          sha: '9c19c0f88c175d2d981474388ef430b7903cdac0',
          filename: 'src/userservice/Dockerfile',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Fuserservice%2FDockerfile',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/f32f1f47b3d9468570170b3797350dc89e5a726c/src%2Fuserservice%2FDockerfile',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Fuserservice%2FDockerfile?ref=f32f1f47b3d9468570170b3797350dc89e5a726c',
          patch:
            '@@ -13,7 +13,7 @@\n' +
            ' # limitations under the License.\n' +
            ' \n' +
            ' # Use the official Python docker container, slim version, running Debian\n' +
            '-FROM python:3.11.2-slim@sha256:e38263b5fe3d95519afc3a17c0abbc50f6a1eba9d8881276770feb257df51600 as base\n' +
            '+FROM python:3.11.2-slim@sha256:161a52751dd68895c01350e44e9761e3965e4cef0f983bc5b6c57fd36d7e513c as base\n' +
            ' \n' +
            ' FROM base as builder\n' +
            ' ',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const dockerDependency = new DockerDependency(octokit);

    assert.ok(await dockerDependency.checkPR(incomingPR));
  });

  it('should return true in checkPR if incoming PR changes revision tags', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'chore(deps): update python docker tag to v3.11.3',
      fileCount: 4,
      changedFiles: [
        {
          sha: '35b3e97b5af298c8a581156346144cb2a9b3235e',
          filename: 'src/accounts/contacts/Dockerfile',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/1c830620a0bdbccd8aa1c2612992c5f8468918c1/src%2Faccounts%2Fcontacts%2FDockerfile',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/1c830620a0bdbccd8aa1c2612992c5f8468918c1/src%2Faccounts%2Fcontacts%2FDockerfile',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Faccounts%2Fcontacts%2FDockerfile?ref=1c830620a0bdbccd8aa1c2612992c5f8468918c1',
          patch:
            '@@ -13,7 +13,7 @@\n' +
            ' # limitations under the License.\n' +
            ' \n' +
            ' # Use the official Python docker container, slim version, running Debian\n' +
            '-FROM python:3.11.2-slim@sha256:9ad4ffc502779e5508f7ac1eccab4a22786b80bd53d721d735f6de0840b245a1 as base\n' +
            '+FROM python:3.11.3-slim@sha256:45c373affcd06e5443ae9ebddbccc0b2f3476aa36c87893b8790938400db8338 as base\n' +
            ' \n' +
            ' FROM base as builder\n' +
            ' ',
        },
        {
          sha: 'e321e4714af4e6578db5016ab347803425cbaa76',
          filename: 'src/accounts/userservice/Dockerfile',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/1c830620a0bdbccd8aa1c2612992c5f8468918c1/src%2Faccounts%2Fuserservice%2FDockerfile',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/1c830620a0bdbccd8aa1c2612992c5f8468918c1/src%2Faccounts%2Fuserservice%2FDockerfile',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Faccounts%2Fuserservice%2FDockerfile?ref=1c830620a0bdbccd8aa1c2612992c5f8468918c1',
          patch:
            '@@ -13,7 +13,7 @@\n' +
            ' # limitations under the License.\n' +
            ' \n' +
            ' # Use the official Python docker container, slim version, running Debian\n' +
            '-FROM python:3.11.2-slim@sha256:9ad4ffc502779e5508f7ac1eccab4a22786b80bd53d721d735f6de0840b245a1 as base\n' +
            '+FROM python:3.11.3-slim@sha256:45c373affcd06e5443ae9ebddbccc0b2f3476aa36c87893b8790938400db8338 as base\n' +
            ' \n' +
            ' FROM base as builder\n' +
            ' ',
        },
        {
          sha: '22197560da929866367236d433ff245746932070',
          filename: 'src/frontend/Dockerfile',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/1c830620a0bdbccd8aa1c2612992c5f8468918c1/src%2Ffrontend%2FDockerfile',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/1c830620a0bdbccd8aa1c2612992c5f8468918c1/src%2Ffrontend%2FDockerfile',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Ffrontend%2FDockerfile?ref=1c830620a0bdbccd8aa1c2612992c5f8468918c1',
          patch:
            '@@ -13,7 +13,7 @@\n' +
            ' # limitations under the License.\n' +
            ' \n' +
            ' # Use the official Python docker container, slim version, running Debian\n' +
            '-FROM python:3.11.2-slim@sha256:9ad4ffc502779e5508f7ac1eccab4a22786b80bd53d721d735f6de0840b245a1 as base\n' +
            '+FROM python:3.11.3-slim@sha256:45c373affcd06e5443ae9ebddbccc0b2f3476aa36c87893b8790938400db8338 as base\n' +
            ' \n' +
            ' FROM base as builder\n' +
            ' ',
        },
        {
          sha: 'e9679fb919c8c1162c99ecde5d447eff32a63bf9',
          filename: 'src/loadgenerator/Dockerfile',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/1c830620a0bdbccd8aa1c2612992c5f8468918c1/src%2Floadgenerator%2FDockerfile',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/1c830620a0bdbccd8aa1c2612992c5f8468918c1/src%2Floadgenerator%2FDockerfile',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Floadgenerator%2FDockerfile?ref=1c830620a0bdbccd8aa1c2612992c5f8468918c1',
          patch:
            '@@ -13,7 +13,7 @@\n' +
            ' # limitations under the License.\n' +
            ' \n' +
            ' # Use the official Python docker container, slim version, running Debian\n' +
            '-FROM python:3.11.2-slim@sha256:9ad4ffc502779e5508f7ac1eccab4a22786b80bd53d721d735f6de0840b245a1 as base\n' +
            '+FROM python:3.11.3-slim@sha256:45c373affcd06e5443ae9ebddbccc0b2f3476aa36c87893b8790938400db8338 as base\n' +
            ' \n' +
            ' FROM base as builder\n' +
            ' ',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const dockerDependency = new DockerDependency(octokit);

    assert.ok(await dockerDependency.checkPR(incomingPR));
  });

  it('should return true in checkPR if incoming PR changes revision tags and minor version', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'chore(deps): update cypress/included docker tag to v12.17.0',
      fileCount: 1,
      changedFiles: [
        {
          sha: 'b8673c548ce9844b2520270ab226a1986272445b',
          filename: '.github/workflows/ui-tests/Dockerfile',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '@@ -9,7 +9,7 @@\n' +
            ' # See the License for the specific language governing permissions and\n' +
            ' # limitations under the License.\n' +
            ' \n' +
            '-FROM cypress/included:12.16.0@sha256:6d0d19471a66165c82760b1efc0dfad82ddd9d389ede1d7398a6b93f0e7b5278\n' +
            '+FROM cypress/included:12.17.0@sha256:84eba545389701872b459338152ec92ab9942b499b1666a478c65f820f39ca5f\n' +
            ' \n' +
            ' WORKDIR /e2e\n' +
            ' COPY . .',
        },
      ],
      repoName: 'GoogleCloudPlatform',
      repoOwner: 'bank-of-anthos',
      prNumber: 1622,
      body: 'body',
    };
    const dockerDependency = new DockerDependency(octokit);

    assert.ok(await dockerDependency.checkPR(incomingPR));
  });

  it('should approve Docker dep updates with digests in the title', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title:
        'chore(deps): update postgres:16.0-alpine docker digest to bfd42bb',
      fileCount: 2,
      changedFiles: [
        {
          sha: '8fe2f5eb59f8eb9f95e0e8fcd075f6f6b5529b52',
          filename: 'src/accounts/accounts-db/Dockerfile',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/9d5fb93b846ea45c55a529d63e6e2ef9d245996e/src%2Faccounts%2Faccounts-db%2FDockerfile',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/9d5fb93b846ea45c55a529d63e6e2ef9d245996e/src%2Faccounts%2Faccounts-db%2FDockerfile',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Faccounts%2Faccounts-db%2FDockerfile?ref=9d5fb93b846ea45c55a529d63e6e2ef9d245996e',
          patch:
            '@@ -11,7 +11,7 @@\n' +
            ' # WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n' +
            ' # See the License for the specific language governing permissions and\n' +
            ' # limitations under the License.\n' +
            '-FROM postgres:16.0-alpine@sha256:2ccd6655060d7b06c71f86094e8c7a28bdcc8a80b43baca4b1dabb29cff138a2\n' +
            '+FROM postgres:16.0-alpine@sha256:bfd42bb6358aee8a305ec3f51d505d6b9e406cf3ce800914a66741dba18b8263\n' +
            ' \n' +
            ' # Files for initializing the database.\n' +
            ' COPY initdb/0-accounts-schema.sql /docker-entrypoint-initdb.d/0-accounts-schema.sql',
        },
        {
          sha: '9fcaa463cd48e26e1c64292c1c5e8e954e228400',
          filename: 'src/ledger/ledger-db/Dockerfile',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/9d5fb93b846ea45c55a529d63e6e2ef9d245996e/src%2Fledger%2Fledger-db%2FDockerfile',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/9d5fb93b846ea45c55a529d63e6e2ef9d245996e/src%2Fledger%2Fledger-db%2FDockerfile',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Fledger%2Fledger-db%2FDockerfile?ref=9d5fb93b846ea45c55a529d63e6e2ef9d245996e',
          patch:
            '@@ -11,7 +11,7 @@\n' +
            ' # WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.\n' +
            ' # See the License for the specific language governing permissions and\n' +
            ' # limitations under the License.\n' +
            '-FROM postgres:16.0-alpine@sha256:2ccd6655060d7b06c71f86094e8c7a28bdcc8a80b43baca4b1dabb29cff138a2\n' +
            '+FROM postgres:16.0-alpine@sha256:bfd42bb6358aee8a305ec3f51d505d6b9e406cf3ce800914a66741dba18b8263\n' +
            ' \n' +
            ' # Need to get coreutils to get the date bash function working properly:\n' +
            ' RUN apk add --update coreutils && rm -rf /var/cache/apk/*',
        },
      ],
      repoName: 'GoogleCloudPlatform',
      repoOwner: 'bank-of-anthos',
      prNumber: 1855,
      body: 'body',
    };
    const dockerDependency = new DockerDependency(octokit);

    assert.ok(await dockerDependency.checkPR(incomingPR));
  });
});
