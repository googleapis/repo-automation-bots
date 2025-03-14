// Copyright 2025 Google LLC
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

import nock from 'nock';
import {Runner} from '../src/runner';
import {Octokit} from '@octokit/rest';
import assert from 'assert';
const fetch = require('node-fetch');

nock.disableNetConnect();

describe('Release Please Runner', () => {
  let octokit: Octokit;
  beforeEach(() => {
    octokit = new Octokit({auth: 'faketoken', request: {fetch}});
  });
  afterEach(() => {
    nock.cleanAll();
  });

  it('should create a ref for lightweight tag', async () => {
    const requests = nock('https://api.github.com')
      .post('/repos/owner1/repo1/git/refs', body => {
        assert.equal(body['ref'], 'refs/tags/release-please-123');
        assert.equal(body['sha'], 'abcdefg');
        return true;
      })
      .reply(200);

    await Runner.createLightweightTag(
      octokit,
      {
        owner: 'owner1',
        repo: 'repo1',
        defaultBranch: 'main',
      },
      'release-please-123',
      'abcdefg'
    );
    requests.done();
  });
});
