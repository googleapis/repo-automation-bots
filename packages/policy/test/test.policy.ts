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
import {getPolicy, GitHubRepo, githubRawBase} from '../src/policy';
import assert from 'assert';
import sinon from 'sinon';
// eslint-disable-next-line node/no-extraneous-import
import {Octokit} from '@octokit/rest';

nock.disableNetConnect();

const githubHost = 'https://api.github.com';
const octokit = new Octokit();
const policy = getPolicy(octokit, console);

describe('policy', () => {
  afterEach(() => {
    sinon.restore();
    nock.cleanAll();
  });

  it('should get a single repo metadata', async () => {
    const repo = 'googleapis/nodejs-storage';
    const res = {hello: 'world'};
    const scope = nock(githubHost).get(`/repos/${repo}`).reply(200, res);
    const metadata = await policy.getRepo(repo);
    assert.deepStrictEqual(metadata, res);
    scope.done();
  });

  it('should get a list of github repos based on search filter', async () => {
    const search = 'org:googleapis is:public archived:false';
    const items = [{hello: 'world'}];
    const res = {items};
    const scope = nock(githubHost)
      .get(`/search/repositories?page=1&per_page=100&q=${search}`)
      .reply(200, res);
    const metadata = await policy.getRepos(search);
    assert.deepStrictEqual(metadata, items);
    scope.done();
  });

  it('should warn for incomplete test results', async () => {
    const search = 'org:googleapis is:public archived:false';
    const res = {incomplete_results: true, items: []};
    const scope = nock(githubHost)
      .get(`/search/repositories?page=1&per_page=100&q=${search}`)
      .reply(200, res);
    const stub = sinon.stub(console, 'warn');
    await policy.getRepos(search);
    scope.done();
    assert.ok(stub.getCalls()[0].firstArg.startsWith('Incomplete results'));
  });

  it('should perform a basic file exists check', async () => {
    const file = 'test.file';
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
    } as GitHubRepo;
    const rootUrl = `/${repo.full_name}/${repo.default_branch}/${file}`;
    const scope = nock(githubRawBase).get(rootUrl).reply(200);
    const exists = await policy.checkFileExists(repo, file, false);
    assert.ok(exists);
    scope.done();
  });

  it('should perform a file exists check in the .github dir', async () => {
    const file = 'test.file';
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
    } as GitHubRepo;
    const rootUrl = `/${repo.full_name}/${repo.default_branch}/${file}`;
    const magicUrl = `/${repo.full_name}/${repo.default_branch}/.github/${file}`;
    const scope = nock(githubRawBase)
      .get(rootUrl)
      .reply(404)
      .get(magicUrl)
      .reply(200);
    const exists = await policy.checkFileExists(repo, file, true);
    assert.ok(exists);
    scope.done();
  });

  it('should check for renovate', async () => {
    const files = ['renovate.json', 'renovate.json5'];
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
    } as GitHubRepo;
    const scopes = files.map(file => {
      const fileUrl = `/${repo.full_name}/${repo.default_branch}/${file}`;
      const magicUrl = `/${repo.full_name}/${repo.default_branch}/.github/${file}`;
      return nock(githubRawBase)
        .get(fileUrl)
        .reply(200)
        .get(magicUrl)
        .reply(404);
    });
    const hasRenovate = await policy.hasRenovate(repo);
    assert.ok(hasRenovate);
    scopes.forEach(x => x.done());
  });

  it('should check for CODEOWNERS', async () => {
    const file = 'CODEOWNERS';
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
    } as GitHubRepo;
    const fileUrl = `/${repo.full_name}/${repo.default_branch}/${file}`;
    const magicUrl = `/${repo.full_name}/${repo.default_branch}/.github/${file}`;
    const scope = nock(githubRawBase)
      .get(fileUrl)
      .reply(200)
      .get(magicUrl)
      .reply(404);
    const good = await policy.hasCodeOwners(repo);
    assert.ok(good);
    scope.done();
  });

  it('should check for CODE_OF_CONDUCT', async () => {
    const file = 'CODE_OF_CONDUCT.md';
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
    } as GitHubRepo;
    const fileUrl = `/${repo.full_name}/${repo.default_branch}/${file}`;
    const magicUrl = `/${repo.full_name}/${repo.default_branch}/.github/${file}`;
    const scope = nock(githubRawBase)
      .get(fileUrl)
      .reply(200)
      .get(magicUrl)
      .reply(404);
    const good = await policy.hasCodeOfConduct(repo);
    assert.ok(good);
    scope.done();
  });

  it('should check for SECURITY', async () => {
    const file = 'SECURITY.md';
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
    } as GitHubRepo;
    const fileUrl = `/${repo.full_name}/${repo.default_branch}/${file}`;
    const magicUrl = `/${repo.full_name}/${repo.default_branch}/.github/${file}`;
    const scope = nock(githubRawBase)
      .get(fileUrl)
      .reply(200)
      .get(magicUrl)
      .reply(404);
    const good = await policy.hasSecurityPolicy(repo);
    assert.ok(good);
    scope.done();
  });

  it('should check for CONTRIBUTING.md', async () => {
    const file = 'CONTRIBUTING.md';
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
    } as GitHubRepo;
    const fileUrl = `/${repo.full_name}/${repo.default_branch}/${file}`;
    const magicUrl = `/${repo.full_name}/${repo.default_branch}/.github/${file}`;
    const scope = nock(githubRawBase)
      .get(fileUrl)
      .reply(200)
      .get(magicUrl)
      .reply(404);
    const good = await policy.hasContributing(repo);
    assert.ok(good);
    scope.done();
  });

  it('should check happy path branch protection', async () => {
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
    } as GitHubRepo;
    const res = {
      required_pull_request_reviews: {
        require_code_owner_reviews: true,
      },
      required_status_checks: {
        contexts: ['check1'],
      },
    };
    const url = `/repos/${repo.full_name}/branches/${repo.default_branch}/protection`;
    const scope = nock(githubHost).get(url).reply(200, res);
    const good = await policy.hasBranchProtection(repo);
    assert.ok(good);
    scope.done();
  });

  it('should fail branch protection on non 2xx response', async () => {
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
    } as GitHubRepo;
    const url = `/repos/${repo.full_name}/branches/${repo.default_branch}/protection`;
    const scope = nock(githubHost).get(url).reply(403);
    const good = await policy.hasBranchProtection(repo);
    assert.ok(!good);
    scope.done();
  });

  it('should fail branch protection on missing required reviews', async () => {
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
    } as GitHubRepo;
    const res = {
      required_status_checks: {
        contexts: ['check1'],
      },
    };
    const url = `/repos/${repo.full_name}/branches/${repo.default_branch}/protection`;
    const scope = nock(githubHost).get(url).reply(200, res);
    const good = await policy.hasBranchProtection(repo);
    assert.ok(!good);
    scope.done();
  });

  it('should fail branch protection on missing CODEOWNERS', async () => {
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
    } as GitHubRepo;
    const res = {
      required_pull_request_reviews: {
        required_approving_review_count: 1,
      },
      required_status_checks: {
        contexts: ['check1'],
      },
    };
    const url = `/repos/${repo.full_name}/branches/${repo.default_branch}/protection`;
    const scope = nock(githubHost).get(url).reply(200, res);
    const good = await policy.hasBranchProtection(repo);
    assert.ok(!good);
    scope.done();
  });

  it('should fail branch protection on missing status checks', async () => {
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
    } as GitHubRepo;
    const res = {
      required_pull_request_reviews: {
        require_code_owner_reviews: true,
        required_approving_review_count: 1,
      },
    };
    const url = `/repos/${repo.full_name}/branches/${repo.default_branch}/protection`;
    const scope = nock(githubHost).get(url).reply(200, res);
    const good = await policy.hasBranchProtection(repo);
    assert.ok(!good);
    scope.done();
  });

  it('should check for disabled merge commits', async () => {
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
      allow_merge_commit: false,
    } as GitHubRepo;
    const disabled = await policy.hasMergeCommitsDisabled(repo);
    assert.ok(disabled);
  });

  it('should check for a valid license', async () => {
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
      license: {
        key: 'beerpl',
      },
    } as GitHubRepo;
    const isValid = await policy.hasLicense(repo);
    assert.ok(!isValid);
  });

  it('should check for main as the default branch', async () => {
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'master',
    } as GitHubRepo;
    const isValid = await policy.hasMainDefault(repo);
    assert.ok(!isValid);
  });

  it('should check for all policy checks', async () => {
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
      license: {
        key: 'beerpl',
      },
      language: 'ruby',
    } as GitHubRepo;

    // we've already individually tested all of these functions, so stub them
    const stubs = [
      sinon.stub(policy, 'hasRenovate').resolves(true),
      sinon.stub(policy, 'hasLicense').resolves(true),
      sinon.stub(policy, 'hasCodeOfConduct').resolves(true),
      sinon.stub(policy, 'hasContributing').resolves(true),
      sinon.stub(policy, 'hasCodeOwners').resolves(true),
      sinon.stub(policy, 'hasBranchProtection').resolves(true),
      sinon.stub(policy, 'hasMergeCommitsDisabled').resolves(true),
      sinon.stub(policy, 'hasSecurityPolicy').resolves(true),
      sinon.stub(policy, 'hasMainDefault').resolves(true),
    ];
    const result = await policy.checkRepoPolicy(repo);
    const [org, name] = repo.full_name.split('/');
    const expected = {
      repo: name,
      org,
      topics: [],
      language: repo.language,
      hasRenovateConfig: true,
      hasValidLicense: true,
      hasCodeOfConduct: true,
      hasContributing: true,
      hasCodeowners: true,
      hasBranchProtection: true,
      hasMergeCommitsDisabled: true,
      hasSecurityPolicy: true,
      hasMainDefault: true,
      timestamp: result.timestamp,
    };
    assert.deepStrictEqual(result, expected);
    stubs.forEach(x => assert.ok(x.calledOnce));
  });

  it('should raise error if grabbing file tracked by policy fails', async () => {
    const repo = {
      full_name: 'googleapis/nodejs-storage',
      default_branch: 'main',
      license: {
        key: 'beerpl',
      },
      language: 'ruby',
    } as GitHubRepo;

    const getSecurityMd = nock('https://raw.githubusercontent.com')
      .get('/googleapis/nodejs-storage/main/SECURITY.md')
      .reply(200)
      .get('/googleapis/nodejs-storage/main/.github/SECURITY.md')
      .reply(502);

    // we've already individually tested all of these functions, so stub them
    const stubs = [
      sinon.stub(policy, 'hasRenovate').resolves(true),
      sinon.stub(policy, 'hasLicense').resolves(true),
      sinon.stub(policy, 'hasCodeOfConduct').resolves(true),
      sinon.stub(policy, 'hasContributing').resolves(true),
      sinon.stub(policy, 'hasCodeOwners').resolves(true),
      sinon.stub(policy, 'hasBranchProtection').resolves(true),
      sinon.stub(policy, 'hasMergeCommitsDisabled').resolves(true),
      sinon.stub(policy, 'hasMainDefault').resolves(true),
    ];
    await assert.rejects(policy.checkRepoPolicy(repo), /received 502 fetching/);
    getSecurityMd.done();
  });
});
