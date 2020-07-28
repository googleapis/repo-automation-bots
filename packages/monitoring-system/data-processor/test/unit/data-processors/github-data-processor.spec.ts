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
import {GitHubActionType} from './mocks/octokit-request-parser';
import {OctokitMiddleware} from './mocks/octokit-middleware';
import {Octokit} from '@octokit/rest';
import {resolve} from 'path';

const PATH_TO_FIXTURES = 'test/unit/data-processors/fixtures';

describe('GitHub Data Processor', () => {
  // describe('listRepositories()');
  describe('listPublicEventsForRepository()', () => {
    let mockOctokit: Octokit;
    const middleware = OctokitMiddleware.getMiddleware();

    beforeEach(() => {
      mockOctokit = OctokitMiddleware.getMockOctokit();
    });

    it('returns events for repository when events exist', () => {
      const mockEventsData = require(resolve(PATH_TO_FIXTURES, 'mock-github-events-data-1.json'));
      const expectedEvents = [
        {
          payloadHash: '',
          repository: {
            name: 'repo-automation-bots',
            owner: 'googleapis',
            ownerType: 'org'
          },
          event_type: 'IssueCommentEvent',
          timestamp: 1595948777000,
          actor: 'azizsonawalla'
        }
      ]
      middleware.setMockResponse(
        {
          type: GitHubActionType.REPO_LIST_EVENTS,
          repoName: 'foo-repo',
          repoOwner: 'bar-owner',
        },
        {type: 'resolve', value: mockEventsData}
      );
      return mockOctokit.activity.listRepoEvents({ repo: 'foo-repo', owner: 'bar-owner'})
      .then(response => console.log(response));
    });
    it('returns empty array when no repository events exist');
    it('returns events with default value if data is missing from GitHub');
    it('throws an error if repository name is invalid');

    afterEach(() => {
      middleware.resetResponses();
    })
  });
  // describe('storeEventsData()');
});
