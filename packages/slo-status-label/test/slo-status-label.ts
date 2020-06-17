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
import {expect} from 'chai';
import {describe, it, beforeEach} from 'mocha';
import Webhooks from '@octokit/webhooks';
import snapshot from 'snap-shot-it';

import handler from '../src/slo-status-label';
import spies from 'chai-spies';

const chai = require('chai');
chai.use(spies);
const sinon = require('sinon');


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
    let stub: any;

    beforeEach(() => {
      payload = require(resolve(
        fixturesPath,
        'events',
        'pull_request_opened'
      ));
      stub = sinon.stub(handler, 'handle_slos');
    });

    afterEach(function () {
      sinon.restore();
      nock.cleanAll;
    });

    it('triggers handle_slos function since issue_slo_rules.json is present', async () => {
      const containsSloFile = require(resolve(
        fixturesPath,
        'events',
        'contains_slo_file'
      ));

      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(200,containsSloFile)
      
      await probot.receive({name: 'pull_request.opened', payload, id: 'abc123',});

      expect(stub.called).to.equals(true);
      requests.done();
    });

    it('does not trigger handle_slos function since issue_slo_rules.json is not present', async () => {
      const doesNotContainSLOFile = require(resolve(
        fixturesPath,
        'events',
        'not_contains_slo_file'
      ));
      const requests = nock('https://api.github.com')
        .get('/repos/testOwner/testRepo/pulls/6/files?per_page=100')
        .reply(200,doesNotContainSLOFile)
       
      await probot.receive({name: 'pull_request.opened', payload, id: 'abc123',});

      expect(stub.called).to.equals(false);
      requests.done();
    });
  });

  // describe('handleSLOs triggered') , () =>{
  //   it('checks to see it triggers getFileContents(), commentPR(), and createCheck()', async function() {
  //     const blob = require(resolve(
  //       fixturesPath,
  //       'events',
  //       'valid_slo_blob'
  //     ))
  //     const requests = nock('https://api.github.com')
  //       .get('/repos/testOwner/testRepo/git/blobs/1d8be9e05d65e03a5e81a1c3c1bf229dce950e25')
  //       .reply(200, blob)
  //       .log(console.log)
  //       .post('/repos/testOwner/testRepo/issues/6/comments', body => {
  //         snapshot(body);
  //         return true;
  //       })
  //       .reply(200);

  //       // await probot.receive({
  //       //   name: 'pull_request.opened',
  //       //   payload,
  //       //   id: 'abc123',
  //       // });

  //       requests.done();
  //   })
  // }

  describe('checking validation by using linter', () =>{
    it('Valid slos return true', async function() {
      const schema = require('./../utils/schema.json');
      const validSLOs = require(resolve(
        fixturesPath,
        'events',
        'issue_slo_rules',
        'valid_slos',
        'valid_SLOs'
      ));
      
      for(const slo of validSLOs) {
        expect(await (await handler.lint(schema, slo)).isValid).to.equals(true);
      }
    })
  
    it('Invalid slos return false', async function() {
      const schema = require('./../utils/schema.json');
      const validSLOs = require(resolve(
        fixturesPath,
        'events',
        'issue_slo_rules',
        'invalid_slos',
        'invalid_SLOs'
      ));
      
      for(const slo of validSLOs) {
        expect(await (await handler.lint(schema, slo)).isValid).to.equals(false);
      }
    })
  });
});
