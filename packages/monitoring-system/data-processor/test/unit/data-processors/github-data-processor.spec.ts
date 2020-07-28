// Copyright 2020 Google LLC
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
//
import {describe, it, beforeEach} from 'mocha';
import assert from 'assert';
import {GitHubActionType} from './octokit-request-parser';
import {OctokitMiddleware} from './octokit-middleware';
import {Octokit} from '@octokit/rest';

describe('GitHub Data Processor', () => {
  // describe('listRepositories()');
  describe('listPublicEventsForRepository()', () => {
    let mockOctokit: Octokit;
    beforeEach(() => {
      mockOctokit = OctokitMiddleware.getMockOctokit();
      OctokitMiddleware.getMiddleware().setMockResponse(
        {
          type: GitHubActionType.REPO_LIST_EVENTS,
          repoName: 'foo-repo',
          repoOwner: 'bar-owner',
        },
        {type: 'resolve', value: {hello: 'world'}}
      );
      return mockOctokit.activity
        .listRepoEvents({
          repo: 'foo-repo',
          owner: 'bar-owner',
        })
        .then(response => console.log(response));
    });

    it('test', () => console.log('test'));
  });
  // describe('storeEventsData()');
});
