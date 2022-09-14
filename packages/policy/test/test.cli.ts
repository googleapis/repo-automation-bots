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
import {describe, it, afterEach} from 'mocha';
import assert from 'assert';
import sinon from 'sinon';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';
import * as policy from '../src/policy';
import {parser} from '../src/cli';
import * as changer from '../src/changer';
import * as bq from '../src/export';
import * as gh from '../src/issue';

nock.disableNetConnect();

const sandbox = sinon.createSandbox();
const testParser = parser.exitProcess(false);

describe('cli', () => {
  let cacheGitHubToken: string | undefined;
  let cacheGHToken: string | undefined;
  afterEach(() => {
    sandbox.restore();
  });
  before(() => {
    cacheGitHubToken = process.env.GITHUB_TOKEN;
    cacheGHToken = process.env.GH_TOKEN;
  });
  after(() => {
    process.env.GITHUB_TOKEN = cacheGitHubToken;
    process.env.GH_TOKEN = cacheGHToken;
  });
  afterEach(() => {
    sinon.restore();
  });
  it('should throw if no token is available', async () => {
    sandbox.replace(process, 'env', {
      GITHUB_TOKEN: '',
      GH_TOKEN: '',
    });

    await assert.rejects(async () => {
      await testParser.parseAsync('--repo=testOwner/testRepo');
    }, /The GITHUB_TOKEN or GH_TOKEN env var/);
  });

  it('should show help if no flags are passed', async () => {
    sandbox.replace(process, 'env', {
      GH_TOKEN: 'token',
    });
    await assert.rejects(async () => {
      await testParser.parseAsync('');
    }, /Need to provide either --repo or --search option/);
  });

  it('should call getRepo if passed a single repo', async () => {
    sandbox.replace(process, 'env', {
      GH_TOKEN: 'token',
    });
    const p = new policy.Policy(new Octokit(), console);
    const repoMetadata = {} as policy.GitHubRepo;
    const policyMetadata = {} as policy.PolicyResult;
    const getRepoStub = sandbox.stub(p, 'getRepo').resolves(repoMetadata);
    const checkRepoPolicyStub = sinon
      .stub(p, 'checkRepoPolicy')
      .resolves(policyMetadata);
    const getPolicyStub = sandbox.stub(policy, 'getPolicy').returns(p);

    await testParser.parseAsync('--repo=googleapis/nodejs-storage');

    assert.ok(getRepoStub.calledOnce);
    assert.ok(getPolicyStub.calledOnce);
    assert.ok(checkRepoPolicyStub.calledOnce);
  });

  it('should attempt to autofix if asked nicely', async () => {
    sandbox.replace(process, 'env', {
      GH_TOKEN: 'token',
    });
    const repoMetadata = {
      full_name: 'googleapis/nodejs-storage',
    } as policy.GitHubRepo;
    const p = new policy.Policy(new Octokit(), console);
    const c = new changer.Changer(new Octokit(), repoMetadata);
    const policyMetadata = {} as policy.PolicyResult;
    sandbox.stub(p, 'getRepo').resolves(repoMetadata);
    sandbox.stub(p, 'checkRepoPolicy').resolves(policyMetadata);
    sandbox.stub(policy, 'getPolicy').returns(p);
    sandbox.stub(changer, 'getChanger').returns(c);
    const fixStub = sandbox.stub(c, 'submitFixes').resolves();

    await testParser.parseAsync('--repo=googleapis/nodejs-storage --autofix');
    assert.ok(fixStub.calledOnce);
  });

  it('should attempt to export if asked nicely', async () => {
    sandbox.replace(process, 'env', {
      GH_TOKEN: 'token',
    });
    const p = new policy.Policy(new Octokit(), console);
    const repoMetadata = {
      full_name: 'googleapis/nodejs-storage',
    } as policy.GitHubRepo;
    const policyMetadata = {} as policy.PolicyResult;
    sandbox.stub(p, 'getRepo').resolves(repoMetadata);
    sandbox.stub(p, 'checkRepoPolicy').resolves(policyMetadata);
    sandbox.stub(policy, 'getPolicy').returns(p);
    const exportStub = sandbox.stub(bq, 'exportToBigQuery').resolves();

    await testParser.parseAsync('--repo=googleapis/nodejs-storage --export');
    assert.ok(exportStub.calledOnce);
  });

  it('should attempt to file an issue if asked nicely', async () => {
    sandbox.replace(process, 'env', {
      GH_TOKEN: 'token',
    });
    const p = new policy.Policy(new Octokit(), console);
    const repoMetadata = {
      full_name: 'googleapis/nodejs-storage',
    } as policy.GitHubRepo;
    const policyMetadata = {} as policy.PolicyResult;
    sandbox.stub(p, 'getRepo').resolves(repoMetadata);
    sandbox.stub(p, 'checkRepoPolicy').resolves(policyMetadata);
    sandbox.stub(policy, 'getPolicy').returns(p);
    const reportStub = sandbox.stub(gh, 'openIssue').resolves();

    await testParser.parseAsync('--repo=googleapis/nodejs-storage --report');
    assert.ok(reportStub.calledOnce);
  });
});
