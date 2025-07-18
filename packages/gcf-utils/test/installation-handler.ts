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
    it('blocks organization if not in allowlist', async () => {
      const installationHandler = new InstallationHandler({
        organizationAllowlist: new Set([
          'allowed-organization',
          'other-allowed-organization',
        ]),
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
  });
});
