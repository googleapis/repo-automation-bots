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
import * as fs from 'fs';
import * as assert from 'assert';
import {describe, it, beforeEach, afterEach} from 'mocha';

// eslint-disable-next-line node/no-extraneous-import
import Webhooks from '@octokit/webhooks';
import snapshot from 'snap-shot-it';
import handler from '../src/slo-stat-label';
import sinon from 'sinon';
import {getSLOStatus} from '../src/slo-logic';
import {handle_lint} from '../src/slo-lint'

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

  describe('opened or reopened pull request', () => {
    let payload: Webhooks.WebhookPayloadPullRequest;
    let handleSloStub: sinon.SinonStub;
    let handleIssueStub: sinon.SinonStub;
    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'pull_request_opened'));
      handleSloStub = sinon.stub(handle_lint, 'handle_slos');
      handleIssueStub = sinon.stub(handler, 'handle_issues');
    });

    afterEach(() => {
      sinon.restore();
      nock.cleanAll;
    });

    it('Error is logged when getting the list of files fails', async () => {
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(404)
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {content: 'QHVzZXIxIEBDb2Rlci1jYXQuCkBvd25lci4yCg==\n'});
      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();

      sinon.assert.notCalled(handleSloStub);
      sinon.assert.calledOnce(handleIssueStub);
    });

    it('triggers handle_slos function since issue_slo_rules.json is present and handle_issues', async () => {
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(200, [
          {
            filename: '.github/issue_slo_rules.json',
            sha: '1d8be9e05d65e03a5e81a1c3c1bf229dce950e25',
          },
        ])
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {content: 'QHVzZXIxIEBDb2Rlci1jYXQuCkBvd25lci4yCg==\n'});

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(handleSloStub);
      sinon.assert.calledOnce(handleIssueStub);
      requests.done();
    });

    it('does not trigger handle_slos function since issue_slo_rules.json is not present. However triggers handle_issues', async () => {
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(200, [{filname: 'hello.json'}])
        .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
        .reply(200, {content: 'QHVzZXIxIEBDb2Rlci1jYXQuCkBvd25lci4yCg==\n'});
      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(handleSloStub);
      sinon.assert.calledOnce(handleIssueStub);
      requests.done();
    });
  });

  describe('handleSLOs is triggered', async () => {
    let payload: Webhooks.WebhookPayloadPullRequest;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'pull_request_opened'));
    });

    afterEach(() => {
      nock.cleanAll;
    });

    it('Error is logged if getting file content fails and calls handle_issues', async () => {
      const requests = nock('https://api.github.com')
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
        .get('/repos/testOwner/.github/contents/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
        })

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('Error is logged if commenting on PR fails and calls handle issues', async () => {
      const invalidBlob = {
        content:
          'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
      };
      const requests = nock('https://api.github.com')
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
        .get('/repos/testOwner/.github/contents/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
        })

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('Error is logged if creating check on PR fails and calls handle issues', async () => {
      const invalidBlob = {
        content:
          'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
      };
      const requests = nock('https://api.github.com')
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
        .get('/repos/testOwner/.github/contents/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
        })

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('An error comment and failure check is made on PR if issue_slo_rules lint is not valid', async () => {
      const invalidBlob = {
        content:
          'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
      };
      const requests = nock('https://api.github.com')
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
        .get('/repos/testOwner/.github/contents/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
        })

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('Leaves no comment on PR and sets success check if issue_slo_rules lint is valid', async () => {
      const validBlob = {
        content:
          'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMCIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAsCiAgICAgICAgICAgICJyZXNvbHV0aW9u\nVGltZSI6IDQzMjAwLAogICAgICAgICAgICAicmVxdWlyZXNBc3NpZ25lZSI6\nIHRydWUKICAgICAgICB9CiAgICB9CiBdCiAKIAogCiAKIAo=\n',
      };
      const requests = nock('https://api.github.com')
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
        .get('/repos/testOwner/.github/contents/issue_slo_rules.json')
        .reply(200, {
          content:
            'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
        })
      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
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
        const validRes = await handle_lint.lint(schema, slo);
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
        const validRes = await handle_lint.lint(schema, slo);
        const isValid = await validRes.isValid;

        assert.strictEqual(isValid, false);
      }
    });
  });
  describe('handle_issues is triggered', () => {
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
  describe('handle_labels', () => {
    let payload: Webhooks.WebhookPayloadPullRequest;
    let doesApplyStub: sinon.SinonStub;
    let isCompliantStub: sinon.SinonStub;
    let issueLabelsStub: sinon.SinonStub;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'issue_opened'));
      doesApplyStub = sinon.stub(getSLOStatus, 'doesSloApply');
      isCompliantStub = sinon.stub(getSLOStatus, 'isCompliant');
      issueLabelsStub = sinon.stub(handler, 'getIssueLabels');
    });

    afterEach(() => {
      nock.cleanAll;
      sinon.restore();
    });

    it('labels ooslo if issue is not compliant and is missing ooslo label', async() => {
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

        issueLabelsStub.onCall(0).returns(['bug', 'p0', 'bot: merge']);
        doesApplyStub.onCall(0).returns(true);
        isCompliantStub.onCall(0).returns(false);

        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        requests.done();
    });
    it('does not relabel ooslo if issue is not compliant and has ooslo label', async () => {
      const requests = nock('https://api.github.com')
          .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
          .reply(200, {
            content:
              'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
          })

        issueLabelsStub.onCall(0).returns(['bug', 'p0', 'bot: merge', 'ooslo']);
        doesApplyStub.onCall(0).returns(true);
        isCompliantStub.onCall(0).returns(false);

        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        requests.done();
    });
    it('does not label ooslo if issue is compliant', async () => {
      const requests = nock('https://api.github.com')
          .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
          .reply(200, {
            content:
              'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
          })

        issueLabelsStub.onCall(0).returns(['bug', 'p0', 'bot: merge']);
        doesApplyStub.onCall(0).returns(true);
        isCompliantStub.onCall(0).returns(true);

        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        requests.done();
    });
    it('removes ooslo label if issue is compliant and has ooslo label', async () => {
      const requests = nock('https://api.github.com')
          .get('/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json')
          .reply(200, {
            content:
              'WwogICAgewogICAgICAgICJhcHBsaWVzVG8iOiB7CiAgICAgICAgICAgICJn\naXRIdWJMYWJlbHMiOiBbInByaW9yaXR5OiBQMiIsICJidWciXQogICAgICAg\nIH0sCiAgICAgICAgImNvbXBsaWFuY2VTZXR0aW5ncyI6IHsKICAgICAgICAg\nICAgInJlc3BvbnNlVGltZSI6IDAKICAgICAgICB9CiAgICB9CiBdCiAKIAog\nCiAK\n',
          })
          .delete('/repos/testOwner/testRepo/issues/5/labels/OOSLO')
          .reply(200);
        issueLabelsStub.onCall(0).returns(['bug', 'p0', 'bot: merge','ooslo']);
        doesApplyStub.onCall(0).returns(true);
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
