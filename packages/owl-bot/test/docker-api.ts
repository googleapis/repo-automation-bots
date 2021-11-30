// Copyright 2021 Google LLC
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

import {describe, it} from 'mocha';
import * as docker from '../src/docker-api';
import * as assert from 'assert';
import nock from 'nock';

nock.cleanAll();
nock.enableNetConnect();

describe('fetchConfig', () => {
  it('fetches a real docker image', async () => {
    const config = await docker.fetchConfig(
      'gcr.io/cloud-devrel-public-resources/owlbot-nodejs',
      'sha256:bbb8dd6576ac58830a07fc17e9511ae898be44f2219d3344449b125df9854441'
    );
    assert.strictEqual(typeof config.created, 'string');
    assert.ok(config.created.length > 0);
  });
});
