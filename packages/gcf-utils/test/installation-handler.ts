// Copyright 2025 Google LLC
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

import {describe, beforeEach, afterEach, it} from 'mocha';
import fs from 'fs';
import nock from 'nock';
import assert from 'assert';
import sinon from 'sinon';
import {InstallationHandler} from '../src/installations';
import * as gcfUtilsModule from '../src/gcf-utils';
import {Octokit} from '@octokit/rest';
import fetch from 'node-fetch';

nock.disableNetConnect();
const sandbox = sinon.createSandbox();

describe('InstallationHandler', () => {
  beforeEach(() => {
    sandbox
      .stub(gcfUtilsModule, 'getAuthenticatedOctokit')
      .resolves(new Octokit({auth: 'secret123', request: {fetch}}));
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe('organizationForInstallation', () => {
    it('fetches user installation from GitHub', async () => {
      const response = JSON.parse(
        fs.readFileSync('test/fixtures/installation_user.json').toString()
      );
      const scope = nock('https://api.github.com')
        .get('/app/installations/1')
        .reply(200, response);
      const installationHandler = new InstallationHandler();
      const organization =
        await installationHandler.organizationForInstallation(1);
      assert.strictEqual(organization, 'octocat');
      scope.done();
    });
    it('fetches user installation from GitHub', async () => {
      const response = JSON.parse(
        fs.readFileSync('test/fixtures/installation_enterprise.json').toString()
      );
      const scope = nock('https://api.github.com')
        .get('/app/installations/1')
        .reply(200, response);
      const installationHandler = new InstallationHandler();
      const organization =
        await installationHandler.organizationForInstallation(1);
      assert.strictEqual(organization, 'octo-business');
      scope.done();
    });
    it('caches response from GitHub', async () => {
      const response = JSON.parse(
        fs.readFileSync('test/fixtures/installation_user.json').toString()
      );
      const scope = nock('https://api.github.com')
        .get('/app/installations/1')
        .reply(200, response);
      const installationHandler = new InstallationHandler();
      const organization =
        await installationHandler.organizationForInstallation(1);
      assert.strictEqual(organization, 'octocat');
      const organization2 =
        await installationHandler.organizationForInstallation(1);
      assert.strictEqual(organization2, 'octocat');
      scope.done();
    });
    it('does not log organization name if not in allowlist', async () => {
      const response = JSON.parse(
        fs.readFileSync('test/fixtures/installation_user.json').toString()
      );
      const scope = nock('https://api.github.com')
        .get('/app/installations/1')
        .reply(200, response);
      const installationHandler = new InstallationHandler({
        organizationAllowlist: new Set(['allowed-org']),
      });
      const debugSpy = sandbox.spy(gcfUtilsModule.logger, 'debug');
      const traceSpy = sandbox.spy(gcfUtilsModule.logger, 'trace');

      const organization =
        await installationHandler.organizationForInstallation(1);
      assert.strictEqual(organization, 'octocat');
      sinon.assert.calledWith(
        debugSpy,
        sinon.match('Found organization for installationId: 1')
      );
      for (const call of debugSpy.getCalls()) {
        assert.ok(!JSON.stringify(call.args).includes('octocat'));
      }

      // Second call hits cache
      const organization2 =
        await installationHandler.organizationForInstallation(1);
      assert.strictEqual(organization2, 'octocat');
      sinon.assert.calledWith(
        traceSpy,
        sinon.match('Found cached organization for installationId: 1')
      );
      for (const call of traceSpy.getCalls()) {
        assert.ok(!JSON.stringify(call.args).includes('octocat'));
      }
      scope.done();
    });
  });
  describe('isOrganizationAllowed', () => {
    it('allows organization if no allowlist set', async () => {
      const installationHandler = new InstallationHandler();
      const organizationStub = sandbox.stub(
        installationHandler,
        'organizationForInstallation'
      );
      assert.strictEqual(
        await installationHandler.isOrganizationAllowed(1234),
        true
      );
      sinon.assert.notCalled(organizationStub);
    });
    it('allows organization if in allowlist', async () => {
      const installationHandler = new InstallationHandler({
        organizationAllowlist: new Set([
          'allowed-organization',
          'some-organization',
        ]),
      });
      const organizationStub = sandbox
        .stub(installationHandler, 'organizationForInstallation')
        .resolves('some-organization');
      assert.strictEqual(
        await installationHandler.isOrganizationAllowed(1234),
        true
      );
      sinon.assert.calledOnce(organizationStub);
    });
    it('blocks organization if in blocklist', async () => {
      const installationHandler = new InstallationHandler({
        organizationBlocklist: new Set(['some-organization']),
      });
      const organizationStub = sandbox
        .stub(installationHandler, 'organizationForInstallation')
        .resolves('some-organization');
      assert.strictEqual(
        await installationHandler.isOrganizationAllowed(1234),
        false
      );
      sinon.assert.calledOnce(organizationStub);
    });
    it('blocks organization if not in allowlist without logging organization name', async () => {
      const installationHandler = new InstallationHandler({
        organizationAllowlist: new Set([
          'allowed-organization',
          'other-allowed-organization',
        ]),
      });
      const infoSpy = sandbox.spy(gcfUtilsModule.logger, 'info');
      const organizationStub = sandbox
        .stub(installationHandler, 'organizationForInstallation')
        .resolves('some-organization');
      assert.strictEqual(
        await installationHandler.isOrganizationAllowed(1234),
        false
      );
      sinon.assert.calledOnce(organizationStub);
      sinon.assert.calledWith(
        infoSpy,
        sinon.match(
          'Discarding this request because its organization is outside the allowlist: allowed-organization,other-allowed-organization'
        )
      );
      for (const call of infoSpy.getCalls()) {
        assert.ok(!JSON.stringify(call.args).includes('some-organization'));
      }
    });
  });
});
