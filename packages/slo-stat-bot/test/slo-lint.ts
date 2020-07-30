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
import * as fs from 'fs';
import * as assert from 'assert';
import {describe, it, beforeEach, afterEach} from 'mocha';

// eslint-disable-next-line node/no-extraneous-import
import Webhooks from '@octokit/webhooks';
import snapshot from 'snap-shot-it';
import handler from '../src/slo-bot';
import sinon from 'sinon';
import * as sloLint from '../src/slo-lint';
import * as sloAppliesTo from '../src/slo-appliesTo';
import * as sloCompliant from '../src/slo-compliant';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('slo-lint', () => {
  let probot: Probot;

<<<<<<< HEAD
  const config = fs.readFileSync(
    resolve(fixturesPath, 'config', 'slo-stat-bot.yaml')
  );


=======
>>>>>>> fbaceae1f2721593414179a77e092ceee9a52a43
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

  describe('opened or reopened pull request', () => {
    let payload: Webhooks.WebhookPayloadPullRequest;
    let appliesToStub: sinon.SinonStub;
    let isCompliantStub: sinon.SinonStub;
    let handleSloStub: sinon.SinonStub;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'pull_request_opened'));
      appliesToStub = sinon.stub(sloAppliesTo, 'doesSloApply');
      isCompliantStub = sinon.stub(sloCompliant, 'isIssueCompliant');
      handleSloStub = sinon.stub(sloLint, 'handleSlos');
    });

    afterEach(() => {
      sinon.restore();
      nock.cleanAll;
    });

    it('Error is logged when getting the list of files fails and handleIssues is called', async () => {
      const requests = nock('https://api.github.com')
<<<<<<< HEAD
        .get('/repos/testOwner/testRepo/contents/.github/slo-stat-bot.yaml')
        .reply(200, {content: config.toString('base64')})  
=======
>>>>>>> fbaceae1f2721593414179a77e092ceee9a52a43
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(404)
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
        });

      appliesToStub.onCall(0).returns(false);
      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();

      sinon.assert.notCalled(handleSloStub);
      sinon.assert.calledOnce(appliesToStub);
      sinon.assert.notCalled(isCompliantStub);
    });

    it('triggers handleSlos function since issue_slo_rules.json is present and handleIssues is called', async () => {
      const requests = nock('https://api.github.com')
<<<<<<< HEAD
        .get('/repos/testOwner/testRepo/contents/.github/slo-stat-bot.yaml')
        .reply(200, {content: config.toString('base64')})
=======
>>>>>>> fbaceae1f2721593414179a77e092ceee9a52a43
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(200, [
          {
            filename: '.github/issue_slo_rules.json',
            sha: '1d8be9e05d65e03a5e81a1c3c1bf229dce950e25',
          },
        ])
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
        });

      appliesToStub.onCall(0).returns(false);
      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(handleSloStub);
      sinon.assert.calledOnce(appliesToStub);
      sinon.assert.notCalled(isCompliantStub);
      requests.done();
    });

    it('does not trigger handleSlos function since issue_slo_rules.json is not present. Calls handleIssues', async () => {
      const requests = nock('https://api.github.com')
<<<<<<< HEAD
        .get('/repos/testOwner/testRepo/contents/.github/slo-stat-bot.yaml')
        .reply(200, {content: config.toString('base64')})
=======
>>>>>>> fbaceae1f2721593414179a77e092ceee9a52a43
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(200, [{filname: 'hello.json'}])
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
        });

      appliesToStub.onCall(0).returns(false);
      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(handleSloStub);
      sinon.assert.calledOnce(appliesToStub);
      sinon.assert.notCalled(isCompliantStub);
      requests.done();
    });
  });

  describe('handleSLOs is triggered', async () => {
    let payload: Webhooks.WebhookPayloadPullRequest;
    let appliesToStub: sinon.SinonStub;
    let isCompliantStub: sinon.SinonStub;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'pull_request_opened'));
      appliesToStub = sinon.stub(sloAppliesTo, 'doesSloApply');
      isCompliantStub = sinon.stub(sloCompliant, 'isIssueCompliant');
    });

    afterEach(() => {
      nock.cleanAll;
      sinon.restore();
    });

    it('Error is logged if getting file content fails and calls handleIssues', async () => {
      const requests = nock('https://api.github.com')
<<<<<<< HEAD
        .get('/repos/testOwner/testRepo/contents/.github/slo-stat-bot.yaml')
        .reply(200, {content: config.toString('base64')})
=======
>>>>>>> fbaceae1f2721593414179a77e092ceee9a52a43
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(202, [
          {
            filename: '.github/issue_slo_rules.json',
            sha: '1d8be9e05d65e03a5e81a1c3c1bf229dce950e25',
          },
        ])
        .get(
          '/repos/testOwner/testRepo/git/blobs/1d8be9e05d65e03a5e81a1c3c1bf229dce950e25'
        )
        .reply(404, {})
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
        });

      appliesToStub.onCall(0).returns(false);
      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();

      sinon.assert.calledOnce(appliesToStub);
      sinon.assert.notCalled(isCompliantStub);
    });

    it('Error is logged if commenting on PR fails and calls handle issues', async () => {
      const invalidBlob = {
        content:
          'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
      };
      const requests = nock('https://api.github.com')
<<<<<<< HEAD
        .get('/repos/testOwner/testRepo/contents/.github/slo-stat-bot.yaml')
        .reply(200, {content: config.toString('base64')})
=======
>>>>>>> fbaceae1f2721593414179a77e092ceee9a52a43
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(202, [
          {
            filename: '.github/issue_slo_rules.json',
            sha: '1d8be9e05d65e03a5e81a1c3c1bf229dce950e25',
          },
        ])
        .get(
          '/repos/testOwner/testRepo/git/blobs/1d8be9e05d65e03a5e81a1c3c1bf229dce950e25'
        )
        .reply(202, invalidBlob)
        .post('/repos/testOwner/testRepo/issues/6/comments', body => {
          snapshot(body);
          return true;
        })
        .reply(404)
<<<<<<< HEAD
        .post('/repos/testOwner/testRepo/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
=======
>>>>>>> fbaceae1f2721593414179a77e092ceee9a52a43
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
        });

      appliesToStub.onCall(0).returns(false);
      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
      sinon.assert.calledOnce(appliesToStub);
      sinon.assert.notCalled(isCompliantStub);
    });

    it('Error is logged if creating check on PR fails and calls handle issues', async () => {
      const invalidBlob = {
        content:
          'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
      };
      const requests = nock('https://api.github.com')
<<<<<<< HEAD
        .get('/repos/testOwner/testRepo/contents/.github/slo-stat-bot.yaml')
        .reply(200, {content: config.toString('base64')})
=======
>>>>>>> fbaceae1f2721593414179a77e092ceee9a52a43
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(202, [
          {
            filename: '.github/issue_slo_rules.json',
            sha: '1d8be9e05d65e03a5e81a1c3c1bf229dce950e25',
          },
        ])
        .get(
          '/repos/testOwner/testRepo/git/blobs/1d8be9e05d65e03a5e81a1c3c1bf229dce950e25'
        )
        .reply(202, invalidBlob)
        .post('/repos/testOwner/testRepo/issues/6/comments', body => {
          snapshot(body);
          return true;
        })
        .reply(202)
        .post('/repos/testOwner/testRepo/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(404)
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
        });

      appliesToStub.onCall(0).returns(false);
      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
      sinon.assert.calledOnce(appliesToStub);
      sinon.assert.notCalled(isCompliantStub);
    });

    it('An error comment and failure check is made on PR if issue_slo_rules lint is not valid', async () => {
      const invalidBlob = {
        content:
          'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
      };
      const requests = nock('https://api.github.com')
<<<<<<< HEAD
        .get('/repos/testOwner/testRepo/contents/.github/slo-stat-bot.yaml')
        .reply(200, {content: config.toString('base64')})
=======
>>>>>>> fbaceae1f2721593414179a77e092ceee9a52a43
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(200, [
          {
            filename: '.github/issue_slo_rules.json',
            sha: '1d8be9e05d65e03a5e81a1c3c1bf229dce950e25',
          },
        ])
        .get(
          '/repos/testOwner/testRepo/git/blobs/1d8be9e05d65e03a5e81a1c3c1bf229dce950e25'
        )
        .reply(200, invalidBlob)
        .post('/repos/testOwner/testRepo/issues/6/comments', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .post('/repos/testOwner/testRepo/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
        });

      appliesToStub.onCall(0).returns(false);
      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
      sinon.assert.calledOnce(appliesToStub);
      sinon.assert.notCalled(isCompliantStub);
    });

    it('Leaves no comment on PR and sets success check if issue_slo_rules lint is valid', async () => {
      const validBlob = {
        content:
          'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMCIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAsCiAgICAgICAgICAgICJyZXNvbHV0aW9u\nVGltZSI6IDQzMjAwLAogICAgICAgICAgICAicmVxdWlyZXNBc3NpZ25lZSI6\nIHRydWUKICAgICAgICB9CiAgICB9CiBdCiAKIAogCiAKIAo=\n',
      };
      const requests = nock('https://api.github.com')
<<<<<<< HEAD
        .get('/repos/testOwner/testRepo/contents/.github/slo-stat-bot.yaml')
        .reply(200, {content: config.toString('base64')})
=======
>>>>>>> fbaceae1f2721593414179a77e092ceee9a52a43
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(200, [
          {
            filename: '.github/issue_slo_rules.json',
            sha: '1d8be9e05d65e03a5e81a1c3c1bf229dce950e25',
          },
        ])
        .get(
          '/repos/testOwner/testRepo/git/blobs/1d8be9e05d65e03a5e81a1c3c1bf229dce950e25'
        )
        .reply(200, validBlob)
        .post('/repos/testOwner/testRepo/check-runs', body => {
          snapshot(body);
          return true;
        })
        .reply(200)
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
        });

      appliesToStub.onCall(0).returns(false);
      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
      sinon.assert.calledOnce(appliesToStub);
      sinon.assert.notCalled(isCompliantStub);
    });
  });
  describe('checking validation by using linter', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const schema = require('./../data/schema.json');

    it('Valid slos return true', async () => {
      const files = fs.readdirSync(
        resolve(fixturesPath, 'events', 'issue_slo_rules', 'valid_slos')
      );

      for (const fileName of files) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const slo = require(resolve(
          fixturesPath,
          'events',
          'issue_slo_rules',
          'valid_slos',
          fileName
        ));
        const validRes = await sloLint.lint(schema, slo);
        const isValid = await validRes.isValid;

        assert.strictEqual(isValid, true);
      }
    });

    it('Invalid slos return false', async () => {
      const files = fs.readdirSync(
        resolve(fixturesPath, 'events', 'issue_slo_rules', 'invalid_slos')
      );

      for (const fileName of files) {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const slo = require(resolve(
          fixturesPath,
          'events',
          'issue_slo_rules',
          'invalid_slos',
          fileName
        ));
        const validRes = await sloLint.lint(schema, slo);
        const isValid = await validRes.isValid;

        assert.strictEqual(isValid, false);
      }
    });
  });
});
