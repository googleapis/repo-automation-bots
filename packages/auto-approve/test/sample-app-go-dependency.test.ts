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

import {GoDependency} from '../src/process-checks/sample-application-repos/go-dependency';
import {describe, it} from 'mocha';
import assert from 'assert';

const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
});

describe('behavior of Go Dependency process', () => {
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
    const goDependency = new GoDependency(octokit);

    assert.deepStrictEqual(await goDependency.checkPR(incomingPR), false);
  });

  it('should return false in checkPR if one of the files did not match additional rules in fileRules', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'fix(deps): update module github.com/golang/protobuf to v1.5.3',
      fileCount: 3,
      changedFiles: [
        {
          sha: '21004b21a4d5de4a7f83a37dc51fd0ebe22f9942',
          filename: 'src/productcatalogservice/go.yaml',
          status: 'modified',
          additions: 2,
          deletions: 1,
          changes: 3,
          blob_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/blob/349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0/src%2Fproductcatalogservice%2Fgo.sum',
          raw_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/raw/349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0/src%2Fproductcatalogservice%2Fgo.sum',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/microservices-demo/contents/src%2Fproductcatalogservice%2Fgo.sum?ref=349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0',
          patch:
            '@@ -112,8 +112,9 @@ github.com/golang/protobuf v1.4.1/go.mod h1:U8fpvMrcmy5pZrNK1lt4xCsGvpyWQ/VVv6QD\n' +
            ' github.com/golang/protobuf v1.4.2/go.mod h1:oDoupMAO8OvCJWAcko0GGGIgR6R6ocIYbsSw735rRwI=\n' +
            ' github.com/golang/protobuf v1.4.3/go.mod h1:oDoupMAO8OvCJWAcko0GGGIgR6R6ocIYbsSw735rRwI=\n' +
            ' github.com/golang/protobuf v1.5.0/go.mod h1:FsONVRAS9T7sI+LIUmWTfcYkHO4aIWwzhcaSAoJOfIk=\n' +
            '-github.com/golang/protobuf v1.5.2 h1:ROPKBNFfQgOUMifHyP+KYbvpjbdoFNs+aK7DXlji0Tw=\n' +
            ' github.com/golang/protobuf v1.5.2/go.mod h1:XVQd3VNwM+JqD3oG2Ue2ip4fOMUkwXdXDdiuN0vRsmY=\n' +
            '+github.com/golang/protobuf v1.5.3 h1:KhyjKVUg7Usr/dYsdSqoFveMYd5ko72D+zANwlG1mmg=\n' +
            '+github.com/golang/protobuf v1.5.3/go.mod h1:XVQd3VNwM+JqD3oG2Ue2ip4fOMUkwXdXDdiuN0vRsmY=\n' +
            ' github.com/google/btree v0.0.0-20180813153112-4030bb1f1f0c/go.mod h1:lNA+9X1NB3Zf8V7Ke586lFgjr2dZNuvo3lPJSGZ5JPQ=\n' +
            ' github.com/google/btree v1.0.0/go.mod h1:lNA+9X1NB3Zf8V7Ke586lFgjr2dZNuvo3lPJSGZ5JPQ=\n' +
            ' github.com/google/go-cmp v0.2.0/go.mod h1:oXzfMopK8JAjlY9xF4vHSVASa0yLyX7SntLO5aqRK0M=',
        },
        {
          sha: '24a762f2eca36ca37474cf69aad849a7380fc6cd',
          filename: 'src/shippingservice/go.mod',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/blob/349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0/src%2Fshippingservice%2Fgo.mod',
          raw_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/raw/349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0/src%2Fshippingservice%2Fgo.mod',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/microservices-demo/contents/src%2Fshippingservice%2Fgo.mod?ref=349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0',
          patch:
            '@@ -4,7 +4,7 @@ go 1.19\n' +
            ' \n' +
            ' require (\n' +
            ' \tcloud.google.com/go/profiler v0.3.1\n' +
            '-\tgithub.com/golang/protobuf v1.5.2\n' +
            '+\tgithub.com/golang/protobuf v1.5.3\n' +
            ' \tgithub.com/sirupsen/logrus v1.9.0\n' +
            ' \tgolang.org/x/net v0.7.0\n' +
            ' \tgoogle.golang.org/grpc v1.53.0',
        },
        {
          sha: 'b9a6e985adf921b283a6471970f8c469dc3cc9a7',
          filename: 'src/shippingservice/go.sum',
          status: 'modified',
          additions: 2,
          deletions: 2,
          changes: 4,
          blob_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/blob/349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0/src%2Fshippingservice%2Fgo.sum',
          raw_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/raw/349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0/src%2Fshippingservice%2Fgo.sum',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/microservices-demo/contents/src%2Fshippingservice%2Fgo.sum?ref=349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0',
          patch:
            '@@ -38,8 +38,8 @@ github.com/golang/protobuf v1.4.0/go.mod h1:jodUvKwWbYaEsadDk5Fwe5c77LiNKVO9IDvq\n' +
            ' github.com/golang/protobuf v1.4.1/go.mod h1:U8fpvMrcmy5pZrNK1lt4xCsGvpyWQ/VVv6QDs8UjoX8=\n' +
            ' github.com/golang/protobuf v1.4.3/go.mod h1:oDoupMAO8OvCJWAcko0GGGIgR6R6ocIYbsSw735rRwI=\n' +
            ' github.com/golang/protobuf v1.5.0/go.mod h1:FsONVRAS9T7sI+LIUmWTfcYkHO4aIWwzhcaSAoJOfIk=\n' +
            '-github.com/golang/protobuf v1.5.2 h1:ROPKBNFfQgOUMifHyP+KYbvpjbdoFNs+aK7DXlji0Tw=\n' +
            '-github.com/golang/protobuf v1.5.2/go.mod h1:XVQd3VNwM+JqD3oG2Ue2ip4fOMUkwXdXDdiuN0vRsmY=\n' +
            '+github.com/golang/protobuf v1.5.3 h1:KhyjKVUg7Usr/dYsdSqoFveMYd5ko72D+zANwlG1mmg=\n' +
            '+github.com/golang/protobuf v1.5.3/go.mod h1:XVQd3VNwM+JqD3oG2Ue2ip4fOMUkwXdXDdiuN0vRsmY=\n' +
            ' github.com/google/go-cmp v0.2.0/go.mod h1:oXzfMopK8JAjlY9xF4vHSVASa0yLyX7SntLO5aqRK0M=\n' +
            ' github.com/google/go-cmp v0.3.0/go.mod h1:8QqcDgzrUqlUb/G2PQTWiueGozuR1884gddMywk6iLU=\n' +
            ' github.com/google/go-cmp v0.3.1/go.mod h1:8QqcDgzrUqlUb/G2PQTWiueGozuR1884gddMywk6iLU=',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const goDependency = new GoDependency(octokit);

    assert.deepStrictEqual(await goDependency.checkPR(incomingPR), false);
  });

  it('should return true in checkPR if incoming PR does match classRules, including having go.sum', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'fix(deps): update module github.com/golang/protobuf to v1.5.3',
      fileCount: 3,
      changedFiles: [
        {
          sha: '21004b21a4d5de4a7f83a37dc51fd0ebe22f9942',
          filename: 'src/productcatalogservice/go.sum',
          status: 'modified',
          additions: 2,
          deletions: 1,
          changes: 3,
          blob_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/blob/349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0/src%2Fproductcatalogservice%2Fgo.sum',
          raw_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/raw/349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0/src%2Fproductcatalogservice%2Fgo.sum',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/microservices-demo/contents/src%2Fproductcatalogservice%2Fgo.sum?ref=349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0',
          patch:
            '@@ -112,8 +112,9 @@ github.com/golang/protobuf v1.4.1/go.mod h1:U8fpvMrcmy5pZrNK1lt4xCsGvpyWQ/VVv6QD\n' +
            ' github.com/golang/protobuf v1.4.2/go.mod h1:oDoupMAO8OvCJWAcko0GGGIgR6R6ocIYbsSw735rRwI=\n' +
            ' github.com/golang/protobuf v1.4.3/go.mod h1:oDoupMAO8OvCJWAcko0GGGIgR6R6ocIYbsSw735rRwI=\n' +
            ' github.com/golang/protobuf v1.5.0/go.mod h1:FsONVRAS9T7sI+LIUmWTfcYkHO4aIWwzhcaSAoJOfIk=\n' +
            '-github.com/golang/protobuf v1.5.2 h1:ROPKBNFfQgOUMifHyP+KYbvpjbdoFNs+aK7DXlji0Tw=\n' +
            ' github.com/golang/protobuf v1.5.2/go.mod h1:XVQd3VNwM+JqD3oG2Ue2ip4fOMUkwXdXDdiuN0vRsmY=\n' +
            '+github.com/golang/protobuf v1.5.3 h1:KhyjKVUg7Usr/dYsdSqoFveMYd5ko72D+zANwlG1mmg=\n' +
            '+github.com/golang/protobuf v1.5.3/go.mod h1:XVQd3VNwM+JqD3oG2Ue2ip4fOMUkwXdXDdiuN0vRsmY=\n' +
            ' github.com/google/btree v0.0.0-20180813153112-4030bb1f1f0c/go.mod h1:lNA+9X1NB3Zf8V7Ke586lFgjr2dZNuvo3lPJSGZ5JPQ=\n' +
            ' github.com/google/btree v1.0.0/go.mod h1:lNA+9X1NB3Zf8V7Ke586lFgjr2dZNuvo3lPJSGZ5JPQ=\n' +
            ' github.com/google/go-cmp v0.2.0/go.mod h1:oXzfMopK8JAjlY9xF4vHSVASa0yLyX7SntLO5aqRK0M=',
        },
        {
          sha: '24a762f2eca36ca37474cf69aad849a7380fc6cd',
          filename: 'src/shippingservice/go.mod',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/blob/349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0/src%2Fshippingservice%2Fgo.mod',
          raw_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/raw/349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0/src%2Fshippingservice%2Fgo.mod',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/microservices-demo/contents/src%2Fshippingservice%2Fgo.mod?ref=349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0',
          patch:
            '@@ -4,7 +4,7 @@ go 1.19\n' +
            ' \n' +
            ' require (\n' +
            ' \tcloud.google.com/go/profiler v0.3.1\n' +
            '-\tgithub.com/golang/protobuf v1.5.2\n' +
            '+\tgithub.com/golang/protobuf v1.5.3\n' +
            ' \tgithub.com/sirupsen/logrus v1.9.0\n' +
            ' \tgolang.org/x/net v0.7.0\n' +
            ' \tgoogle.golang.org/grpc v1.53.0',
        },
        {
          sha: 'b9a6e985adf921b283a6471970f8c469dc3cc9a7',
          filename: 'src/shippingservice/go.sum',
          status: 'modified',
          additions: 2,
          deletions: 2,
          changes: 4,
          blob_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/blob/349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0/src%2Fshippingservice%2Fgo.sum',
          raw_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/raw/349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0/src%2Fshippingservice%2Fgo.sum',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/microservices-demo/contents/src%2Fshippingservice%2Fgo.sum?ref=349b0a18a368e67f9cf2ac5c2c21e71fcc1623c0',
          patch:
            '@@ -38,8 +38,8 @@ github.com/golang/protobuf v1.4.0/go.mod h1:jodUvKwWbYaEsadDk5Fwe5c77LiNKVO9IDvq\n' +
            ' github.com/golang/protobuf v1.4.1/go.mod h1:U8fpvMrcmy5pZrNK1lt4xCsGvpyWQ/VVv6QDs8UjoX8=\n' +
            ' github.com/golang/protobuf v1.4.3/go.mod h1:oDoupMAO8OvCJWAcko0GGGIgR6R6ocIYbsSw735rRwI=\n' +
            ' github.com/golang/protobuf v1.5.0/go.mod h1:FsONVRAS9T7sI+LIUmWTfcYkHO4aIWwzhcaSAoJOfIk=\n' +
            '-github.com/golang/protobuf v1.5.2 h1:ROPKBNFfQgOUMifHyP+KYbvpjbdoFNs+aK7DXlji0Tw=\n' +
            '-github.com/golang/protobuf v1.5.2/go.mod h1:XVQd3VNwM+JqD3oG2Ue2ip4fOMUkwXdXDdiuN0vRsmY=\n' +
            '+github.com/golang/protobuf v1.5.3 h1:KhyjKVUg7Usr/dYsdSqoFveMYd5ko72D+zANwlG1mmg=\n' +
            '+github.com/golang/protobuf v1.5.3/go.mod h1:XVQd3VNwM+JqD3oG2Ue2ip4fOMUkwXdXDdiuN0vRsmY=\n' +
            ' github.com/google/go-cmp v0.2.0/go.mod h1:oXzfMopK8JAjlY9xF4vHSVASa0yLyX7SntLO5aqRK0M=\n' +
            ' github.com/google/go-cmp v0.3.0/go.mod h1:8QqcDgzrUqlUb/G2PQTWiueGozuR1884gddMywk6iLU=\n' +
            ' github.com/google/go-cmp v0.3.1/go.mod h1:8QqcDgzrUqlUb/G2PQTWiueGozuR1884gddMywk6iLU=',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const goDependency = new GoDependency(octokit);

    assert.ok(await goDependency.checkPR(incomingPR));
  });

  it('should return true in checkPR if incoming PR does match classRules with rev or sha', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'fix(deps): update golang.org/x/net digest to f25eb7e',
      fileCount: 8,
      changedFiles: [
        {
          sha: '36c487999b5d19a4d14f5e257f9d61ee8e6af3ee',
          filename: 'src/checkoutservice/go.mod',
          status: 'modified',
          additions: 2,
          deletions: 2,
          changes: 4,
          blob_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/blob/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Fcheckoutservice%2Fgo.mod',
          raw_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/raw/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Fcheckoutservice%2Fgo.mod',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/microservices-demo/contents/src%2Fcheckoutservice%2Fgo.mod?ref=9b650925b6ed5aa698b0be06518fc2ed197835f3',
          patch:
            '@@ -7,7 +7,7 @@ require (\n' +
            ' \tgithub.com/golang/protobuf v1.5.2\n' +
            ' \tgithub.com/google/uuid v1.3.0\n' +
            ' \tgithub.com/sirupsen/logrus v1.9.0\n' +
            '-\tgolang.org/x/net v0.0.0-20221014081412-f15817d10f9b\n' +
            '+\tgolang.org/x/net v0.0.0-20221017152216-f25eb7ecb193\n' +
            ' \tgoogle.golang.org/grpc v1.50.1\n' +
            ' )\n' +
            ' \n' +
            '@@ -20,7 +20,7 @@ require (\n' +
            ' \tgithub.com/googleapis/gax-go/v2 v2.4.0 // indirect\n' +
            ' \tgo.opencensus.io v0.23.0 // indirect\n' +
            ' \tgolang.org/x/oauth2 v0.0.0-20220411215720-9780585627b5 // indirect\n' +
            '-\tgolang.org/x/sys v0.0.0-20220728004956-3c1f35247d10 // indirect\n' +
            '+\tgolang.org/x/sys v0.0.0-20221010170243-090e33056c14 // indirect\n' +
            ' \tgolang.org/x/text v0.3.7 // indirect\n' +
            ' \tgoogle.golang.org/api v0.78.0 // indirect\n' +
            ' \tgoogle.golang.org/appengine v1.6.7 // indirect',
        },
        {
          sha: 'd2644b8985a400271121084586df0996e8524cdd',
          filename: 'src/checkoutservice/go.sum',
          status: 'modified',
          additions: 4,
          deletions: 4,
          changes: 8,
          blob_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/blob/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Fcheckoutservice%2Fgo.sum',
          raw_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/raw/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Fcheckoutservice%2Fgo.sum',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/microservices-demo/contents/src%2Fcheckoutservice%2Fgo.sum?ref=9b650925b6ed5aa698b0be06518fc2ed197835f3',
          patch:
            '@@ -301,8 +301,8 @@ golang.org/x/net v0.0.0-20220225172249-27dd8689420f/go.mod h1:CfG3xpIq0wQ8r1q4Su\n' +
            ' golang.org/x/net v0.0.0-20220325170049-de3da57026de/go.mod h1:CfG3xpIq0wQ8r1q4Su4UZFWDARRcnwPjda9FqA0JpMk=\n' +
            ' golang.org/x/net v0.0.0-20220412020605-290c469a71a5/go.mod h1:CfG3xpIq0wQ8r1q4Su4UZFWDARRcnwPjda9FqA0JpMk=\n' +
            ' golang.org/x/net v0.0.0-20220425223048-2871e0cb64e4/go.mod h1:CfG3xpIq0wQ8r1q4Su4UZFWDARRcnwPjda9FqA0JpMk=\n' +
            '-golang.org/x/net v0.0.0-20221014081412-f15817d10f9b h1:tvrvnPFcdzp294diPnrdZZZ8XUt2Tyj7svb7X52iDuU=\n' +
            '-golang.org/x/net v0.0.0-20221014081412-f15817d10f9b/go.mod h1:YDH+HFinaLZZlnHAfSS6ZXJJ9M9t4Dl22yv3iI2vPwk=\n' +
            '+golang.org/x/net v0.0.0-20221017152216-f25eb7ecb193 h1:3Moaxt4TfzNcQH6DWvlYKraN1ozhBXQHcgvXjRGeim0=\n' +
            '+golang.org/x/net v0.0.0-20221017152216-f25eb7ecb193/go.mod h1:RpDiru2p0u2F0lLpEoqnP2+7xs0ifAuOcJ442g6GU2s=\n' +
            ' golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=\n' +
            ' golang.org/x/oauth2 v0.0.0-20190226205417-e64efc72b421/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=\n' +
            ' golang.org/x/oauth2 v0.0.0-20190604053449-0f29369cfe45/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=\n' +
            '@@ -391,8 +391,8 @@ golang.org/x/sys v0.0.0-20220328115105-d36c6a25d886/go.mod h1:oPkhp1MJrh7nUepCBc\n' +
            ' golang.org/x/sys v0.0.0-20220412211240-33da011f77ad/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            ' golang.org/x/sys v0.0.0-20220502124256-b6088ccd6cba/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            ' golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            '-golang.org/x/sys v0.0.0-20220728004956-3c1f35247d10 h1:WIoqL4EROvwiPdUtaip4VcDdpZ4kha7wBWZrbVKCIZg=\n' +
            '-golang.org/x/sys v0.0.0-20220728004956-3c1f35247d10/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            '+golang.org/x/sys v0.0.0-20221010170243-090e33056c14 h1:k5II8e6QD8mITdi+okbbmR/cIyEbeXLBhy5Ha4nevyc=\n' +
            '+golang.org/x/sys v0.0.0-20221010170243-090e33056c14/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            ' golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=\n' +
            ' golang.org/x/term v0.0.0-20210927222741-03fcf44c2211/go.mod h1:jbD1KX2456YbFQfuXm/mYQcufACuNUgVhRMnK/tPxf8=\n' +
            ' golang.org/x/text v0.0.0-20170915032832-14c0d48ead0c/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=',
        },
        {
          sha: 'a8d4582f012c8acf273e6ae7b92b3695f0b954af',
          filename: 'src/frontend/go.mod',
          status: 'modified',
          additions: 2,
          deletions: 2,
          changes: 4,
          blob_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/blob/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Ffrontend%2Fgo.mod',
          raw_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/raw/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Ffrontend%2Fgo.mod',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/microservices-demo/contents/src%2Ffrontend%2Fgo.mod?ref=9b650925b6ed5aa698b0be06518fc2ed197835f3',
          patch:
            '@@ -10,7 +10,7 @@ require (\n' +
            ' \tgithub.com/gorilla/mux v1.8.0\n' +
            ' \tgithub.com/pkg/errors v0.9.1\n' +
            ' \tgithub.com/sirupsen/logrus v1.9.0\n' +
            '-\tgolang.org/x/net v0.0.0-20221014081412-f15817d10f9b\n' +
            '+\tgolang.org/x/net v0.0.0-20221017152216-f25eb7ecb193\n' +
            ' \tgoogle.golang.org/grpc v1.50.1\n' +
            ' )\n' +
            ' \n' +
            '@@ -23,7 +23,7 @@ require (\n' +
            ' \tgithub.com/googleapis/gax-go/v2 v2.4.0 // indirect\n' +
            ' \tgo.opencensus.io v0.23.0 // indirect\n' +
            ' \tgolang.org/x/oauth2 v0.0.0-20220909003341-f21342109be1 // indirect\n' +
            '-\tgolang.org/x/sys v0.0.0-20220728004956-3c1f35247d10 // indirect\n' +
            '+\tgolang.org/x/sys v0.0.0-20221010170243-090e33056c14 // indirect\n' +
            ' \tgolang.org/x/text v0.3.7 // indirect\n' +
            ' \tgoogle.golang.org/api v0.96.0 // indirect\n' +
            ' \tgoogle.golang.org/appengine v1.6.7 // indirect',
        },
        {
          sha: '5a7dad92e2d35fce016ba5453ca167e30b5719f6',
          filename: 'src/frontend/go.sum',
          status: 'modified',
          additions: 4,
          deletions: 3,
          changes: 7,
          blob_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/blob/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Ffrontend%2Fgo.sum',
          raw_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/raw/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Ffrontend%2Fgo.sum',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/microservices-demo/contents/src%2Ffrontend%2Fgo.sum?ref=9b650925b6ed5aa698b0be06518fc2ed197835f3',
          patch:
            '@@ -315,8 +315,8 @@ golang.org/x/net v0.0.0-20220425223048-2871e0cb64e4/go.mod h1:CfG3xpIq0wQ8r1q4Su\n' +
            ' golang.org/x/net v0.0.0-20220607020251-c690dde0001d/go.mod h1:XRhObCWvk6IyKnWLug+ECip1KBveYUHfp+8e9klMJ9c=\n' +
            ' golang.org/x/net v0.0.0-20220624214902-1bab6f366d9e/go.mod h1:XRhObCWvk6IyKnWLug+ECip1KBveYUHfp+8e9klMJ9c=\n' +
            ' golang.org/x/net v0.0.0-20220909164309-bea034e7d591/go.mod h1:YDH+HFinaLZZlnHAfSS6ZXJJ9M9t4Dl22yv3iI2vPwk=\n' +
            '-golang.org/x/net v0.0.0-20221014081412-f15817d10f9b h1:tvrvnPFcdzp294diPnrdZZZ8XUt2Tyj7svb7X52iDuU=\n' +
            '-golang.org/x/net v0.0.0-20221014081412-f15817d10f9b/go.mod h1:YDH+HFinaLZZlnHAfSS6ZXJJ9M9t4Dl22yv3iI2vPwk=\n' +
            '+golang.org/x/net v0.0.0-20221017152216-f25eb7ecb193 h1:3Moaxt4TfzNcQH6DWvlYKraN1ozhBXQHcgvXjRGeim0=\n' +
            '+golang.org/x/net v0.0.0-20221017152216-f25eb7ecb193/go.mod h1:RpDiru2p0u2F0lLpEoqnP2+7xs0ifAuOcJ442g6GU2s=\n' +
            ' golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=\n' +
            ' golang.org/x/oauth2 v0.0.0-20190226205417-e64efc72b421/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=\n' +
            ' golang.org/x/oauth2 v0.0.0-20190604053449-0f29369cfe45/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=\n' +
            '@@ -412,8 +412,9 @@ golang.org/x/sys v0.0.0-20220503163025-988cb79eb6c6/go.mod h1:oPkhp1MJrh7nUepCBc\n' +
            ' golang.org/x/sys v0.0.0-20220520151302-bc2c85ada10a/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            ' golang.org/x/sys v0.0.0-20220610221304-9f5ed59c137d/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            ' golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            '-golang.org/x/sys v0.0.0-20220728004956-3c1f35247d10 h1:WIoqL4EROvwiPdUtaip4VcDdpZ4kha7wBWZrbVKCIZg=\n' +
            ' golang.org/x/sys v0.0.0-20220728004956-3c1f35247d10/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            '+golang.org/x/sys v0.0.0-20221010170243-090e33056c14 h1:k5II8e6QD8mITdi+okbbmR/cIyEbeXLBhy5Ha4nevyc=\n' +
            '+golang.org/x/sys v0.0.0-20221010170243-090e33056c14/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            ' golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=\n' +
            ' golang.org/x/term v0.0.0-20210927222741-03fcf44c2211/go.mod h1:jbD1KX2456YbFQfuXm/mYQcufACuNUgVhRMnK/tPxf8=\n' +
            ' golang.org/x/text v0.0.0-20170915032832-14c0d48ead0c/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=',
        },
        {
          sha: '4219be7ed56dabd3d158f77c9807d6843e256052',
          filename: 'src/productcatalogservice/go.mod',
          status: 'modified',
          additions: 2,
          deletions: 2,
          changes: 4,
          blob_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/blob/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Fproductcatalogservice%2Fgo.mod',
          raw_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/raw/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Fproductcatalogservice%2Fgo.mod',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/microservices-demo/contents/src%2Fproductcatalogservice%2Fgo.mod?ref=9b650925b6ed5aa698b0be06518fc2ed197835f3',
          patch:
            '@@ -7,7 +7,7 @@ require (\n' +
            ' \tgithub.com/golang/protobuf v1.5.2\n' +
            ' \tgithub.com/google/go-cmp v0.5.9\n' +
            ' \tgithub.com/sirupsen/logrus v1.9.0\n' +
            '-\tgolang.org/x/net v0.0.0-20221014081412-f15817d10f9b\n' +
            '+\tgolang.org/x/net v0.0.0-20221017152216-f25eb7ecb193\n' +
            ' \tgoogle.golang.org/grpc v1.50.1\n' +
            ' )\n' +
            ' \n' +
            '@@ -19,7 +19,7 @@ require (\n' +
            ' \tgithub.com/googleapis/gax-go/v2 v2.4.0 // indirect\n' +
            ' \tgo.opencensus.io v0.23.0 // indirect\n' +
            ' \tgolang.org/x/oauth2 v0.0.0-20220411215720-9780585627b5 // indirect\n' +
            '-\tgolang.org/x/sys v0.0.0-20220728004956-3c1f35247d10 // indirect\n' +
            '+\tgolang.org/x/sys v0.0.0-20221010170243-090e33056c14 // indirect\n' +
            ' \tgolang.org/x/text v0.3.7 // indirect\n' +
            ' \tgoogle.golang.org/api v0.78.0 // indirect\n' +
            ' \tgoogle.golang.org/appengine v1.6.7 // indirect',
        },
        {
          sha: 'f31eb5d6e6650e54f7905b17623e5dd82da36e61',
          filename: 'src/productcatalogservice/go.sum',
          status: 'modified',
          additions: 4,
          deletions: 4,
          changes: 8,
          blob_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/blob/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Fproductcatalogservice%2Fgo.sum',
          raw_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/raw/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Fproductcatalogservice%2Fgo.sum',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/microservices-demo/contents/src%2Fproductcatalogservice%2Fgo.sum?ref=9b650925b6ed5aa698b0be06518fc2ed197835f3',
          patch:
            '@@ -301,8 +301,8 @@ golang.org/x/net v0.0.0-20220225172249-27dd8689420f/go.mod h1:CfG3xpIq0wQ8r1q4Su\n' +
            ' golang.org/x/net v0.0.0-20220325170049-de3da57026de/go.mod h1:CfG3xpIq0wQ8r1q4Su4UZFWDARRcnwPjda9FqA0JpMk=\n' +
            ' golang.org/x/net v0.0.0-20220412020605-290c469a71a5/go.mod h1:CfG3xpIq0wQ8r1q4Su4UZFWDARRcnwPjda9FqA0JpMk=\n' +
            ' golang.org/x/net v0.0.0-20220425223048-2871e0cb64e4/go.mod h1:CfG3xpIq0wQ8r1q4Su4UZFWDARRcnwPjda9FqA0JpMk=\n' +
            '-golang.org/x/net v0.0.0-20221014081412-f15817d10f9b h1:tvrvnPFcdzp294diPnrdZZZ8XUt2Tyj7svb7X52iDuU=\n' +
            '-golang.org/x/net v0.0.0-20221014081412-f15817d10f9b/go.mod h1:YDH+HFinaLZZlnHAfSS6ZXJJ9M9t4Dl22yv3iI2vPwk=\n' +
            '+golang.org/x/net v0.0.0-20221017152216-f25eb7ecb193 h1:3Moaxt4TfzNcQH6DWvlYKraN1ozhBXQHcgvXjRGeim0=\n' +
            '+golang.org/x/net v0.0.0-20221017152216-f25eb7ecb193/go.mod h1:RpDiru2p0u2F0lLpEoqnP2+7xs0ifAuOcJ442g6GU2s=\n' +
            ' golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=\n' +
            ' golang.org/x/oauth2 v0.0.0-20190226205417-e64efc72b421/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=\n' +
            ' golang.org/x/oauth2 v0.0.0-20190604053449-0f29369cfe45/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=\n' +
            '@@ -391,8 +391,8 @@ golang.org/x/sys v0.0.0-20220328115105-d36c6a25d886/go.mod h1:oPkhp1MJrh7nUepCBc\n' +
            ' golang.org/x/sys v0.0.0-20220412211240-33da011f77ad/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            ' golang.org/x/sys v0.0.0-20220502124256-b6088ccd6cba/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            ' golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            '-golang.org/x/sys v0.0.0-20220728004956-3c1f35247d10 h1:WIoqL4EROvwiPdUtaip4VcDdpZ4kha7wBWZrbVKCIZg=\n' +
            '-golang.org/x/sys v0.0.0-20220728004956-3c1f35247d10/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            '+golang.org/x/sys v0.0.0-20221010170243-090e33056c14 h1:k5II8e6QD8mITdi+okbbmR/cIyEbeXLBhy5Ha4nevyc=\n' +
            '+golang.org/x/sys v0.0.0-20221010170243-090e33056c14/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            ' golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=\n' +
            ' golang.org/x/term v0.0.0-20210927222741-03fcf44c2211/go.mod h1:jbD1KX2456YbFQfuXm/mYQcufACuNUgVhRMnK/tPxf8=\n' +
            ' golang.org/x/text v0.0.0-20170915032832-14c0d48ead0c/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=',
        },
        {
          sha: '2b3a395a7bba05709c4e282ea31edae28c05669a',
          filename: 'src/shippingservice/go.mod',
          status: 'modified',
          additions: 2,
          deletions: 2,
          changes: 4,
          blob_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/blob/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Fshippingservice%2Fgo.mod',
          raw_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/raw/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Fshippingservice%2Fgo.mod',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/microservices-demo/contents/src%2Fshippingservice%2Fgo.mod?ref=9b650925b6ed5aa698b0be06518fc2ed197835f3',
          patch:
            '@@ -6,7 +6,7 @@ require (\n' +
            ' \tcloud.google.com/go/profiler v0.3.0\n' +
            ' \tgithub.com/golang/protobuf v1.5.2\n' +
            ' \tgithub.com/sirupsen/logrus v1.9.0\n' +
            '-\tgolang.org/x/net v0.0.0-20221014081412-f15817d10f9b\n' +
            '+\tgolang.org/x/net v0.0.0-20221017152216-f25eb7ecb193\n' +
            ' \tgoogle.golang.org/grpc v1.50.1\n' +
            ' )\n' +
            ' \n' +
            '@@ -19,7 +19,7 @@ require (\n' +
            ' \tgithub.com/googleapis/gax-go/v2 v2.4.0 // indirect\n' +
            ' \tgo.opencensus.io v0.23.0 // indirect\n' +
            ' \tgolang.org/x/oauth2 v0.0.0-20220411215720-9780585627b5 // indirect\n' +
            '-\tgolang.org/x/sys v0.0.0-20220728004956-3c1f35247d10 // indirect\n' +
            '+\tgolang.org/x/sys v0.0.0-20221010170243-090e33056c14 // indirect\n' +
            ' \tgolang.org/x/text v0.3.7 // indirect\n' +
            ' \tgoogle.golang.org/api v0.78.0 // indirect\n' +
            ' \tgoogle.golang.org/appengine v1.6.7 // indirect',
        },
        {
          sha: '73a0ab19e7d4c18e9bf89b7f2ed5947dda5f4503',
          filename: 'src/shippingservice/go.sum',
          status: 'modified',
          additions: 4,
          deletions: 4,
          changes: 8,
          blob_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/blob/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Fshippingservice%2Fgo.sum',
          raw_url:
            'https://github.com/GoogleCloudPlatform/microservices-demo/raw/9b650925b6ed5aa698b0be06518fc2ed197835f3/src%2Fshippingservice%2Fgo.sum',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/microservices-demo/contents/src%2Fshippingservice%2Fgo.sum?ref=9b650925b6ed5aa698b0be06518fc2ed197835f3',
          patch:
            '@@ -300,8 +300,8 @@ golang.org/x/net v0.0.0-20220225172249-27dd8689420f/go.mod h1:CfG3xpIq0wQ8r1q4Su\n' +
            ' golang.org/x/net v0.0.0-20220325170049-de3da57026de/go.mod h1:CfG3xpIq0wQ8r1q4Su4UZFWDARRcnwPjda9FqA0JpMk=\n' +
            ' golang.org/x/net v0.0.0-20220412020605-290c469a71a5/go.mod h1:CfG3xpIq0wQ8r1q4Su4UZFWDARRcnwPjda9FqA0JpMk=\n' +
            ' golang.org/x/net v0.0.0-20220425223048-2871e0cb64e4/go.mod h1:CfG3xpIq0wQ8r1q4Su4UZFWDARRcnwPjda9FqA0JpMk=\n' +
            '-golang.org/x/net v0.0.0-20221014081412-f15817d10f9b h1:tvrvnPFcdzp294diPnrdZZZ8XUt2Tyj7svb7X52iDuU=\n' +
            '-golang.org/x/net v0.0.0-20221014081412-f15817d10f9b/go.mod h1:YDH+HFinaLZZlnHAfSS6ZXJJ9M9t4Dl22yv3iI2vPwk=\n' +
            '+golang.org/x/net v0.0.0-20221017152216-f25eb7ecb193 h1:3Moaxt4TfzNcQH6DWvlYKraN1ozhBXQHcgvXjRGeim0=\n' +
            '+golang.org/x/net v0.0.0-20221017152216-f25eb7ecb193/go.mod h1:RpDiru2p0u2F0lLpEoqnP2+7xs0ifAuOcJ442g6GU2s=\n' +
            ' golang.org/x/oauth2 v0.0.0-20180821212333-d2e6202438be/go.mod h1:N/0e6XlmueqKjAGxoOufVs8QHGRruUQn6yWY3a++T0U=\n' +
            ' golang.org/x/oauth2 v0.0.0-20190226205417-e64efc72b421/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=\n' +
            ' golang.org/x/oauth2 v0.0.0-20190604053449-0f29369cfe45/go.mod h1:gOpvHmFTYa4IltrdGE7lF6nIHvwfUNPOp7c8zoXwtLw=\n' +
            '@@ -390,8 +390,8 @@ golang.org/x/sys v0.0.0-20220328115105-d36c6a25d886/go.mod h1:oPkhp1MJrh7nUepCBc\n' +
            ' golang.org/x/sys v0.0.0-20220412211240-33da011f77ad/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            ' golang.org/x/sys v0.0.0-20220502124256-b6088ccd6cba/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            ' golang.org/x/sys v0.0.0-20220715151400-c0bba94af5f8/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            '-golang.org/x/sys v0.0.0-20220728004956-3c1f35247d10 h1:WIoqL4EROvwiPdUtaip4VcDdpZ4kha7wBWZrbVKCIZg=\n' +
            '-golang.org/x/sys v0.0.0-20220728004956-3c1f35247d10/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            '+golang.org/x/sys v0.0.0-20221010170243-090e33056c14 h1:k5II8e6QD8mITdi+okbbmR/cIyEbeXLBhy5Ha4nevyc=\n' +
            '+golang.org/x/sys v0.0.0-20221010170243-090e33056c14/go.mod h1:oPkhp1MJrh7nUepCBck5+mAzfO9JrbApNNgaTdGDITg=\n' +
            ' golang.org/x/term v0.0.0-20201126162022-7de9c90e9dd1/go.mod h1:bj7SfCRtBDWHUb9snDiAeCFNEtKQo2Wmx5Cou7ajbmo=\n' +
            ' golang.org/x/term v0.0.0-20210927222741-03fcf44c2211/go.mod h1:jbD1KX2456YbFQfuXm/mYQcufACuNUgVhRMnK/tPxf8=\n' +
            ' golang.org/x/text v0.0.0-20170915032832-14c0d48ead0c/go.mod h1:NqM8EUOU14njkJ3fqMW+pc6Ldnwhi/IjpwHt7yyuwOQ=',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const goDependency = new GoDependency(octokit);

    assert.ok(await goDependency.checkPR(incomingPR));
  });
});
