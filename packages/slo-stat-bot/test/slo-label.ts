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
import snapshot from 'snap-shot-it';
import handler from '../src/slo-bot';
import sinon from 'sinon';
import {getSloStatus} from '../src/slo-logic';
import {handleLabeling} from '../src/slo-label';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('slo-label', () => {
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
  describe('handle_labels', () => {
    let payload: Webhooks.WebhookPayloadPullRequest;
    let doesApplyStub: sinon.SinonStub;
    let isCompliantStub: sinon.SinonStub;
    let getLabelNameStub: sinon.SinonStub;

    beforeEach(() => {
      doesApplyStub = sinon.stub(getSloStatus, 'doesSloApply');
      isCompliantStub = sinon.stub(getSloStatus, 'isCompliant');
      getLabelNameStub = sinon.stub(handleLabeling, 'getLabelName');
    });

    afterEach(() => {
      nock.cleanAll;
      sinon.restore();
    });

    it('labels ooslo if issue is not compliant and is missing ooslo label', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'issue_opened'));
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
        })
        .post('/repos/testOwner/testRepo/issues/5/labels', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      doesApplyStub.onCall(0).returns(true);
      isCompliantStub.onCall(0).returns(false);
      getLabelNameStub.onCall(0).returns('ooslo');

      await probot.receive({
        name: 'issues.opened',
        payload,
        id: 'abc123',
      });

      requests.done();
    });
    it('does not relabel ooslo if issue is not compliant and has ooslo label', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'issue_ooslo'));
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
        });

      doesApplyStub.onCall(0).returns(true);
      isCompliantStub.onCall(0).returns(false);
      getLabelNameStub.onCall(0).returns('ooslo');
      await probot.receive({
        name: 'issues.opened',
        payload,
        id: 'abc123',
      });

      requests.done();
    });
    it('does not label ooslo if issue is compliant', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'issue_opened'));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
        });

      doesApplyStub.onCall(0).returns(true);
      isCompliantStub.onCall(0).returns(true);
      getLabelNameStub.onCall(0).returns('ooslo');

      await probot.receive({
        name: 'issues.opened',
        payload,
        id: 'abc123',
      });

      requests.done();
    });
    it('removes ooslo label if issue is compliant and has ooslo label', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'issue_ooslo'));
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
        })
        .delete('/repos/testOwner/testRepo/issues/5/labels/ooslo')
        .reply(200);

      doesApplyStub.onCall(0).returns(true);
      isCompliantStub.onCall(0).returns(true);
      getLabelNameStub.onCall(0).returns('ooslo');

      await probot.receive({
        name: 'issues.opened',
        payload,
        id: 'abc123',
      });

      requests.done();
    });
  });
});
