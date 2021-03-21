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

import {Octokit} from '@octokit/rest';
import nock from 'nock';
import sinon from 'sinon';
import assert from 'assert';
import {URL} from 'url';
import {describe, it, afterEach} from 'mocha';
import * as suggester from 'code-suggester';
import {PolicyResult} from '../src/policy';
import * as changer from '../src/changer';

nock.disableNetConnect();

describe('changer', () => {
  afterEach(() => {
    nock.cleanAll();
    sinon.restore();
  });

  it('should get a code of conduct', async () => {
    const cocText = 'coc';
    const url = new URL(changer.cocUrl);
    const scope = nock(url.origin).get(url.pathname).reply(200, cocText);
    const coc = await changer.getCoC();
    assert.strictEqual(coc, cocText);
    scope.done();
  });

  it('should submit code of conduct fixes', async () => {
    const octokit = new Octokit();
    const result: PolicyResult = {
      repo: 'nodejs-storage',
      org: 'googleapis',
      language: 'ruby',
      topics: [],
      hasBranchProtection: true,
      hasCodeOfConduct: false,
      hasCodeowners: true,
      hasContributing: true,
      hasMergeCommitsDisabled: true,
      hasRenovateConfig: true,
      hasSecurityPolicy: true,
      hasValidLicense: true,
      timestamp: new Date(),
    };
    const stub = sinon.stub(suggester, 'createPullRequest').resolves();
    await changer.submitFixes(result, octokit);
    assert.ok(stub.calledOnce);
  });
});
