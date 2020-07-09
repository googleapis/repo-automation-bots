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
import {getSLOStatus} from '../src/slo-logic';
import sinon from 'sinon';

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
    let sloStub: sinon.SinonStub;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'pull_request_opened'));
      sloStub = sinon.stub(handler, 'handle_slos');
    });

    afterEach(() => {
      sinon.restore();
      nock.cleanAll;
    });

    it('Error is logged when getting the list of files fails', async () => {
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(404);

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('triggers handle_slos function since issue_slo_rules.json is present', async () => {
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(200, [
          {
            filename: '.github/issue_slo_rules.json',
            sha: '1d8be9e05d65e03a5e81a1c3c1bf229dce950e25',
          },
        ]);
      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });

      sinon.assert.calledOnce(sloStub);
      requests.done();
    });

    it('does not trigger handle_slos function since issue_slo_rules.json is not present', async () => {
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(200, [{filname: 'hello.json'}]);

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });

      sinon.assert.notCalled(sloStub);
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

    it('Error is logged if getting file content fails', async () => {
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
        .reply(404, {});

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('Error is logged if commenting on PR fails', async () => {
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
        .reply(404);

      await probot.receive({
        name: 'pull_request.opened',
        payload,
        id: 'abc123',
      });
      requests.done();
    });

    it('Error is logged if creating check on PR fails', async () => {
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
        .reply(404);

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
        .reply(200);

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
        .reply(200);

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
        const validRes = await handler.lint(schema, slo);
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
        const validRes = await handler.lint(schema, slo);
        const isValid = await validRes.isValid;

        assert.strictEqual(isValid, false);
      }
    });
  });

  describe('checking if slo applies to issue given: ', () => {
    describe('gitHubLabels is in slo as an array', () => {
      //eslint-disable-next-line @typescript-eslint/no-var-requires
      const sloFile = require(resolve(
        fixturesPath,
        'events',
        'issue_slo_rules',
        'slo_rules',
        'arr_githubLabels.json'
      ));
      it('Returns true if there are extra labels in gitHubLabels', async () => {
        const appliesTo: boolean = await getSLOStatus.doesSloApply(sloFile, [
          'bot:auto label',
          'p2',
          'help wanted',
          'enhancment',
          'bug',
        ]);
        assert.strictEqual(appliesTo, true);
      });
      it('Returns false if githubLabels is not subset of issue labels', async () => {
        const appliesTo: boolean = await getSLOStatus.doesSloApply(sloFile, [
          'enhancement',
          'p2',
          'bug',
        ]);
        assert.strictEqual(appliesTo, false);
      });
    });

    describe('githubLabels is in slo as a string', () => {
      //eslint-disable-next-line @typescript-eslint/no-var-requires
      const sloFile = require(resolve(
        fixturesPath,
        'events',
        'issue_slo_rules',
        'slo_rules',
        'str_githubLabels.json'
      ));
      it('Returns true if githubLabel is in issue labels', async () => {
        const appliesTo: boolean = await getSLOStatus.doesSloApply(sloFile, [
          'bot:auto label',
          'p2',
          'bug',
        ]);
        assert.strictEqual(appliesTo, true);
      });
      it('Returns false if githubLabel is not exact match in issue labels', async () => {
        const appliesTo: boolean = await getSLOStatus.doesSloApply(sloFile, [
          'auto label',
          'p2',
          'bug',
        ]);
        assert.strictEqual(appliesTo, false);
      });
    });

    describe('excludedGithubLabels is in slo as array', () => {
      //eslint-disable-next-line @typescript-eslint/no-var-requires
      const sloFile = require(resolve(
        fixturesPath,
        'events',
        'issue_slo_rules',
        'slo_rules',
        'arr_excludedGithubLabels.json'
      ));
      it('Returns true if all excludedGithubLabels is not subset of issue labels', async () => {
        const appliesTo: boolean = await getSLOStatus.doesSloApply(sloFile, [
          'bot:auto label',
          'help wanted',
          'p2',
          'bug',
        ]);
        assert.strictEqual(appliesTo, true);
      });
      it('Returns false if one of excludedGithubLabels is included in issue labels', async () => {
        const appliesTo: boolean = await getSLOStatus.doesSloApply(sloFile, [
          'bot:auto label',
          'enhancement',
          'p2',
          'bug',
        ]);
        assert.strictEqual(appliesTo, false);
      });
    });

    it('Returns true if excludedGithubLabels is type string and not in issue labels', async () => {
      //eslint-disable-next-line @typescript-eslint/no-var-requires
      const sloFile = require(resolve(
        fixturesPath,
        'events',
        'issue_slo_rules',
        'slo_rules',
        'str_excludedGithubLabels.json'
      ));
      const appliesTo: boolean = await getSLOStatus.doesSloApply(sloFile, [
        'bot:auto label',
        'help wanted',
        'p2',
        'bug',
      ]);
      assert.strictEqual(appliesTo, true);
    });

    describe('priority and issueType are in slo', () => {
      //eslint-disable-next-line @typescript-eslint/no-var-requires
      const sloFile = require(resolve(
        fixturesPath,
        'events',
        'issue_slo_rules',
        'slo_rules',
        'str_githubLabels.json'
      ));
      it('Returns true if priority in issue labels is labeled as "priority: p_" and issueType is labeled as "issueType: __"', async () => {
        const appliesTo: boolean = await getSLOStatus.doesSloApply(sloFile, [
          'bot:auto label',
          'help wanted',
          'priority: p2',
          'type: bug',
        ]);
        assert.strictEqual(appliesTo, true);
      });
      it('Returns false if priority not in issue labels', async () => {
        const appliesTo: boolean = await getSLOStatus.doesSloApply(sloFile, [
          'bot:auto label',
          'help wanted',
          'priority: p0',
          'bug',
        ]);
        assert.strictEqual(appliesTo, false);
      });
      it('Returns false if issueType not in issue labels', async () => {
        const appliesTo: boolean = await getSLOStatus.doesSloApply(sloFile, [
          'bot:auto label',
          'help wanted',
          'priority: p2',
          'type: clean up',
        ]);
        assert.strictEqual(appliesTo, false);
      });
      it('Returns false if there are no issueLabels', async () => {
        const appliesTo: boolean = await getSLOStatus.doesSloApply(sloFile, []);
        assert.strictEqual(appliesTo, false);
      });
    });
  });

  describe('Checking for compliant settings given a slo applies to an issue', () => {
    let payload: Webhooks.WebhookPayloadPullRequest;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      payload = require(resolve(fixturesPath, 'events', 'issue_opened'));
    });

    afterEach(() => {
      nock.cleanAll;
    });

    describe('repo level file exists with write contributer being valid responder', () => {
      const writeConfigContent = {
        content:
          'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogIjEw\nMDAwMDAwMGQiLAogICAgICAgICAgICAicmVzcG9uc2VUaW1lIjogIjQzMjAw\nMCIsCiAgICAgICAgICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAg\nICAicmVzcG9uZGVycyIgOiB7CiAgICAgICAgICAgICAgICJjb250cmlidXRv\ncnMiOiAiV1JJVEUiLAoJICAgICAgICJ1c2VycyI6IFsidXNlcjEiLCAidXNl\ncjIiXQogICAgICAgICAgICB9CiAgICAgICAgfQogICAgfQogXQogCiAKIAog\nCiAK\n',
      };

      it('Returns true and does not label OOSLO if issue is within resolution time, a valid responder was assigned, a valid responder commented within response time', async () => {
        const requests = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json'
          )
          .reply(200, writeConfigContent)
          .get('/repos/testOwner/testRepo/collaborators')
          .reply(200, [
            {
              login: 'user3',
              permissions: {admin: false, push: true, pull: true},
            },
          ])
          .get('/repos/testOwner/testRepo/issues/5/comments')
          .reply(200, [
            {user: {login: 'user1'}, created_at: '2020-07-22T03:04:47Z'},
          ]);

        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        requests.done();
      });

      it('Returns false and creates and adds label OOSLO to issue if no valid responder was assigned', async () => {
        const requests = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json'
          )
          .reply(200, writeConfigContent)
          .get('/repos/testOwner/testRepo/collaborators')
          .reply(200, [
            {
              login: 'customer1',
              permissions: {admin: false, push: true, pull: true},
            },
          ])
          .get('/repos/testOwner/testRepo/labels/OOSLO') //OOSLO does not exist in repo
          .reply(404)
          .post('/repos/testOwner/testRepo/labels', body => {
            snapshot(body);
            return true;
          })
          .reply(200)
          .post('/repos/testOwner/testRepo/issues/5/labels', body => {
            snapshot(body);
            return true;
          })
          .reply(200);

        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        requests.done();
      });

      it('Returns false if no valid responder commented and does not relabel OOSLO if it already exists in issue', async () => {
        const requests = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json'
          )
          .reply(200, writeConfigContent)
          .get('/repos/testOwner/testRepo/collaborators')
          .reply(200, [
            {
              login: 'user3',
              permissions: {admin: false, push: true, pull: true},
            },
          ])
          .get('/repos/testOwner/testRepo/issues/5/comments')
          .reply(200, [
            {user: {login: 'customer1'}, created_at: '2020-06-02T16:00:49Z'},
          ])
          .get('/repos/testOwner/testRepo/labels/OOSLO')
          .reply(200, {name: 'OOSLO'}) //OOSLO label already exists in repo
          .post('/repos/testOwner/testRepo/issues/5/labels', body => {
            snapshot(body);
            return true;
          })
          .reply(200);
        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        requests.done();
      });

      it('Returns false if valid responder commented past duration time and does not relabel if OOSLO label already exists', async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        payload = require(resolve(
          fixturesPath,
          'events',
          'issue_ooslo_label_opened'
        ));
        const requests = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json'
          )
          .reply(200, writeConfigContent)
          .get('/repos/testOwner/testRepo/collaborators')
          .reply(200, [
            {
              login: 'user3',
              permissions: {admin: false, push: true, pull: true},
            },
          ])
          .get('/repos/testOwner/testRepo/issues/5/comments')
          .reply(200, [
            {user: {login: 'user3'}, created_at: '2020-07-28T03:04:47Z'},
          ]);

        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        requests.done();
      });
    });

    describe('org level file exists with admin contributer being valid responder', () => {
      const adminConfigFile = {
        content:
          'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI2MGgiLAogICAgICAgICAg\nICAicmVxdWlyZXNBc3NpZ25lZSI6IHRydWUsCgkgICAgInJlc3BvbmRlcnMi\nIDogewogICAgICAgICAgICAgICAiY29udHJpYnV0b3JzIjogIkFETUlOIiwK\nCSAgICAgICAidXNlcnMiOiBbInVzZXIxIiwgInVzZXIyIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
      };

      it('Returns true and removes OOSLO label if issue is within resolution time, a valid responder was assigned, a valid responder commented within response time', async () => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        payload = require(resolve(
          fixturesPath,
          'events',
          'issue_ooslo_label_opened'
        ));
        const requests = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json'
          )
          .reply(404)
          .get('/repos/testOwner/.github/contents/issue_slo_rules.json')
          .reply(200, adminConfigFile)
          .get('/repos/testOwner/testRepo/collaborators')
          .reply(200, [
            {
              login: 'writer1',
              permissions: {admin: false, push: true, pull: true},
            },
            {
              login: 'admin1',
              permissions: {admin: true, push: true, pull: true},
            },
          ])
          .get('/repos/testOwner/testRepo/issues/5/comments')
          .reply(200, [
            {user: {login: 'admin1'}, created_at: '2020-07-22T13:04:47Z'},
          ])
          .delete('/repos/testOwner/testRepo/issues/5/labels/OOSLO')
          .reply(200);
        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        requests.done();
      });
      it('Returns false if issue does not have comment from valid responder', async () => {
        const requests = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json'
          )
          .reply(404)
          .get('/repos/testOwner/.github/contents/issue_slo_rules.json')
          .reply(200, adminConfigFile)
          .get('/repos/testOwner/testRepo/collaborators')
          .reply(200, [
            {
              login: 'writer1',
              permissions: {admin: false, push: true, pull: true},
            },
            {
              login: 'admin1',
              permissions: {admin: true, push: true, pull: true},
            },
          ])
          .get('/repos/testOwner/testRepo/issues/5/comments')
          .reply(200, [
            {user: {login: 'writer1'}, created_at: '2020-07-22T13:04:47Z'},
          ])
          .get('/repos/testOwner/testRepo/labels/OOSLO')
          .reply(200, {name: 'OOSLO'})
          .post('/repos/testOwner/testRepo/issues/5/labels', body => {
            snapshot(body);
            return true;
          })
          .reply(200);

        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        requests.done();
      });
      it('Returns false if issue does not have assignee from valid responder', async () => {
        const requests = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json'
          )
          .reply(404)
          .get('/repos/testOwner/.github/contents/issue_slo_rules.json')
          .reply(200, adminConfigFile)
          .get('/repos/testOwner/testRepo/collaborators')
          .reply(200, [
            {
              login: 'writer1',
              permissions: {admin: false, push: true, pull: true},
            },
          ])
          .get('/repos/testOwner/testRepo/labels/OOSLO')
          .reply(404)
          .post('/repos/testOwner/testRepo/labels', body => {
            snapshot(body);
            return true;
          })
          .reply(200)
          .post('/repos/testOwner/testRepo/issues/5/labels', body => {
            snapshot(body);
            return true;
          })
          .reply(200);
        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        requests.done();
      });
    });
    describe('repo level file exists with owner contributer being valid responder', () => {
      const ownerConfigFile = {
        content:
          'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICIzMDBtIiwKICAgICAgICAg\nICAgInJlcXVpcmVzQXNzaWduZWUiOiBmYWxzZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CiAgICAgICAgICAgICAgICJjb250cmlidXRvcnMiOiAiT1dORVIi\nLAoJICAgICAgICJ1c2VycyI6IFsidXNlcjEiLCAidXNlcjIiXQogICAgICAg\nICAgICB9CiAgICAgICAgfQogICAgfQogXQogCiAKIAogCiAK\n',
      };

      it('Returns true if issue is within resolution time, a valid responder commented within response time', async () => {
        const requests = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json'
          )
          .reply(200, ownerConfigFile)
          .get('/repos/testOwner/testRepo/issues/5/comments')
          .reply(200, [
            {user: {login: 'testOwner'}, created_at: '2020-07-22T08:03:47Z'},
          ]);

        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        requests.done();
      });
      it('Error is recorded if fails to create OOSLO label', async () => {
        const requests = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json'
          )
          .reply(200, ownerConfigFile)
          .get('/repos/testOwner/testRepo/issues/5/comments')
          .reply(200, [
            {user: {login: 'write1'}, created_at: '2020-07-22T08:03:47Z'},
          ])
          .get('/repos/testOwner/testRepo/labels/OOSLO')
          .reply(404)
          .post('/repos/testOwner/testRepo/labels', body => {
            snapshot(body);
            return true;
          })
          .reply(404);
        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        requests.done();
      });
    });
    describe('repo level file exists with owners path containing valid responder', () => {
      const ownersConfigFile = {
        content:
          'WwogICAgewoJImFwcGxpZXNUbyI6IHsKCSAgICAiZ2l0SHViTGFiZWxzIjog\nWyJidWciLCAiaGVscCB3YW50ZWQiXSwKCSAgICAiZXhjbHVkZWRHaXRoSHVi\nTGFiZWxzIjogImVuaGFuY2VtZW50IiwKCSAgICAicHJpb3JpdHkiOiAiUDAi\nLAoJICAgICJ0eXBlIjogImJ1ZyIKCX0sCiAgICAgICAgImNvbXBsaWFuY2VT\nZXR0aW5ncyI6IHsKICAgICAgICAgICAgInJlc29sdXRpb25UaW1lIjogMCwK\nICAgICAgICAgICAgInJlc3BvbnNlVGltZSI6ICI0MjAwcyIsCiAgICAgICAg\nICAgICJyZXF1aXJlc0Fzc2lnbmVlIjogdHJ1ZSwKCSAgICAicmVzcG9uZGVy\ncyIgOiB7CgkgICAgICAgIm93bmVycyI6ICIuZ2l0aHViL0NPREVPV05FUlMi\nLAogICAgICAgICAgICAgICAidXNlcnMiOiBbInVzZXIzIl0KICAgICAgICAg\nICAgfQogICAgICAgIH0KICAgIH0KIF0KIAogCiAKIAogCg==\n',
      };
      const codeownersFile = {
        content: 'QHVzZXIxIEBDb2Rlci1jYXQuCkBvd25lci4yCg==\n',
      };

      it('Returns true if issue is within resolution time, assigned to valid responder, a valid responder commented within response time', async () => {
        const requests = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json'
          )
          .reply(200, ownersConfigFile)
          .get('/repos/testOwner/testRepo/contents/.github/CODEOWNERS')
          .reply(200, codeownersFile)
          .get('/repos/testOwner/testRepo/issues/5/comments')
          .reply(200, [
            {user: {login: 'Coder-cat.'}, created_at: '2020-07-22T03:05:47Z'},
          ]);

        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        requests.done();
      });
      it('Error is recorded if fails to add label to OOSLO issue', async () => {
        const requests = nock('https://api.github.com')
          .get(
            '/repos/testOwner/testRepo/contents/.github/issue_slo_rules.json'
          )
          .reply(200, ownersConfigFile)
          .get('/repos/testOwner/testRepo/contents/.github/CODEOWNERS')
          .reply(200, codeownersFile)
          .get('/repos/testOwner/testRepo/issues/5/comments')
          .reply(200, [])
          .get('/repos/testOwner/testRepo/labels/OOSLO')
          .reply(200, {name: 'OOSLO'})
          .post('/repos/testOwner/testRepo/issues/5/labels', body => {
            snapshot(body);
            return true;
          })
          .reply(404);

        await probot.receive({
          name: 'issues.opened',
          payload,
          id: 'abc123',
        });

        requests.done();
      });
    });
  });
});
