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
import {Probot, createProbot} from 'probot';
import nock from 'nock';
import * as fs from 'fs';
import {describe, it, beforeEach, afterEach} from 'mocha';

// eslint-disable-next-line node/no-extraneous-import
import Webhooks from '@octokit/webhooks';
import sinon from 'sinon';
import handler from '../src/slo-bot';
import * as sloLint from '../src/slo-lint';
import * as sloAppliesTo from '../src/slo-appliesTo';
import * as sloCompliant from '../src/slo-compliant';
import * as sloLabel from '../src/slo-label';
import {Octokit} from '@octokit/rest';
import {config} from '@probot/octokit-plugin-config';
const TestingOctokit = Octokit.plugin(config);

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('slo-bot', () => {
  let probot: Probot;

  const config = fs.readFileSync(
    resolve(fixturesPath, 'config', 'slo-stat-bot.yaml')
  );

  beforeEach(() => {
    probot = createProbot({
      githubToken: 'abc123',
      Octokit: TestingOctokit as any,
    });

    probot.load(handler);
  });

  describe('getSloFile', () => {
    let payload: Webhooks.WebhookEvents;
    let appliesToStub: sinon.SinonStub;
    let isCompliantStub: sinon.SinonStub;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'issue_opened'));
      appliesToStub = sinon.stub(sloAppliesTo, 'doesSloApply');
      isCompliantStub = sinon.stub(sloCompliant, 'isIssueCompliant');
    });

    afterEach(() => {
      sinon.restore();
      nock.cleanAll;
    });

    it('triggers handle slo if config file exists in repo level', async () => {
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fslo-stat-bot.yaml')
        .reply(200, config)
        .get('/repos/testOwner/.github/contents/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
        });

      appliesToStub.onCall(0).returns(false);
      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(appliesToStub);
      sinon.assert.notCalled(isCompliantStub);
      requests.done();
    });

    it('triggers handle slo if config file exists in org level', async () => {
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github%2Fslo-stat-bot.yaml')
        .reply(200, config)
        .get(
          '/repos/testOwner/testRepo/contents/.github%2Fissue_slo_rules.json'
        )
        .reply(404)
        .get('/repos/testOwner/.github/contents/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
        });

      appliesToStub.onCall(0).returns(false);
      await probot.receive({
        name: 'issues',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(appliesToStub);
      sinon.assert.notCalled(isCompliantStub);
      requests.done();
    });
  });
  describe('handleIssues', () => {
    let payload: Webhooks.WebhookEvents;
    let appliesToStub: sinon.SinonStub;
    let isCompliantStub: sinon.SinonStub;
    let labelStub: sinon.SinonStub;

    beforeEach(() => {
      appliesToStub = sinon.stub(sloAppliesTo, 'doesSloApply');
      isCompliantStub = sinon.stub(sloCompliant, 'isIssueCompliant');
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
          .get('/repos/testOwner/testRepo/contents/.github%2Fslo-stat-bot.yaml')
          .reply(200, config)
          .get(
            '/repos/testOwner/testRepo/contents/.github%2Fissue_slo_rules.json'
          )
          .reply(200, {
            content:
              'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
          });
        appliesToStub.onCall(0).returns(true);
        isCompliantStub.onCall(0).returns(false);

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });
        sinon.assert.calledOnce(lintStub);
        sinon.assert.calledOnce(appliesToStub);
        sinon.assert.calledOnce(isCompliantStub);
        sinon.assert.calledOnce(labelStub);
        requests.done();
      });
      it('does not trigger handle label if slo does not apply to issue', async () => {
        const requests = nock('https://api.github.com')
          .get('/repos/testOwner/testRepo/contents/.github%2Fslo-stat-bot.yaml')
          .reply(200, config)
          .get(
            '/repos/testOwner/testRepo/contents/.github%2Fissue_slo_rules.json'
          )
          .reply(200, {
            content:
              'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
          });

        appliesToStub.onCall(0).returns(false);

        await probot.receive({
          name: 'pull_request',
          payload,
          id: 'abc123',
        });
        sinon.assert.calledOnce(appliesToStub);
        sinon.assert.notCalled(isCompliantStub);
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
          .get('/repos/testOwner/testRepo/contents/.github%2Fslo-stat-bot.yaml')
          .reply(200, config)
          .get(
            '/repos/testOwner/testRepo/contents/.github%2Fissue_slo_rules.json'
          )
          .reply(200, {
            content:
              'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
          });
        appliesToStub.onCall(0).returns(true);
        isCompliantStub.onCall(0).returns(false);

        await probot.receive({
          name: 'issues',
          payload,
          id: 'abc123',
        });

        sinon.assert.calledOnce(appliesToStub);
        sinon.assert.calledOnce(isCompliantStub);
        sinon.assert.calledOnce(labelStub);
        requests.done();
      });
      it('does not trigger handle label if slo does not apply to issue', async () => {
        const requests = nock('https://api.github.com')
          .get('/repos/testOwner/testRepo/contents/.github%2Fslo-stat-bot.yaml')
          .reply(200, config)
          .get(
            '/repos/testOwner/testRepo/contents/.github%2Fissue_slo_rules.json'
          )
          .reply(200, {
            content:
              'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
          });
        appliesToStub.onCall(0).returns(false);

        await probot.receive({
          name: 'issues',
          payload,
          id: 'abc123',
        });

        sinon.assert.calledOnce(appliesToStub);
        sinon.assert.notCalled(isCompliantStub);
        sinon.assert.notCalled(labelStub);
        requests.done();
      });
    });
    describe('schedule repository event', () => {
      const payload = {
        repository: {
          name: 'testRepo',
          owner: {
            login: 'testOwner',
          },
        },
        organization: {
          login: 'testOwner',
        },
        cron_org: 'testOwner',
      };

      it('getIssueList() and call handleIssues() for each issue', async () => {
        const requests = nock('https://api.github.com')
          .get('/repos/testOwner/testRepo/issues?state=open')
          .reply(200, [
            {
              number: 1,
              labels: [
                {name: 'bot: header-check'},
                {name: 'help wanted'},
                {name: 'priority: P0'},
              ],
              assignees: [
                {
                  login: 'owner1',
                  type: 'User',
                  site_admin: false,
                },
              ],
              created_at: '',
              updated_at: '',
            },
          ])
          .get(
            '/repos/testOwner/testRepo/contents/.github%2Fissue_slo_rules.json'
          )
          .reply(200, {
            content:
              'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
          })
          .get('/repos/testOwner/testRepo/contents/.github%2Fslo-stat-bot.yaml')
          .reply(200, {content: config.toString('base64')});

        appliesToStub.onCall(0).returns(true);
        isCompliantStub.onCall(0).returns(false);

        await probot.receive({
          name: 'schedule.repository' as any,
          payload,
          id: 'abc123',
        });

        sinon.assert.calledOnce(appliesToStub);
        sinon.assert.calledOnce(isCompliantStub);
        sinon.assert.calledOnce(labelStub);
        requests.done();
      });
    });
  });
});
