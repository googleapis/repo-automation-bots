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
import {describe, it, beforeEach, afterEach} from 'mocha';

// eslint-disable-next-line node/no-extraneous-import
import Webhooks from '@octokit/webhooks';
import snapshot from 'snap-shot-it';
import handler from '../src/slo-bot';
import sinon from 'sinon';
import * as sloAppliesTo from '../src/slo-appliesTo';
import * as sloCompliant from '../src/slo-compliant';

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
    const config = fs.readFileSync(
      resolve(fixturesPath, 'config', 'slo-stat-bot.yaml')
    );

    let payload: Webhooks.WebhookPayloadPullRequest;
    let appliesToStub: sinon.SinonStub;
    let isCompliantStub: sinon.SinonStub;

    beforeEach(() => {
      appliesToStub = sinon.stub(sloAppliesTo, 'doesSloApply');
      isCompliantStub = sinon.stub(sloCompliant, 'isIssueCompliant');
    });

    afterEach(() => {
      nock.cleanAll;
      sinon.restore();
    });
    it('defaults to rotating light bulb emoji label if config yaml file is missing', async () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'issue_opened'));
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/contents/.github/slo-stat-bot.yaml')
        .reply(404)
        .get('/repos/testOwner/.github/contents/.github/slo-stat-bot.yaml')
        .reply(404)
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
        })

      appliesToStub.onCall(0).returns(true);
      isCompliantStub.onCall(0).returns(true);
      await probot.receive({
        name: 'issues.opened',
        payload,
        id: 'abc123',
      });

      requests.done();
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
        .get('/repos/testOwner/testRepo/contents/.github/slo-stat-bot.yaml')
        .reply(200, {content: config.toString('base64')})
        .post('/repos/testOwner/testRepo/issues/5/labels', body => {
          snapshot(body);
          return true;
        })
        .reply(200);

      appliesToStub.onCall(0).returns(true);
      isCompliantStub.onCall(0).returns(false);
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
        })
        .get('/repos/testOwner/testRepo/contents/.github/slo-stat-bot.yaml')
        .reply(200, {content: config.toString('base64')});

      appliesToStub.onCall(0).returns(true);
      isCompliantStub.onCall(0).returns(false);
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
        })
        .get('/repos/testOwner/testRepo/contents/.github/slo-stat-bot.yaml')
        .reply(200, {content: config.toString('base64')});

      appliesToStub.onCall(0).returns(true);
      isCompliantStub.onCall(0).returns(true);
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
        .reply(200)
        .get('/repos/testOwner/testRepo/contents/.github/slo-stat-bot.yaml')
        .reply(200, {content: config.toString('base64')});

      appliesToStub.onCall(0).returns(true);
      isCompliantStub.onCall(0).returns(true);
      await probot.receive({
        name: 'issues.opened',
        payload,
        id: 'abc123',
      });

      requests.done();
    });
  });
});
