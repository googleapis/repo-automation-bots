// Copyright 2022 Google LLC
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

import nock from 'nock';
import {describe, it} from 'mocha';
import * as assert from 'assert';
import {Octokit} from '@octokit/rest';
import {branchRequiresReviews} from '../src/branch-protection';

nock.disableNetConnect();

describe('branchRequiresReview', () => {
  let octokit: Octokit;

  beforeEach(() => {
    octokit = new Octokit({
      auth: 'fakeToken',
    });
  });

  it('should fail with unauthorized 404', async () => {
    const req = nock('https://api.github.com')
      .get('/repos/testOwner/testRepo/branches/dev/protection')
      .reply(404, {
        message: 'Not Found',
        documentation_url:
          'https://docs.github.com/rest/reference/repos#get-branch-protection',
      });
    const requiresReview = await branchRequiresReviews(
      octokit,
      'testOwner',
      'testRepo',
      'dev'
    );
    assert.ok(!requiresReview);
    req.done();
  });

  it('should fail with unprotected 404', async () => {
    const req = nock('https://api.github.com')
      .get('/repos/testOwner/testRepo/branches/dev/protection')
      .reply(404, {
        message: 'Branch not protected',
        documentation_url:
          'https://docs.github.com/rest/reference/repos#get-branch-protection',
      });
    const requiresReview = await branchRequiresReviews(
      octokit,
      'testOwner',
      'testRepo',
      'dev'
    );
    assert.ok(!requiresReview);
    req.done();
  });

  it('should return true for protected branch', async () => {
    const req = nock('https://api.github.com')
      .get('/repos/testOwner/testRepo/branches/dev/protection')
      .reply(200, {
        required_pull_request_reviews: {
          url: 'https://api.github.com/repos/testOwner/testRepo/branches/dev/protection/required_pull_request_reviews',
          dismiss_stale_reviews: false,
          require_code_owner_reviews: false,
          required_approving_review_count: 1,
        },
      });
    const requiresReview = await branchRequiresReviews(
      octokit,
      'testOwner',
      'testRepo',
      'dev'
    );
    assert.ok(requiresReview);
    req.done();
  });

  it('should return false for protected branch without required review', async () => {
    const req = nock('https://api.github.com')
      .get('/repos/testOwner/testRepo/branches/dev/protection')
      .reply(200, {
        required_status_checks: {
          url: 'https://api.github.com/repos/testOwner/testRepo/branches/dev/protection/required_status_checks',
          strict: false,
          contexts: [],
          contexts_url:
            'https://api.github.com/repos/testOwner/testRepo/branches/dev/protection/required_status_checks/contexts',
          checks: [],
        },
      });
    const requiresReview = await branchRequiresReviews(
      octokit,
      'testOwner',
      'testRepo',
      'dev'
    );
    assert.ok(!requiresReview);
    req.done();
  });
});
