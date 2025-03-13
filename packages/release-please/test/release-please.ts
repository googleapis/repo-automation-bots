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
import * as fs from 'fs';
import yaml from 'js-yaml';
import * as sinon from 'sinon';
import * as botConfigModule from '@google-automations/bot-config-utils';
import * as gcfUtilsModule from 'gcf-utils';
import * as datastoreLockModule from '@google-automations/datastore-lock';
import nock from 'nock';
// eslint-disable-next-line node/no-extraneous-import
import {RequestError} from '@octokit/request-error';
import {Errors, Manifest, GitHub} from 'release-please';
import * as errorHandlingModule from '@google-automations/issue-utils';
import {Octokit} from '@octokit/rest';
const fetch = require('node-fetch');

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
  let createLightweightTagStub: sinon.SinonStub;

  beforeEach(() => {
    probot = createProbot({
      overrides: {
        githubToken: 'abc123',
        Octokit: ProbotOctokit.defaults({
          retry: {enabled: false},
          throttle: {enabled: false},
        }),
        request: {fetch},
      },
    });
    probot.load(myProbotApp);
    getConfigStub = sandbox.stub(botConfigModule, 'getConfig');
    createPullRequestsStub = sandbox.stub(Runner, 'createPullRequests');
    createReleasesStub = sandbox.stub(Runner, 'createReleases');
    createLightweightTagStub = sandbox.stub(Runner, 'createLightweightTag');
    sandbox
      .stub(gcfUtilsModule, 'getAuthenticatedOctokit')
      .resolves(new Octokit({auth: 'faketoken', request: {fetch}}));

    sandbox.replace(datastoreLockModule, 'withDatastoreLock', async function (
      _details: any,
      f: () => Promise<void>
    ) {
      await f();
    } as any);

    // No release for test cases except explicitly set in each case.
    createReleasesStub.resolves([]);
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

      it('should enable sentence-case for allow listed orgs', async () => {
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
          sinon.match.has(
            'plugins',
            sinon.match.array.deepEquals([
              {type: 'sentence-case', specialWords: ['gRPC', 'npm']},
            ])
          ),
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
        const addIssueStub = sandbox
          .stub(errorHandlingModule, 'addOrUpdateIssue')
          .resolves();

        getConfigStub.resolves(loadConfig('valid_handle_gh_release.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createPullRequestsStub);
        sinon.assert.calledOnce(createReleasesStub);
        sinon.assert.calledOnce(addIssueStub);
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

      it('should allow release-please to configure the default package-name', async () => {
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
          sinon.match({
            releaseType: 'ruby',
            packageName: undefined,
          }),
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

      it('should allow alternate initial version', async () => {
        getConfigStub.resolves(loadConfig('alternate_initial_version.yml'));
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
          sinon.match.has('initialVersion', '0.1.0'),
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
        sinon.assert.calledOnceWithExactly(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master', // target is default branch of repository inferred from payload
          sinon.match.any,
          sinon.match.any,
          undefined
        );
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

      it('should allow configuring monorepo tags', async () => {
        getConfigStub.resolves(loadConfig('monorepo_tags.yml'));
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
          sinon.match.has('includeComponentInTag', true),
          sinon.match.any,
          undefined
        );
      });

      it('should default monorepo tags to false', async () => {
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
          sinon.match.has('includeComponentInTag', false),
          sinon.match.any,
          undefined
        );
      });

      it('should allow configuring multiple times for a branch', async () => {
        getConfigStub.resolves(loadConfig('multiple.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledTwice(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledTwice(fromConfigStub);
        sinon.assert.calledWith(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match.has('releaseType', 'node'),
          sinon.match.any,
          'packages/node-pkg'
        );
        sinon.assert.calledWith(
          fromConfigStub,
          sinon.match.instanceOf(GitHub),
          'master',
          sinon.match.has('releaseType', 'java-yoshi'),
          sinon.match.any,
          'packages/java-pkg'
        );
      });

      it('should allow missing repo language and no releaseType', async () => {
        const addIssueStub = sandbox
          .stub(errorHandlingModule, 'addOrUpdateIssue')
          .resolves();
        payload = require(resolve(fixturesPath, './push_to_main_no_language'));
        getConfigStub.resolves(loadConfig('main_branch.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.notCalled(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
        sinon.assert.calledOnce(addIssueStub);
      });

      it('ignores non-releases for on-demand repos', async () => {
        getConfigStub.resolves(loadConfig('on_demand.yml'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.notCalled(createPullRequestsStub);
        sinon.assert.notCalled(createReleasesStub);
      });

      it('handles releases for on-demand repos', async () => {
        getConfigStub.resolves(loadConfig('on_demand.yml'));
        payload = require(resolve(fixturesPath, './push_to_master_release'));
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.notCalled(createPullRequestsStub);
        sinon.assert.calledOnce(createReleasesStub);
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
          'path/to/manifest.json',
          sinon.match({
            logger: sinon.match.object,
          })
        );
      });

      it('should tag pull request number if configured', async () => {
        getConfigStub.resolves(loadConfig('manifest_tag_pr_number.yml'));
        // We want the PR number 789 to be in the tag
        const exampleRelease = {
          id: 'v4.5.6',
          path: 'foo',
          version: 'v4.5.6',
          major: 4,
          minor: 5,
          patch: 6,
          prNumber: 789,
          sha: '853ab2395d7777f8f3f8cb2b7106d3a3d17490e9',
        };
        createReleasesStub.resolves([exampleRelease]);
        createLightweightTagStub.resolves({});

        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createReleasesStub);
        sinon.assert.calledOnceWithExactly(
          createLightweightTagStub,
          sinon.match.instanceOf(Octokit),
          sinon.match
            .has('repo', 'google-auth-library-java')
            .and(sinon.match.has('owner', 'chingor13')),
          'release-please-789',
          '853ab2395d7777f8f3f8cb2b7106d3a3d17490e9'
        );
        // When there's a release, it reloads the manifest.
        sinon.assert.calledTwice(fromManifestStub);
        sinon.assert.calledOnce(createPullRequestsStub);
      });

      it('should tag each SHA for pull requests number if configured', async () => {
        getConfigStub.resolves(loadConfig('manifest_tag_pr_number.yml'));
        // 2 pull requests created 3 releases. First
        // two share the same SHA and PR number.
        const release1 = {
          id: 'foo/v3.0.1',
          path: 'foo',
          version: 'v3.0.1',
          major: 3,
          minor: 0,
          patch: 1,
          prNumber: 789,
          sha: '853ab2395d7777f8f3f8cb2b7106d3a3d17490e9',
        };
        const release2 = {
          id: 'bar/v4.0.1',
          path: 'bar',
          version: 'v4.0.1',
          major: 4,
          minor: 0,
          patch: 1,
          // These values below are the same as the
          // release1's.
          prNumber: 789,
          sha: '853ab2395d7777f8f3f8cb2b7106d3a3d17490e9',
        };
        const release3 = {
          id: 'v5.0.2',
          path: 'foo',
          version: 'v5.0.2',
          major: 5,
          minor: 0,
          patch: 2,
          prNumber: 790,
          sha: 'f5528f1d94206836a8ceb9bed5eeaa768e002fb4',
        };
        createReleasesStub.resolves([release1, release2, release3]);
        await probot.receive(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          {name: 'push', payload: payload as any, id: 'abc123'}
        );

        sinon.assert.calledOnce(createReleasesStub);
        // Because the first 2 releases share the pull request and SHA,
        // there should be 2 new tags.
        sinon.assert.calledTwice(createLightweightTagStub);
        // When there's a release, it reloads the manifest.
        sinon.assert.calledTwice(fromManifestStub);
        sinon.assert.calledOnce(createPullRequestsStub);
      });
    });

    it('should handle a misconfigured repository', async () => {
      const fromManifestStub = sandbox
        .stub(Manifest, 'fromManifest')
        .rejects(
          new Errors.ConfigurationError(
            'some error message',
            'releaser-name',
            'repo-name'
          )
        );
      const addIssueStub = sandbox
        .stub(errorHandlingModule, 'addOrUpdateIssue')
        .resolves();
      getConfigStub.resolves(loadConfig('manifest_handle_gh_release.yml'));
      await probot.receive(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {name: 'push', payload: payload as any, id: 'abc123'}
      );

      sinon.assert.notCalled(createPullRequestsStub);
      sinon.assert.notCalled(createReleasesStub);
      sinon.assert.calledOnce(fromManifestStub);
      sinon.assert.calledOnce(addIssueStub);
    });

    it('ignores archived repositories', async () => {
      payload = require(resolve(fixturesPath, './push_to_main_archived'));
      await probot.receive(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {name: 'push', payload: payload as any, id: 'abc123'}
      );

      sinon.assert.notCalled(getConfigStub);
      sinon.assert.notCalled(createPullRequestsStub);
      sinon.assert.notCalled(createReleasesStub);
    });

    it('ignores disabled repositories', async () => {
      payload = require(resolve(fixturesPath, './push_to_main_disabled'));
      await probot.receive(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {name: 'push', payload: payload as any, id: 'abc123'}
      );

      sinon.assert.notCalled(getConfigStub);
      sinon.assert.notCalled(createPullRequestsStub);
      sinon.assert.notCalled(createReleasesStub);
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

    it('should try to create a release pull request', async () => {
      const payload = require(resolve(fixturesPath, './pull_request_labeled'));
      getConfigStub.resolves(loadConfig('valid.yml'));
      const requests = nock('https://api.github.com')
        .delete(
          '/repos/Codertocat/Hello-World/issues/2/labels/release-please%3Aforce-run'
        )
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload: payload as any,
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

    it('should try to create a release pull request for on-demand repo', async () => {
      const payload = require(resolve(fixturesPath, './pull_request_labeled'));
      getConfigStub.resolves(loadConfig('on_demand.yml'));
      const requests = nock('https://api.github.com')
        .delete(
          '/repos/Codertocat/Hello-World/issues/2/labels/release-please%3Aforce-run'
        )
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload: payload as any,
        id: 'abc123',
      });

      requests.done();
      sinon.assert.calledOnce(createPullRequestsStub);
      sinon.assert.calledOnceWithExactly(
        fromConfigStub,
        sinon.match.instanceOf(GitHub),
        'master',
        sinon.match.has('releaseType', 'java-yoshi'),
        sinon.match.any,
        undefined
      );
    });

    it('should ignore failing to remove the label', async () => {
      const payload = require(resolve(fixturesPath, './pull_request_labeled'));
      getConfigStub.resolves(loadConfig('valid.yml'));
      const requests = nock('https://api.github.com')
        .delete(
          '/repos/Codertocat/Hello-World/issues/2/labels/release-please%3Aforce-run'
        )
        .reply(404);

      await probot.receive({
        name: 'pull_request',
        payload: payload as any,
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

    it('should try to tag a GitHub release', async () => {
      const payload = require(resolve(fixturesPath, './pull_request_labeled'));
      getConfigStub.resolves(loadConfig('valid_handle_gh_release.yml'));
      const requests = nock('https://api.github.com')
        .delete(
          '/repos/Codertocat/Hello-World/issues/2/labels/release-please%3Aforce-run'
        )
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload: payload as any,
        id: 'abc123',
      });

      requests.done();
      sinon.assert.calledOnce(createPullRequestsStub);
      sinon.assert.calledOnce(createReleasesStub);
      sinon.assert.calledOnceWithExactly(
        fromConfigStub,
        sinon.match.instanceOf(GitHub),
        'master',
        sinon.match.has('releaseType', 'java-yoshi'),
        sinon.match.any,
        undefined
      );
    });

    it('should try to tag a GitHub release for an on-demand repo', async () => {
      const payload = require(resolve(fixturesPath, './pull_request_labeled'));
      getConfigStub.resolves(loadConfig('on_demand.yml'));
      const requests = nock('https://api.github.com')
        .delete(
          '/repos/Codertocat/Hello-World/issues/2/labels/release-please%3Aforce-run'
        )
        .reply(200);

      await probot.receive({
        name: 'pull_request',
        payload: payload as any,
        id: 'abc123',
      });

      requests.done();
      sinon.assert.calledOnce(createPullRequestsStub);
      sinon.assert.calledOnce(createReleasesStub);
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
        payload: payload as any,
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
        payload: payload as any,
        id: 'abc123',
      });

      sinon.assert.notCalled(createPullRequestsStub);
      sinon.assert.notCalled(createReleasesStub);
    });

    it('ignores archived repositories', async () => {
      const payload = require(resolve(
        fixturesPath,
        './pull_request_labeled_archived'
      ));
      await probot.receive(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {name: 'push', payload: payload as any, id: 'abc123'}
      );

      sinon.assert.notCalled(getConfigStub);
      sinon.assert.notCalled(createPullRequestsStub);
      sinon.assert.notCalled(createReleasesStub);
    });

    it('ignores disabled repositories', async () => {
      const payload = require(resolve(
        fixturesPath,
        './pull_request_labeled_disabled'
      ));
      await probot.receive(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {name: 'push', payload: payload as any, id: 'abc123'}
      );

      sinon.assert.notCalled(getConfigStub);
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
        payload: payload as any,
        id: 'abc123',
      });

      requests.done();
    });

    it('should ignore non-release pull requests', async () => {
      payload = require(resolve(fixturesPath, './pr_closed_non_release'));
      getConfigStub.resolves(loadConfig('valid.yml'));

      await probot.receive({
        name: 'pull_request',
        payload: payload as any,
        id: 'abc123',
      });
    });

    it('should ignore merged pull requests', async () => {
      payload = require(resolve(fixturesPath, './pr_merged'));
      getConfigStub.resolves(loadConfig('valid.yml'));

      await probot.receive({
        name: 'pull_request',
        payload: payload as any,
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
        payload: payload as any,
        id: 'abc123',
      });

      requests.done();
    });

    it('should ignore non-release pull requests', async () => {
      payload = require(resolve(fixturesPath, './pr_reopened_non_release'));
      getConfigStub.resolves(loadConfig('valid.yml'));

      await probot.receive({
        name: 'pull_request',
        payload: payload as any,
        id: 'abc123',
      });
    });
  });
});
