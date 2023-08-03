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

import {JavaSampleAppDependency} from '../src/process-checks/sample-application-repos/java-dependency';
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
    const javaDependency = new JavaSampleAppDependency(octokit);

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
    const javaDependency = new JavaSampleAppDependency(octokit);

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
    const javaDependency = new JavaSampleAppDependency(octokit);

    assert.ok(await javaDependency.checkPR(incomingPR));
  });

  it('should return true in checkPR if incoming PR does match classRules, even if not google dep - pom.xml', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title:
        'chore(deps): update dependency org.apache.maven.plugins:maven-surefire-plugin to v3.1.2',
      fileCount: 4,
      changedFiles: [
        {
          sha: 'c3345af4f4180d3aa807cefed416ab40a81019b2',
          filename: 'src/ledger/balancereader/pom.xml',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '@@ -192,7 +192,7 @@\n' +
            '             <plugin>\n' +
            '                 <groupId>org.apache.maven.plugins</groupId>\n' +
            '                 <artifactId>maven-surefire-plugin</artifactId>\n' +
            '-                <version>3.1.0</version>\n' +
            '+                <version>3.1.2</version>\n' +
            '             </plugin>\n' +
            '             <plugin>\n' +
            '                 <groupId>org.apache.maven.plugins</groupId>',
        },
        {
          sha: '0d5c203c35a15ef6e493efa0babfe8da70ead507',
          filename: 'src/ledger/ledgerwriter/pom.xml',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '@@ -182,7 +182,7 @@\n' +
            '             <plugin>\n' +
            '                 <groupId>org.apache.maven.plugins</groupId>\n' +
            '                 <artifactId>maven-surefire-plugin</artifactId>\n' +
            '-                <version>3.1.0</version>\n' +
            '+                <version>3.1.2</version>\n' +
            '             </plugin>\n' +
            '             <plugin>\n' +
            '                 <groupId>org.apache.maven.plugins</groupId>',
        },
        {
          sha: '1e73623ed7cc9b1b5411a61d6db663fea387d7ec',
          filename: 'src/ledger/transactionhistory/pom.xml',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '@@ -193,7 +193,7 @@\n' +
            '             <plugin>\n' +
            '                 <groupId>org.apache.maven.plugins</groupId>\n' +
            '                 <artifactId>maven-surefire-plugin</artifactId>\n' +
            '-                <version>3.1.0</version>\n' +
            '+                <version>3.1.2</version>\n' +
            '             </plugin>\n' +
            '             <plugin>\n' +
            '                 <groupId>org.apache.maven.plugins</groupId>',
        },
        {
          sha: '5f177ec9f3c453e1278e9f3db9042447c09dbdbb',
          filename: 'src/ledgermonolith/pom.xml',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '@@ -169,7 +169,7 @@\n' +
            '             <plugin>\n' +
            '                 <groupId>org.apache.maven.plugins</groupId>\n' +
            '                 <artifactId>maven-surefire-plugin</artifactId>\n' +
            '-                <version>3.1.0</version>\n' +
            '+                <version>3.1.2</version>\n' +
            '             </plugin>\n' +
            '             <plugin>\n' +
            '                 <groupId>org.apache.maven.plugins</groupId>',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const javaDependency = new JavaSampleAppDependency(octokit);

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
    const javaDependency = new JavaSampleAppDependency(octokit);

    assert.ok(await javaDependency.checkPR(incomingPR));
  });
});
