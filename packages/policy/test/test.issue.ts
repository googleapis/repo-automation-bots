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

import nock from 'nock';
import {describe, it} from 'mocha';
import * as sinon from 'sinon';
import * as gh from '../src/issue';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';

nock.disableNetConnect();

const octokit = new Octokit();
const githubHost = 'https://api.github.com';

describe('issue', () => {
  const repo = 'nodejs-storage';
  const org = 'googleapis';
  const policyResult = {
    repo,
    org,
    topics: [],
    language: 'dart',
    hasRenovateConfig: true,
    hasValidLicense: true,
    hasCodeOfConduct: true,
    hasContributing: true,
    hasCodeowners: true,
    hasBranchProtection: true,
    hasMergeCommitsDisabled: true,
    hasSecurityPolicy: true,
    hasMainDefault: true,
    timestamp: new Date(),
  };

  afterEach(() => {
    sinon.restore();
    nock.cleanAll();
  });

  it('should create a new issue if the results are invalid', async () => {
    const invalidResult = Object.assign({}, policyResult);
    invalidResult.hasContributing = false;
    const scope = nock(githubHost)
      .get(`/repos/${org}/${repo}/issues?state=open`)
      .reply(200, [])
      .post(`/repos/${org}/${repo}/issues`)
      .reply(200);
    await gh.openIssue(octokit, invalidResult);
    scope.done();
  });

  it('should not create a new issue if results are valid', async () => {
    const scope = nock(githubHost)
      .get(`/repos/${org}/${repo}/issues?state=open`)
      .reply(200, []);
    await gh.openIssue(octokit, policyResult);
    scope.done();
  });

  it('should close an open issue if suddenly valid', async () => {
    const scope = nock(githubHost)
      .get(`/repos/${org}/${repo}/issues?state=open`)
      .reply(200, [
        {
          title: '[Policy Bot] hello',
        },
      ])
      .patch(`/repos/${org}/${repo}/issues/`)
      .reply(200);
    await gh.openIssue(octokit, policyResult);
    scope.done();
  });

  it('should update the body if validity changes', async () => {
    const invalidResult = Object.assign({}, policyResult);
    invalidResult.hasContributing = false;
    const scope = nock(githubHost)
      .get(`/repos/${org}/${repo}/issues?state=open`)
      .reply(200, [])
      .post(`/repos/${org}/${repo}/issues`)
      .reply(200);
    await gh.openIssue(octokit, invalidResult);
    scope.done();
  });
});
