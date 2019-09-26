/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import myProbotApp from '../src/translate';

import { resolve } from 'path';
import { Probot } from 'probot';
import snapshot from 'snap-shot-it';
import nock from 'nock';
import * as fs from 'fs';
import Webhooks from '@octokit/webhooks';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

// TODO: stop disabling warn once the following upstream patch is landed:
// https://github.com/probot/probot/pull/926
global.console.warn = () => {};

describe('Translate', () => {
  let probot: Probot;

  beforeEach(() => {
    probot = new Probot({
      // use a bare instance of octokit, the default version
      // enables retries which makes testing difficult.
      Octokit: require('@octokit/rest'),
    });

    const app = probot.load(myProbotApp);
    app.app = {
      getSignedJsonWebToken() {
        return 'abc123';
      },
      getInstallationAccessToken(): Promise<string> {
        return Promise.resolve('abc123');
      },
    };
  });

  describe('issue opened', () => {
    let payload: Webhooks.WebhookPayloadIssues;

    beforeEach(() => {
      payload = require(resolve(fixturesPath, './issue_opened'));
    });
    it('translates an issue', async () => {
      const requests = nock('https://api.github.com')
        .get('/repos/chingor13/java-test/contents/.github/translate.yml')
        .reply(200, { content: '' })
        .post('/repos/chingor13/java-test/issues/4/comments', body => {
          snapshot(body);
          return true;
        })
        .reply(200);
      const auth = nock('https://oauth2.googleapis.com')
        .post('/token')
        .reply(200, {
          access_token: 'abc',
          id_token: 'idtoken',
          refresh_token: 'refresh',
          expires_in: 60,
          token_type: 'Bearer',
        })
        .post('/token')
        .reply(200, {
          access_token: 'abc',
          id_token: 'idtoken',
          refresh_token: 'refresh',
          expires_in: 60,
          token_type: 'Bearer',
        });
      const translate = nock('https://translation.googleapis.com')
        .post('/language/translate/v2/', body => {
          snapshot(body);
          return true;
        })
        .reply(200, {
          data: {
            translations: [
              {
                translatedText: 'Title',
                detectedSourceLanguage: 'de',
              },
            ],
          },
        })
        .post('/language/translate/v2/', body => {
          snapshot(body);
          return true;
        })
        .reply(200, {
          data: {
            translations: [
              {
                translatedText: 'Body',
                detectedSourceLanguage: 'de',
              },
            ],
          },
        });

      await probot.receive({ name: 'issues.opened', payload, id: 'abc123' });
      auth.done();
      translate.done();
      requests.done();
    });
  });
});
