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

import {PythonSampleDependency} from '../src/process-checks/python/sample-dependency';
import {describe, it} from 'mocha';
import assert from 'assert';

const {Octokit} = require('@octokit/rest');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
});

describe('behavior of Python Sample Dependency process', () => {
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
    const pythonDependency = new PythonSampleDependency(octokit);

    assert.deepStrictEqual(await pythonDependency.checkPR(incomingPR), false);
  });

  it('should return false in checkPR if one of the files did not match additional rules in fileRules', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'fix(deps): update dependency cloud.google.com to v16',
      fileCount: 3,
      changedFiles: [
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
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };

    const pythonDependency = new PythonSampleDependency(octokit);

    assert.deepStrictEqual(await pythonDependency.checkPR(incomingPR), false);
  });

  it('should return false if a stated dependency changes an API in exclude list', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'fix(deps): update dependency google-cloud-storage to v16',
      fileCount: 3,
      changedFiles: [
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'composer/workflows/requirements.txt',
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
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };

    const pythonDependency = new PythonSampleDependency(octokit);

    assert.deepStrictEqual(await pythonDependency.checkPR(incomingPR), false);
  });

  it('should return false if the dependency changed is in the exclude list', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'chore(deps): update dependency django-environ to v0.9.0',
      fileCount: 3,
      changedFiles: [
        {
          sha: '1349c83bf3c20b102da7ce85ebd384e0822354f3',
          filename: 'workflows/requirements.txt',
          additions: 1,
          deletions: 1,
          changes: 2,
          patch:
            '@@ -1,2 +1,2 @@\n' +
            ' google-cloud-videointelligence==2.5.1\n' +
            '-airflow==0.7.0\n' +
            '+airflow==0.9.0',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };

    const pythonDependency = new PythonSampleDependency(octokit);

    assert.deepStrictEqual(await pythonDependency.checkPR(incomingPR), false);
  });

  it('should return true in checkPR if incoming PR does match classRules', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'fix(deps): update dependency google-cloud-storage to v16',
      fileCount: 1,
      changedFiles: [
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
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };

    const pythonDependency = new PythonSampleDependency(octokit);

    assert.ok(await pythonDependency.checkPR(incomingPR));
  });

  it('should return true in checkPR if incoming PR matches for dependabot', async () => {
    const incomingPR = {
      author: 'dependabot[bot]',
      title:
        'chore(deps): bump django from 4.1.7 to 4.1.13 in /appengine/standard_python3/bundled-services/blobstore/django',
      fileCount: 1,
      changedFiles: [
        {
          sha: '7238a9cd2d395d453b1ebb6278440a99574e055e',
          filename:
            'appengine/standard_python3/bundled-services/blobstore/django/requirements.txt',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/python-docs-samples/blob/57fe78fbf19010405481f129646fa16904a4b413/appengine%2Fstandard_python3%2Fbundled-services%2Fblobstore%2Fdjango%2Frequirements.txt',
          raw_url:
            'https://github.com/GoogleCloudPlatform/python-docs-samples/raw/57fe78fbf19010405481f129646fa16904a4b413/appengine%2Fstandard_python3%2Fbundled-services%2Fblobstore%2Fdjango%2Frequirements.txt',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/python-docs-samples/contents/appengine%2Fstandard_python3%2Fbundled-services%2Fblobstore%2Fdjango%2Frequirements.txt?ref=57fe78fbf19010405481f129646fa16904a4b413',
          patch:
            '@@ -1,5 +1,5 @@\n' +
            ' Django==3.2.18; python_version<"3.8"\n' +
            '-Django==4.1.7; python_version>"3.7"\n' +
            '+Django==4.1.13; python_version>"3.7"\n' +
            ' django-environ==0.10.0\n' +
            ' google-cloud-logging==3.5.0\n' +
            ' appengine-python-standard>=0.2.3\n' +
            '\\ No newline at end of file',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };

    const pythonDependency = new PythonSampleDependency(octokit);

    assert.ok(await pythonDependency.checkPR(incomingPR));
  });
});
