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

describe('fetchConfig', () => {
  it('fetches a real docker image', async () => {
    const config = await docker.fetchConfig(
      'gcr.io/cloud-devrel-public-resources/owlbot-python',
      'sha256:7cffbc10910c3ab1b852c05114a08d374c195a81cdec1d4a67a1d129331d0bfe'
    );
    assert.strictEqual(typeof config.created, 'string');
    assert.ok(config.created.length > 0);
  });

  it('fetches a real docker image and ignores tag', async () => {
    const config = await docker.fetchConfig(
      'gcr.io/cloud-devrel-public-resources/owlbot-python:latest',
      'sha256:7cffbc10910c3ab1b852c05114a08d374c195a81cdec1d4a67a1d129331d0bfe'
    );
    assert.strictEqual(typeof config.created, 'string');
    assert.ok(config.created.length > 0);
  });
});
