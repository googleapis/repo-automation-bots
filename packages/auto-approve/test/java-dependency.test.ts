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
const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
});
describe('behavior of Java Dependency process', () => {
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
    const javaDependency = new JavaDependency(octokit);

    assert.deepStrictEqual(await javaDependency.checkPR(incomingPR), false);
  });

  it('should return false in checkPR if one of the files did not match additional rules in fileRules', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'fix(deps): update dependency cloud.google.com to v16',
      fileCount: 3,
      changedFiles: [
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
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const javaDependency = new JavaDependency(octokit);

    assert.deepStrictEqual(await javaDependency.checkPR(incomingPR), false);
  });

  it('should return true in checkPR if incoming PR does match classRules - pom.xml', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title:
        'fix(deps): update dependency com.google.cloud:google-cloud-datacatalog to v16',
      fileCount: 3,
      changedFiles: [
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
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const javaDependency = new JavaDependency(octokit);

    assert.ok(await javaDependency.checkPR(incomingPR));
  });

  it('should return true in checkPR if incoming PR does match classRules - build.gradle - grpc version', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title:
        'chore(deps): update dependency io.grpc:protoc-gen-grpc-java to v1.40.1',
      fileCount: 3,
      changedFiles: [
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'iam/api-client/build.gradle',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '   }\n' +
            ' }\n' +
            ' \n' +
            "-def grpcVersion = '1.0.3'\n" +
            "+def grpcVersion = '1.40.1'\n" +
            ' \n' +
            ' dependencies {\n' +
            '   repositories {',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const javaDependency = new JavaDependency(octokit);

    assert.ok(await javaDependency.checkPR(incomingPR));
  });

  it('should return true in checkPR if incoming PR does match classRules - build.gradle - classpath', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title:
        'chore(deps): update dependency com.google.cloud.tools:endpoints-framework-gradle-plugin to v1.0.3',
      fileCount: 3,
      changedFiles: [
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'iam/api-client/build.gradle',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '   }\n' +
            ' \n' +
            '   dependencies {\n' +
            "-    classpath 'com.google.cloud.tools:endpoints-framework-gradle-plugin:1.0.2'\n" +
            "+    classpath 'com.google.cloud.tools:endpoints-framework-gradle-plugin:1.0.3'\n" +
            "     classpath 'com.google.cloud.tools:appengine-gradle-plugin:2.2.0'\n" +
            '   }\n' +
            ' }',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const javaDependency = new JavaDependency(octokit);

    assert.ok(await javaDependency.checkPR(incomingPR));
  });

  it('should return true in checkPR if incoming PR does match classRules - build.gradle - invoker', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title:
        'chore(deps): update dependency com.google.cloud.functions.invoker:java-function-invoker to v1.0.2',
      fileCount: 3,
      changedFiles: [
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'iam/api-client/build.gradle',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            "   compileOnly 'com.google.cloud.functions:functions-framework-api:1.0.1'\n" +
            ' \n' +
            "   // To run function locally using Functions Framework's local invoker\n" +
            "-  invoker 'com.google.cloud.functions.invoker:java-function-invoker:1.0.0-alpha-2-rc5'\n" +
            "+  invoker 'com.google.cloud.functions.invoker:java-function-invoker:1.0.2'\n",
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const javaDependency = new JavaDependency(octokit);

    assert.ok(await javaDependency.checkPR(incomingPR));
  });

  it('should return true in checkPR if incoming PR does match classRules - pom.xml - apiary update', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title:
        'chore(deps): update dependency com.google.apis:google-api-services-cloudiot to v1-rev20210816-1.32.1',
      fileCount: 3,
      changedFiles: [
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'iam/api-client/pom.xml',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '     <dependency>\n' +
            '       <groupId>com.google.apis</groupId>\n' +
            '       <artifactId>google-api-services-cloudiot</artifactId>\n' +
            '-      <version>v1-rev20210809-1.32.1</version>\n' +
            '+      <version>v1-rev20210816-1.32.1</version>\n' +
            '     </dependency>\n' +
            '     <dependency>\n' +
            '       <groupId>com.google.cloud</groupId>',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const javaDependency = new JavaDependency(octokit);

    assert.ok(await javaDependency.checkPR(incomingPR));
  });
});
