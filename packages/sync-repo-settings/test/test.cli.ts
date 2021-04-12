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
import {Octokit} from '@octokit/rest';
import * as cli from '../src/cli';
import yargs from 'yargs';

nock.disableNetConnect();

describe('cli', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should succeed 1', () => {
    assert.ok(true);
  });

  it('should throw if no token is available', async () => {
    process.env.GITHUB_TOKEN = '';
    process.env.GH_TOKEN = '';
    try {
      const argv = await cli.parser.fail((msg: string, err: Error, yargs: yargs.Argv) => {
        throw new Error(msg);
      }).parse('--repo=testOwner/testRepo');
      assert.fail('should not get here');
    } catch (e) {
      console.log(e.toString());
    }

  });

  it('should succeed', () => {
    assert.ok(true);
  });

  // it('should show help if no flags are passed', async () => {
  //   process.env.GH_TOKEN = 'token';
  //   const showHelp = sinon.stub();
  //   const m = ({
  //     showHelp,
  //     flags: {},
  //   } as unknown) as meow.Result<{}>;
  //   await cli.main(m);
  //   assert.ok(showHelp.calledOnce);
  // });

  // it('should call getRepo if passed a single repo', async () => {
  //   process.env.GH_TOKEN = 'token';
  //   const p = new policy.Policy(new Octokit(), console);
  //   const repoMetadata = {} as policy.GitHubRepo;
  //   const policyMetadata = {} as policy.PolicyResult;
  //   const getRepoStub = sinon.stub(p, 'getRepo').resolves(repoMetadata);
  //   const checkRepoPolicyStub = sinon
  //     .stub(p, 'checkRepoPolicy')
  //     .resolves(policyMetadata);
  //   const getPolicyStub = sinon.stub(policy, 'getPolicy').returns(p);
  //   const m = ({
  //     flags: {
  //       repo: 'googleapis/nodejs-storage',
  //     },
  //   } as unknown) as meow.Result<{}>;
  //   await cli.main(m);
  //   assert.ok(getRepoStub.calledOnce);
  //   assert.ok(getPolicyStub.calledOnce);
  //   assert.ok(checkRepoPolicyStub.calledOnce);
  // });

  // it('should attempt to autofix if asked nicely', async () => {
  //   process.env.GH_TOKEN = 'token';
  //   const p = new policy.Policy(new Octokit(), console);
  //   const repoMetadata = {} as policy.GitHubRepo;
  //   const policyMetadata = {} as policy.PolicyResult;
  //   sinon.stub(p, 'getRepo').resolves(repoMetadata);
  //   sinon.stub(p, 'checkRepoPolicy').resolves(policyMetadata);
  //   sinon.stub(policy, 'getPolicy').returns(p);
  //   const fixStub = sinon.stub(changer, 'submitFixes').resolves();
  //   const m = ({
  //     flags: {
  //       repo: 'googleapis/nodejs-storage',
  //       autofix: true,
  //     },
  //   } as unknown) as meow.Result<{}>;
  //   await cli.main(m);
  //   assert.ok(fixStub.calledOnce);
  // });

  // it('should attempt to export if asked nicely', async () => {
  //   process.env.GH_TOKEN = 'token';
  //   const p = new policy.Policy(new Octokit(), console);
  //   const repoMetadata = {} as policy.GitHubRepo;
  //   const policyMetadata = {} as policy.PolicyResult;
  //   sinon.stub(p, 'getRepo').resolves(repoMetadata);
  //   sinon.stub(p, 'checkRepoPolicy').resolves(policyMetadata);
  //   sinon.stub(policy, 'getPolicy').returns(p);
  //   const exportStub = sinon.stub(bq, 'exportToBigQuery').resolves();
  //   const m = ({
  //     flags: {
  //       repo: 'googleapis/nodejs-storage',
  //       export: true,
  //     },
  //   } as unknown) as meow.Result<{}>;
  //   await cli.main(m);
  //   assert.ok(exportStub.calledOnce);
  // });
});
