// Copyright 2022 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {resolve} from 'path';
import * as assert from 'assert';
import {describe, it, afterEach} from 'mocha';
import {fetchConfig} from '../src/docker-api';

import nock from 'nock';

nock.disableNetConnect();

const fixturesPath = resolve(__dirname, '../../test/fixtures');

describe('fetchConfig', () => {
  const image = 'cloud-devrel-public-resources/owlbot-nodejs';
  const digest = 'sha256:bbb8dd6576ac58830a07fc17e9511ae898be44f2219d3344449b125df9854441';
  const manifests = require(resolve(fixturesPath, './manifests.json'));
  const expectedConfig = {'created': '12345678'}

  afterEach(() => {
    nock.cleanAll();
  });
  it('fetches the config', async () => {
    const requests = nock('https://gcr.io')
      .get(`/v2/${image}/manifests/${digest}`)
      .reply(200, manifests)
      .get(`/v2/${image}/blobs/sha256:4bc583e11b520f05e2b11a86ee067eb814910e046f75c5df2f8598d14b8a22c0`)
      .reply(200, expectedConfig);

    const config = await fetchConfig(`gcr.io/${image}`, digest);
    assert.equal(expectedConfig.created, config.created);
    requests.done();
  });
});
