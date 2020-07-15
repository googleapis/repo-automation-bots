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
import {Probot} from 'probot';
import nock from 'nock';
import {describe, it, beforeEach, afterEach} from 'mocha';

// eslint-disable-next-line node/no-extraneous-import
import Webhooks from '@octokit/webhooks';
import handler from '../src/slo-stat-label';
import {getSLOStatus} from '../src/slo-logic';
import {handle_labeling} from '../src/slo-label';
import sinon from 'sinon';
import {handle_lint} from '../src/slo-lint';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('slo-status-label', () => {
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
    let handleIssueStub: sinon.SinonStub;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'issue_opened'));
      handleIssueStub = sinon.stub(handler, 'handle_issues');
    });

    afterEach(() => {
      sinon.restore();
      nock.cleanAll;
    });

    it('triggers handle slo if config file exists in repo level', async () => {
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {content: 'QHVzZXIxIEBDb2Rlci1jYXQuCkBvd25lci4yCg==\n'});

      await probot.receive({
        name: 'issues.opened',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(handleIssueStub);
      requests.done();
    });
    it('triggers handle slo if config file exists in org level', async () => {
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(404)
        .get('/repos/testOwner/.github/contents/issue_slo_rules.json')
        .reply(200, {content: 'QHVzZXIxIEBDb2Rlci1jYXQuCkBvd25lci4yCg==\n'});

      await probot.receive({
        name: 'issues.opened',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(handleIssueStub);
      requests.done();
    });
  });
  describe('handle_issues', () => {
    let payload: Webhooks.WebhookPayloadPullRequest;
    let getSloFileStub: sinon.SinonStub;
    let doesApplyStub: sinon.SinonStub;
    let isCompliantStub: sinon.SinonStub;
    let labelStub: sinon.SinonStub;

    beforeEach(() => {
      //handleLabelStub = sinon.spy(handle_labeling);
      getSloFileStub = sinon.stub(handler, 'getSloFile');
      doesApplyStub = sinon.stub(getSLOStatus, 'doesSloApply');
      isCompliantStub = sinon.stub(getSLOStatus, 'isCompliant');
      labelStub = sinon.stub(handle_labeling, 'addLabel');
    });
    afterEach(() => {
      sinon.restore();
    });

    describe('pull request opened', () => {
      let lintFileStub: sinon.SinonStub;
      beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        payload = require(resolve(
          fixturesPath,
          'events',
          'pull_request_opened'
        ));
        lintFileStub = sinon.stub(handle_lint, 'listFiles');
      });
      it('triggers handle label if slo applies to issue', async () => {
        getSloFileStub.onCall(0).returns('[{}]');
        doesApplyStub.onCall(0).returns(true);
        isCompliantStub.onCall(0).returns(false);

        await probot.receive({
          name: 'pull_request.opened',
          payload,
          id: 'abc123',
        });
        sinon.assert.calledOnce(lintFileStub);
        sinon.assert.calledOnce(getSloFileStub);
        sinon.assert.calledOnce(doesApplyStub);
        sinon.assert.calledOnce(isCompliantStub);
        sinon.assert.calledOnce(labelStub);
      });
      it('does not trigger handle label if slo does not apply to issue', async () => {
        getSloFileStub.onCall(0).returns('[{}]');
        doesApplyStub.onCall(0).returns(false);

        await probot.receive({
          name: 'pull_request.opened',
          payload,
          id: 'abc123',
        });
        sinon.assert.calledOnce(lintFileStub);
        sinon.assert.calledOnce(getSloFileStub);
        sinon.assert.calledOnce(doesApplyStub);
        sinon.assert.notCalled(labelStub);
      });
    });
    describe('issue_opened', () => {
      beforeEach(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        payload = require(resolve(fixturesPath, 'events', 'issue_opened'));
      });
      it('triggers handle label if slo applies to issue', async () => {
        getSloFileStub.onCall(0).returns('[{}]');
        doesApplyStub.onCall(0).returns(true);
        isCompliantStub.onCall(0).returns(false);

        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        sinon.assert.calledOnce(getSloFileStub);
        sinon.assert.calledOnce(doesApplyStub);
        sinon.assert.calledOnce(isCompliantStub);
        sinon.assert.calledOnce(labelStub);
      });
      it('does not trigger handle label if slo does not apply to issue', async () => {
        getSloFileStub.onCall(0).returns('[{}]');
        doesApplyStub.onCall(0).returns(false);

        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        sinon.assert.calledOnce(getSloFileStub);
        sinon.assert.calledOnce(doesApplyStub);
        sinon.assert.notCalled(labelStub);
      });
    });
  });
});
