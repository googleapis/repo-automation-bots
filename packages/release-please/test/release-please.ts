// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {api} from '../src/release-please';
const myProbotApp = api.handler;
import {Runner} from '../src/runner';
import {describe, it, beforeEach} from 'mocha';
import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Probot, createProbot, ProbotOctokit} from 'probot';
import {
  PullRequestLabeledEvent,
  PullRequestClosedEvent,
  PullRequestReopenedEvent,
} from '@octokit/webhooks-types';
import * as fs from 'fs';
import yaml from 'js-yaml';
import * as sinon from 'sinon';
import * as botConfigModule from '@google-automations/bot-config-utils';
import nock from 'nock';
// eslint-disable-next-line node/no-extraneous-import
import {RequestError} from '@octokit/request-error';
import {Errors, Manifest, GitHub} from 'release-please';

const sandbox = sinon.createSandbox();
nock.disableNetConnect();
const fixturesPath = resolve(__dirname, '../../test/fixtures');

function loadConfig(configFile: string) {
  return yaml.load(
    fs.readFileSync(resolve(fixturesPath, 'config', configFile), 'utf-8')
  );
}

describe('ReleasePleaseBot', () => {
  let probot: Probot;
  let getConfigStub: sinon.SinonStub;
  let createPullRequestsStub: sinon.SinonStub;
  let createReleasesStub: sinon.SinonStub;

  beforeEach(() => {
    probot = createProbot({
      overrides: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
      },
    });
    probot.load(myProbotApp);
    getConfigStub = sandbox.stub(botConfigModule, 'getConfig');
    createPullRequestsStub = sandbox.stub(Runner, 'createPullRequests');
    createReleasesStub = sandbox.stub(Runner, 'createReleases');
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  describe('push to master branch', () => {
    let payload: {};

    beforeEach(() => {
      payload = require(resolve(fixturesPath, './push_to_master'));
    });

    describe('without manifest', () => {
      let fromConfigStub: sinon.SinonStub;
      beforeEach(async () => {
        const fakeGitHub = await GitHub.create({
          owner: 'fake',
          repo: 'fake',
          defaultBranch: 'main',
        });
        const fakeManifest = new Manifest(fakeGitHub, 'main', {}, {});
        fromConfigStub = sandbox
          .stub(Manifest, 'fromConfig')
          .resolves(fakeManifest);
      });

      it('should build a release PR', async () => {
        getConfigStub.resolves(loadConfig('valid.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match.has('releaseType', 'java-yoshi'),
          sinon.match.any,
          undefined
        );
      });

      it('should handle GitHub releases, if configured', async () => {
        getConfigStub.resolves(loadConfig('valid_handle_gh_release.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.calledOnce(createReleasesStub);
      });

      it('should ignore duplicated GitHub releases', async () => {
        const error = new Errors.DuplicateReleaseError(
          new RequestError('foo', 400, {
            response: {
              data: 'something',
              status: 400,
              url: 'https://foo.bar',
              headers: {},
            },
            request: {
              method: 'POST',
              url: 'https://foo.bar',
              headers: {},
            },
          }),
          'abc'
        );
        createReleasesStub.rejects(error);

        getConfigStub.resolves(loadConfig('valid_handle_gh_release.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.calledOnce(createReleasesStub);
      });

      it('should ignore configuration errors', async () => {
        const error = new Errors.MissingRequiredFileError(
          'versions.txt',
          'YoshiJava',
          'testOwner/testRepo'
        );
        createPullRequestsStub.rejects(error);

        getConfigStub.resolves(loadConfig('valid_handle_gh_release.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.calledOnce(createReleasesStub);
      });

      it('should ignore if the branch is not the configured primary branch', async () => {
        getConfigStub.resolves(loadConfig('feature_branch_as_primary.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.notCalled(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
      });

      it('should allow overriding the release strategy from configuration', async () => {
        getConfigStub.resolves(loadConfig('ruby_release.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match.has('releaseType', 'ruby'),
          sinon.match.any,
          undefined
        );
      });

      it('should allow overriding the package-name from configuration', async () => {
        getConfigStub.resolves(
          loadConfig('ruby_release_alternate_pkg_name.yml')
        );
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match({
            releaseType: 'ruby-yoshi',
            packageName: '@google-cloud/foo',
          }),
          sinon.match.any,
          undefined
        );
      });

      it('should allow overriding the release tags from configuration', async () => {
        getConfigStub.resolves(loadConfig('valid.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match.any,
          sinon.match.has('labels', ['foo', 'bar']),
          undefined
        );
      });

      it('should allow overriding the release label when creating a release', async () => {
        getConfigStub.resolves(loadConfig('override_release_tag.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.calledOnce(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match.any,
          sinon.match.has('releaseLabels', ['autorelease: published']),
          undefined
        );
      });

      it('should ignore webhook if not configured', async () => {
        getConfigStub.resolves(null);
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.notCalled(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
      });

      it('should allow an empty config file with the defaults', async () => {
        getConfigStub.resolves({});
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
      });

      it('should allow configuring minor bump for breaking change pre 1.0', async () => {
        getConfigStub.resolves(loadConfig('minor_pre_major.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match.has('bumpMinorPreMajor', true),
          sinon.match.any,
          undefined
        );
      });

      it('should allow configuring patch bump for feature changes pre 1.0', async () => {
        getConfigStub.resolves(loadConfig('patch_pre_major.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match.has('bumpPatchForMinorPreMajor', true),
          sinon.match.any,
          undefined
        );
      });

      it('should detect the default branch if not specified in configuration', async () => {
        getConfigStub.resolves(
          loadConfig('release_type_no_primary_branch.yml')
        );
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
      });

      it('should allow configuring extra files', async () => {
        getConfigStub.resolves(loadConfig('extra_files.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match.has('extraFiles', ['src/com/google/foo/Version.java']),
          sinon.match.any,
          undefined
        );
      });

      it('should allow configuring draft releases', async () => {
        getConfigStub.resolves(loadConfig('draft_releases.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match.has('draft', true),
          sinon.match.any,
          undefined
        );
      });

      it('should allow configuring draft pull requests', async () => {
        getConfigStub.resolves(loadConfig('draft_pull_requests.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match.has('draftPullRequest', true),
          sinon.match.any,
          undefined
        );
      });

      it('should allow configuring pull request title', async () => {
        getConfigStub.resolves(loadConfig('custom_title.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match.has(
            'pullRequestTitlePattern',
            'chore: release ${component} ${version}'
          ),
          sinon.match.any,
          undefined
        );
      });

      it('should allow configuring version file', async () => {
        getConfigStub.resolves(loadConfig('version_file.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match.has('versionFile', 'VERSION'),
          sinon.match.any,
          undefined
        );
      });

      it('should allow configuring versioning strategy', async () => {
        getConfigStub.resolves(loadConfig('versioning.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match.has('versioning', 'always-bump-patch'),
          sinon.match.any,
          undefined
        );
      });

      it('should allow configuring changelog notes type', async () => {
        getConfigStub.resolves(loadConfig('changelog_type.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match.has('changelogType', 'github'),
          sinon.match.any,
          undefined
        );
      });
    });

    describe('for manifest releases', () => {
      let fromManifestStub: sinon.SinonStub;
      beforeEach(async () => {
        const fakeGitHub = await GitHub.create({
          owner: 'fake',
          repo: 'fake',
          defaultBranch: 'main',
        });
        const fakeManifest = new Manifest(fakeGitHub, 'main', {}, {});
        fromManifestStub = sandbox
          .stub(Manifest, 'fromManifest')
          .resolves(fakeManifest);
      });

      it('should build a release PR', async () => {
        getConfigStub.resolves(loadConfig('manifest.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnce(fromManifestStub);
      });

      it('should handle GitHub releases, if configured', async () => {
        getConfigStub.resolves(loadConfig('manifest_handle_gh_release.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.calledOnce(createReleasesStub);
        sinon.assert.calledOnce(fromManifestStub);
      });

      it('should ignore the repo language not being supported', async () => {
        payload = require(resolve(
          fixturesPath,
          './push_to_master_weird_language'
        ));
        getConfigStub.resolves(loadConfig('manifest.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnce(fromManifestStub);
      });

      it('should allow customizing the manifest config file and path', async () => {
        getConfigStub.resolves(loadConfig('manifest_custom_paths.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromManifestStub,
          sinon.match.instanceOf(GitHub),
          'master',
          'path/to/config.json',
          'path/to/manifest.json'
        );
      });
    });
  });

  describe('push to non-master branch', () => {
    let payload: {};

    beforeEach(() => {
      payload = require(resolve(fixturesPath, './push_to_non_master'));
    });

    describe('without manifest', () => {
      let fromConfigStub: sinon.SinonStub;
      beforeEach(async () => {
        const fakeGitHub = await GitHub.create({
          owner: 'fake',
          repo: 'fake',
          defaultBranch: 'main',
        });
        const fakeManifest = new Manifest(fakeGitHub, 'main', {}, {});
        fromConfigStub = sandbox
          .stub(Manifest, 'fromConfig')
          .resolves(fakeManifest);
      });

      it('should ignore the webhook', async () => {
        getConfigStub.resolves(loadConfig('valid.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.notCalled(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
      });

      it('should create the PR if the branch is the configured primary branch', async () => {
        getConfigStub.resolves(loadConfig('feature_branch_as_primary.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'feature-branch',
          sinon.match.has('releaseType', 'java-yoshi'),
          sinon.match.any,
          undefined
        );
      });

      it('should create the PR if the branch is configured as an alternate branch', async () => {
        getConfigStub.resolves(loadConfig('multi_branch.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'feature-branch',
          sinon.match.has('releaseType', 'java-yoshi'),
          sinon.match.any,
          undefined
        );
      });

      it('should handle GitHub releases, if configured', async () => {
        getConfigStub.resolves(
          loadConfig('valid_handle_gh_release_alternate_branch.yml')
        );
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.calledOnce(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'feature-branch',
          sinon.match.has('releaseType', 'java-yoshi'),
          sinon.match.any,
          undefined
        );
      });
    });
  });

  describe('pull-request labeled event', () => {
    let fromConfigStub: sinon.SinonStub;
    beforeEach(async () => {
      const fakeGitHub = await GitHub.create({
        owner: 'fake',
        repo: 'fake',
        defaultBranch: 'main',
      });
      const fakeManifest = new Manifest(fakeGitHub, 'main', {}, {});
      fromConfigStub = sandbox
        .stub(Manifest, 'fromConfig')
        .resolves(fakeManifest);
    });

    it('should try to create a release', async () => {
      const payload = require(resolve(fixturesPath, './pull_request_labeled'));
      getConfigStub.resolves(loadConfig('valid.yml'));
      const requests = nock('https://api.github.com')
        .delete(
          '/repos/Codertocat/Hello-World/issues/2/labels/release-please%3Aforce-run'
        )
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload: payload as PullRequestLabeledEvent,
        id: 'abc123',
      });

      requests.done();
      sinon.assert.calledOnce(createPullRequestsStub);
      sinon.assert.notCalled(createReleasesStub);
      sinon.assert.calledOnceWithExactly(
        fromConfigStub,
        sinon.match.instanceOf(GitHub),
        'master',
        sinon.match.has('releaseType', 'java-yoshi'),
        sinon.match.any,
        undefined
      );
    });

    it('should try to create a release on an alternate branch', async () => {
      const payload = require(resolve(
        fixturesPath,
        './pull_request_labeled_feature_branch'
      ));
      getConfigStub.resolves(loadConfig('multi_branch.yml'));
      const requests = nock('https://api.github.com')
        .delete(
          '/repos/Codertocat/Hello-World/issues/2/labels/release-please%3Aforce-run'
        )
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload: payload as PullRequestLabeledEvent,
        id: 'abc123',
      });

      requests.done();
      sinon.assert.calledOnce(createPullRequestsStub);
      sinon.assert.notCalled(createReleasesStub);
      sinon.assert.calledOnceWithExactly(
        fromConfigStub,
        sinon.match.instanceOf(GitHub),
        'feature-branch',
        sinon.match.has('releaseType', 'java-yoshi'),
        sinon.match.any,
        undefined
      );
    });

    it('should ignore other labels', async () => {
      const payload = require(resolve(
        fixturesPath,
        './pull_request_labeled_other'
      ));
      await probot.receive({
        name: 'pull_request',
        payload: payload as PullRequestLabeledEvent,
        id: 'abc123',
      });

      sinon.assert.notCalled(createPullRequestsStub);
      sinon.assert.notCalled(createReleasesStub);
    });
  });

  describe('pull request closed', () => {
    let payload: {};

    it('should try to mark closed', async () => {
      payload = require(resolve(fixturesPath, './pr_closed'));
      getConfigStub.resolves(loadConfig('valid.yml'));
      const requests = nock('https://api.github.com')
        .delete(
          '/repos/testOwner/testRepo/issues/12/labels/autorelease%3A%20pending'
        )
        .reply(200)
        .post('/repos/testOwner/testRepo/issues/12/labels')
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload: payload as PullRequestClosedEvent,
        id: 'abc123',
      });

      requests.done();
    });

    it('should ignore non-release pull requests', async () => {
      payload = require(resolve(fixturesPath, './pr_closed_non_release'));
      getConfigStub.resolves(loadConfig('valid.yml'));

      await probot.receive({
        name: 'pull_request',
        payload: payload as PullRequestClosedEvent,
        id: 'abc123',
      });
    });

    it('should ignore merged pull requests', async () => {
      payload = require(resolve(fixturesPath, './pr_merged'));
      getConfigStub.resolves(loadConfig('valid.yml'));

      await probot.receive({
        name: 'pull_request',
        payload: payload as PullRequestClosedEvent,
        id: 'abc123',
      });
    });
  });

  describe('pull request reopened', () => {
    let payload: {};

    it('should try to mark pending', async () => {
      payload = require(resolve(fixturesPath, './pr_reopened'));
      getConfigStub.resolves(loadConfig('valid.yml'));
      const requests = nock('https://api.github.com')
        .delete(
          '/repos/testOwner/testRepo/issues/12/labels/autorelease%3A%20closed'
        )
        .reply(200)
        .post('/repos/testOwner/testRepo/issues/12/labels')
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload: payload as PullRequestReopenedEvent,
        id: 'abc123',
      });

      requests.done();
    });

    it('should ignore non-release pull requests', async () => {
      payload = require(resolve(fixturesPath, './pr_reopened_non_release'));
      getConfigStub.resolves(loadConfig('valid.yml'));

      await probot.receive({
        name: 'pull_request',
        payload: payload as PullRequestReopenedEvent,
        id: 'abc123',
      });
    });
  });
});
