// Copyright 2020 Google LLC
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
//

import {resolve} from 'path';
// eslint-disable-next-line node/no-extraneous-import
import {Probot} from 'probot';
import nock from 'nock';
import {describe, it, beforeEach, afterEach} from 'mocha';

// eslint-disable-next-line node/no-extraneous-import
import Webhooks from '@octokit/webhooks';
import sinon from 'sinon';
import handler from '../src/slo-bot';
import * as sloLint from '../src/slo-lint';
import * as sloLogic from '../src/slo-logic';
import * as sloLabel from '../src/slo-label';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('slo-bot', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      // use a bare instance of octokit, the default version
      // enables retries which makes testing difficult.
      // eslint-disable-next-line node/no-extraneous-require
      Octokit: require('@octokit/rest'),
    });

    probot.app = {
      getSignedJsonWebToken() {
        return 'abc123';
      },
      getInstallationAccessToken(): Promise<string> {
        return Promise.resolve('abc123');
      },
    };
    probot.load(handler);
  });
  describe('getSloFile', () => {
    let payload: Webhooks.WebhookPayloadPullRequest;
    let getSloStatusStub: sinon.SinonStub;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'issue_opened'));
      getSloStatusStub = sinon.stub(sloLogic, 'getSloStatus');
    });

    afterEach(() => {
      sinon.restore();
      nock.cleanAll;
    });

    it('triggers handle slo if config file exists in repo level', async () => {
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
        });

      getSloStatusStub.onCall(0).returns({appliesTo: false, isCompliant: null});
      await probot.receive({
        name: 'issues.opened',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(getSloStatusStub);
      requests.done();
    });
    it('triggers handle slo if config file exists in org level', async () => {
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(404)
        .get('/repos/testOwner/.github/contents/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
        });

      getSloStatusStub.onCall(0).returns({appliesTo: false, isCompliant: null});
      await probot.receive({
        name: 'issues.opened',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(getSloStatusStub);
      requests.done();
    });
  });
  describe('handleIssues', () => {
    let payload: Webhooks.WebhookPayloadPullRequest;
    let getSloStatusStub: sinon.SinonStub;
    let labelStub: sinon.SinonStub;

    beforeEach(() => {
      getSloStatusStub = sinon.stub(sloLogic, 'getSloStatus');
      labelStub = sinon.stub(sloLabel, 'handleLabeling');
    });
    afterEach(() => {
      sinon.restore();
    });

    describe('pull request opened', () => {
      let lintStub: sinon.SinonStub;
      beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));
        lintStub = sinon.stub(sloLint, 'handleLint');
      });
      it('triggers handle label if slo applies to issue', async () => {
        const requests = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json'
          )
          .reply(200, {
            content:
              'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
          });
        getSloStatusStub
          .onCall(0)
          .returns({appliesTo: true, isCompliant: false});

        await probot.receive({
          name: 'pull_request.opened',
          payload,
          id: 'abc123',
        });
        sinon.assert.calledOnce(lintStub);
        sinon.assert.calledOnce(getSloStatusStub);
        sinon.assert.calledOnce(labelStub);
        requests.done();
      });
      it('does not trigger handle label if slo does not apply to issue', async () => {
        const requests = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json'
          )
          .reply(200, {
            content:
              'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
          });

        getSloStatusStub
          .onCall(0)
          .returns({appliesTo: false, isCompliant: null});

        await probot.receive({
          name: 'pull_request.opened',
          payload,
          id: 'abc123',
        });
        sinon.assert.calledOnce(getSloStatusStub);
        sinon.assert.notCalled(labelStub);
        requests.done();
      });
    });
    describe('issue_opened', () => {
      beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        payload = require(resolve(fixturesPath, 'events', 'issue_opened'));
      });
      it('triggers handle label if slo applies to issue', async () => {
        const requests = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json'
          )
          .reply(200, {
            content:
              'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
          });
        getSloStatusStub
          .onCall(0)
          .returns({appliesTo: true, isCompliant: false});

        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        sinon.assert.calledOnce(getSloStatusStub);
        sinon.assert.calledOnce(labelStub);
        requests.done();
      });
      it('does not trigger handle label if slo does not apply to issue', async () => {
        const requests = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json'
          )
          .reply(200, {
            content:
              'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
          });
        getSloStatusStub
          .onCall(0)
          .returns({appliesTo: false, isCompliant: null});

        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        sinon.assert.calledOnce(getSloStatusStub);
        sinon.assert.notCalled(labelStub);
        requests.done();
      });
    });
  });
});
