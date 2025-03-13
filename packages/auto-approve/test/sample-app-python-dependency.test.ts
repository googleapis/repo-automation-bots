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

import {PythonSampleAppDependency} from '../src/process-checks/sample-application-repos/python-dependency';
import {describe, it} from 'mocha';
import assert from 'assert';

const {Octokit} = require('@octokit/rest');
const fetch = require('node-fetch');

const octokit = new Octokit({
  auth: 'mypersonalaccesstoken123',
  request: {fetch},
});

describe('behavior of Python Sample App Dependency process', () => {
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
    const pythonSampleAppDependency = new PythonSampleAppDependency(octokit);

    assert.deepStrictEqual(
      await pythonSampleAppDependency.checkPR(incomingPR),
      false
    );
  });

  it('should return false in checkPR if one of the files did not match additional rules in fileRules', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'chore(deps): update dependency urllib3 to v1.26.15',
      fileCount: 3,
      changedFiles: [
        {
          sha: '8133bad3cd1959eab88184d08a4d7688cc4f3080',
          filename: 'src/loadgenerator/requirements.exe',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Floadgenerator%2Frequirements.txt',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Floadgenerator%2Frequirements.txt',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Floadgenerator%2Frequirements.txt?ref=6389eea9f9e2f10cbb1ce82db51786b9611fd7d8',
          patch:
            '@@ -61,7 +61,7 @@ six==1.16.0\n' +
            '     #   geventhttpclient\n' +
            ' typing-extensions==4.5.0\n' +
            '     # via locust\n' +
            '-urllib3==1.26.14\n' +
            '+urllib3==1.26.15\n' +
            '     # via requests\n' +
            ' werkzeug==2.2.3\n' +
            '     # via',
        },
        {
          sha: '53f548499f42c6e2c5c32a2e11ccf79cd3c45a35',
          filename: 'src/userservice/requirements.in',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Fuserservice%2Frequirements.in',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Fuserservice%2Frequirements.in',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Fuserservice%2Frequirements.in?ref=6389eea9f9e2f10cbb1ce82db51786b9611fd7d8',
          patch:
            '@@ -44,7 +44,7 @@ requests==2.28.2\n' +
            ' rsa==4.9\n' +
            ' six==1.16.0\n' +
            ' sqlalchemy==1.4.46\n' +
            '-urllib3==1.26.14\n' +
            '+urllib3==1.26.15\n' +
            ' wcwidth==0.2.6\n' +
            ' webencodings==0.5.1\n' +
            ' werkzeug==2.2.3',
        },
        {
          sha: '1f060821cf73adf8c503ebcaff209a45b17db170',
          filename: 'src/userservice/requirements.txt',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Fuserservice%2Frequirements.txt',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Fuserservice%2Frequirements.txt',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Fuserservice%2Frequirements.txt?ref=6389eea9f9e2f10cbb1ce82db51786b9611fd7d8',
          patch:
            '@@ -200,7 +200,7 @@ sqlalchemy==1.4.46\n' +
            '     # via -r requirements.in\n' +
            ' typing-extensions==4.5.0\n' +
            '     # via opentelemetry-sdk\n' +
            '-urllib3==1.26.14\n' +
            '+urllib3==1.26.15\n' +
            '     # via\n' +
            '     #   -r requirements.in\n' +
            '     #   requests',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const pythonSampleAppDependency = new PythonSampleAppDependency(octokit);

    assert.deepStrictEqual(
      await pythonSampleAppDependency.checkPR(incomingPR),
      false
    );
  });

  it('should return true in checkPR if incoming PR does match classRules', async () => {
    const incomingPR = {
      author: 'renovate-bot',
      title: 'chore(deps): update dependency urllib3 to v1.26.15',
      fileCount: 7,
      changedFiles: [
        {
          sha: '53f548499f42c6e2c5c32a2e11ccf79cd3c45a35',
          filename: 'src/contacts/requirements.in',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Fcontacts%2Frequirements.in',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Fcontacts%2Frequirements.in',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Fcontacts%2Frequirements.in?ref=6389eea9f9e2f10cbb1ce82db51786b9611fd7d8',
          patch:
            '@@ -44,7 +44,7 @@ requests==2.28.2\n' +
            ' rsa==4.9\n' +
            ' six==1.16.0\n' +
            ' sqlalchemy==1.4.46\n' +
            '-urllib3==1.26.14\n' +
            '+urllib3==1.26.15\n' +
            ' wcwidth==0.2.6\n' +
            ' webencodings==0.5.1\n' +
            ' werkzeug==2.2.3',
        },
        {
          sha: '1f060821cf73adf8c503ebcaff209a45b17db170',
          filename: 'src/contacts/requirements.txt',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Fcontacts%2Frequirements.txt',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Fcontacts%2Frequirements.txt',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Fcontacts%2Frequirements.txt?ref=6389eea9f9e2f10cbb1ce82db51786b9611fd7d8',
          patch:
            '@@ -200,7 +200,7 @@ sqlalchemy==1.4.46\n' +
            '     # via -r requirements.in\n' +
            ' typing-extensions==4.5.0\n' +
            '     # via opentelemetry-sdk\n' +
            '-urllib3==1.26.14\n' +
            '+urllib3==1.26.15\n' +
            '     # via\n' +
            '     #   -r requirements.in\n' +
            '     #   requests',
        },
        {
          sha: '6919d313cc2023c66a5da15c1a9e3d1193331b99',
          filename: 'src/frontend/requirements.in',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Ffrontend%2Frequirements.in',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Ffrontend%2Frequirements.in',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Ffrontend%2Frequirements.in?ref=6389eea9f9e2f10cbb1ce82db51786b9611fd7d8',
          patch:
            '@@ -1,6 +1,6 @@\n' +
            ' flask==2.2.3\n' +
            ' requests==2.28.2\n' +
            '-urllib3==1.26.14\n' +
            '+urllib3==1.26.15\n' +
            ' pyjwt==2.6.0\n' +
            ' cryptography==39.0.2\n' +
            ' gunicorn==20.1.0',
        },
        {
          sha: '0b3daec5e1e293eb73f2af17fc4de918f419c5ce',
          filename: 'src/frontend/requirements.txt',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Ffrontend%2Frequirements.txt',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Ffrontend%2Frequirements.txt',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Ffrontend%2Frequirements.txt?ref=6389eea9f9e2f10cbb1ce82db51786b9611fd7d8',
          patch:
            '@@ -120,7 +120,7 @@ six==1.16.0\n' +
            '     # via google-auth\n' +
            ' typing-extensions==4.5.0\n' +
            '     # via opentelemetry-sdk\n' +
            '-urllib3==1.26.14\n' +
            '+urllib3==1.26.15\n' +
            '     # via\n' +
            '     #   -r requirements.in\n' +
            '     #   requests',
        },
        {
          sha: '8133bad3cd1959eab88184d08a4d7688cc4f3080',
          filename: 'src/loadgenerator/requirements.txt',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Floadgenerator%2Frequirements.txt',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Floadgenerator%2Frequirements.txt',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Floadgenerator%2Frequirements.txt?ref=6389eea9f9e2f10cbb1ce82db51786b9611fd7d8',
          patch:
            '@@ -61,7 +61,7 @@ six==1.16.0\n' +
            '     #   geventhttpclient\n' +
            ' typing-extensions==4.5.0\n' +
            '     # via locust\n' +
            '-urllib3==1.26.14\n' +
            '+urllib3==1.26.15\n' +
            '     # via requests\n' +
            ' werkzeug==2.2.3\n' +
            '     # via',
        },
        {
          sha: '53f548499f42c6e2c5c32a2e11ccf79cd3c45a35',
          filename: 'src/userservice/requirements.in',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Fuserservice%2Frequirements.in',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Fuserservice%2Frequirements.in',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Fuserservice%2Frequirements.in?ref=6389eea9f9e2f10cbb1ce82db51786b9611fd7d8',
          patch:
            '@@ -44,7 +44,7 @@ requests==2.28.2\n' +
            ' rsa==4.9\n' +
            ' six==1.16.0\n' +
            ' sqlalchemy==1.4.46\n' +
            '-urllib3==1.26.14\n' +
            '+urllib3==1.26.15\n' +
            ' wcwidth==0.2.6\n' +
            ' webencodings==0.5.1\n' +
            ' werkzeug==2.2.3',
        },
        {
          sha: '1f060821cf73adf8c503ebcaff209a45b17db170',
          filename: 'src/userservice/requirements.txt',
          status: 'modified',
          additions: 1,
          deletions: 1,
          changes: 2,
          blob_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/blob/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Fuserservice%2Frequirements.txt',
          raw_url:
            'https://github.com/GoogleCloudPlatform/bank-of-anthos/raw/6389eea9f9e2f10cbb1ce82db51786b9611fd7d8/src%2Fuserservice%2Frequirements.txt',
          contents_url:
            'https://api.github.com/repos/GoogleCloudPlatform/bank-of-anthos/contents/src%2Fuserservice%2Frequirements.txt?ref=6389eea9f9e2f10cbb1ce82db51786b9611fd7d8',
          patch:
            '@@ -200,7 +200,7 @@ sqlalchemy==1.4.46\n' +
            '     # via -r requirements.in\n' +
            ' typing-extensions==4.5.0\n' +
            '     # via opentelemetry-sdk\n' +
            '-urllib3==1.26.14\n' +
            '+urllib3==1.26.15\n' +
            '     # via\n' +
            '     #   -r requirements.in\n' +
            '     #   requests',
        },
      ],
      repoName: 'testRepoName',
      repoOwner: 'testRepoOwner',
      prNumber: 1,
      body: 'body',
    };
    const pythonSampleAppDependency = new PythonSampleAppDependency(octokit);

    assert.ok(await pythonSampleAppDependency.checkPR(incomingPR));
  });
});
