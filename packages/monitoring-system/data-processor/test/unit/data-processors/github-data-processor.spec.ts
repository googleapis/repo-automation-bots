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
import {describe, it, beforeEach, afterEach} from 'mocha';
import assert from 'assert';
import {GitHubActionType} from './mocks/octokit-request-parser';
import {OctokitMiddleware} from './mocks/octokit-middleware';
import {Octokit} from '@octokit/rest';
import {
  GitHubProcessor,
  GitHubEvent,
} from '../../../src/data-processors/github-data-processor';
import {MockFirestore} from './mocks/mock-firestore';
import {loadFixture} from './util/test-util';

describe('GitHub Data Processor', () => {
  let processor: GitHubProcessor;

  describe('collectAndProcess()', () => {
    let mockFirestore: MockFirestore;
    const mockOctokit: Octokit = OctokitMiddleware.getMockOctokit();
    const middleware = OctokitMiddleware.getMiddleware();

    beforeEach(() => {
      mockFirestore = new MockFirestore();
      processor = new GitHubProcessor({
        firestore: mockFirestore,
        octokit: mockOctokit,
      });
    });

    it('collects GitHub Events data and stores it in Firestore', () => {
      mockFirestore.setMockData({
        GitHub_Repository: {
          'repo-automation-bots_googleapis_org': {
            repo_name: 'repo-automation-bots',
            owner_name: 'googleapis',
            owner_type: 'org',
          },
        },
        GitHub_Event: {},
      });

      const mockGitHubEventsPayload = loadFixture(
        'mock-github-events-data-1.json'
      );
      middleware.setMockResponse(
        {
          type: GitHubActionType.REPO_LIST_EVENTS,
          repoName: 'repo-automation-bots',
          repoOwner: 'googleapis',
        },
        {type: 'resolve', value: mockGitHubEventsPayload}
      );
      const expectedData = {
        '321819b7d55c424881dad753e7aa753d': {
          payload_hash: '321819b7d55c424881dad753e7aa753d',
          repository: 'repo-automation-bots_googleapis_org',
          event_type: 'IssueCommentEvent',
          timestamp: 1595948777000,
          actor: 'azizsonawalla',
        },
        '99b6d59369ccb78e33b8a2d09e81a133': {
          payload_hash: '99b6d59369ccb78e33b8a2d09e81a133',
          repository: 'repo-automation-bots_googleapis_org',
          event_type: 'IssueCommentEvent',
          timestamp: 1595948383000,
          actor: 'tbpg',
        },
        efd2dd423f968d55874cb681b018b286: {
          payload_hash: 'efd2dd423f968d55874cb681b018b286',
          repository: 'repo-automation-bots_googleapis_org',
          event_type: 'IssuesEvent',
          timestamp: 1595948233000,
          actor: 'tbpg',
        },
      };

      return processor.collectAndProcess().then(() => {
        assert.deepEqual(
          mockFirestore.getMockData().GitHub_Event,
          expectedData
        );
      });
    });

    it('throws an error if there is an error with GitHub', () => {
      mockFirestore.setMockData({
        GitHub_Repository: {
          'repo-automation-bots_googleapis_org': {
            repo_name: 'repo-automation-bots',
            owner_name: 'googleapis',
            owner_type: 'org',
          },
        },
        GitHub_Event: {},
      });

      middleware.rejectOnAction({
        type: GitHubActionType.REPO_LIST_EVENTS,
        repoName: 'repo-automation-bots',
        repoOwner: 'googleapis',
      });

      let thrown = false;
      return processor
        .collectAndProcess()
        .catch(() => (thrown = true))
        .finally(() => assert(thrown, 'Expected an error to be thrown'));
    });

    it('throws an error if there is an error with Firestore', () => {
      mockFirestore.throwOnCollection();

      const mockGitHubEventsPayload = loadFixture(
        'mock-github-events-data-1.json'
      );
      middleware.setMockResponse(
        {
          type: GitHubActionType.REPO_LIST_EVENTS,
          repoName: 'repo-automation-bots',
          repoOwner: 'googleapis',
        },
        {type: 'resolve', value: mockGitHubEventsPayload}
      );

      let thrown = false;
      return processor
        .collectAndProcess()
        .catch(() => (thrown = true))
        .finally(() => assert(thrown, 'Expected an error to be thrown'));
    });
  });

  describe('listRepositories()', () => {
    let mockFirestore: MockFirestore;

    beforeEach(() => {
      mockFirestore = new MockFirestore();
      processor = new GitHubProcessor({firestore: mockFirestore});
    });

    it('returns the repositories from Firestore in the correct format', () => {
      mockFirestore.setMockData({
        GitHub_Repository: {
          repo1_owner1_user: {
            repo_name: 'repo1',
            owner_name: 'owner1',
            owner_type: 'user',
          },
          repo2_owner1_user: {
            repo_name: 'repo2',
            owner_name: 'owner1',
            owner_type: 'user',
          },
          repo1_owner2_org: {
            repo_name: 'repo1',
            owner_name: 'owner2',
            owner_type: 'org',
          },
        },
      });

      const expectedRepos = [
        {repo_name: 'repo1', owner_name: 'owner1', owner_type: 'user'},
        {repo_name: 'repo2', owner_name: 'owner1', owner_type: 'user'},
        {repo_name: 'repo1', owner_name: 'owner2', owner_type: 'org'},
      ];

      return processor['listRepositories']().then(repos =>
        assert.deepEqual(repos, expectedRepos)
      );
    });

    it('returns an empty list if there are no repositories in Firestore', () => {
      mockFirestore.setMockData({
        GitHub_Repository: {},
      });
      return processor['listRepositories']().then(repos =>
        assert.deepEqual(repos, [])
      );
    });

    it('throws an error if Firestore throws an error', () => {
      mockFirestore.throwOnCollection();
      let thrown = false;
      return processor['listRepositories']()
        .catch(() => (thrown = true))
        .finally(() => assert(thrown, 'Expected error to be thrown'));
    });
  });

  describe('listPublicEventsForRepository()', () => {
    const mockOctokit: Octokit = OctokitMiddleware.getMockOctokit();
    const middleware = OctokitMiddleware.getMiddleware();

    beforeEach(() => {
      processor = new GitHubProcessor({octokit: mockOctokit});
    });

    it('returns events for repository when events exist', () => {
      const mockGitHubEventsPayload = loadFixture(
        'mock-github-events-data-1.json'
      );

      const expectedEvents = [
        {
          payload_hash: '321819b7d55c424881dad753e7aa753d',
          repository: {
            repo_name: 'repo-automation-bots',
            owner_name: 'googleapis',
            owner_type: 'org',
          },
          event_type: 'IssueCommentEvent',
          timestamp: 1595948777000,
          actor: 'azizsonawalla',
        },
        {
          payload_hash: '99b6d59369ccb78e33b8a2d09e81a133',
          repository: {
            repo_name: 'repo-automation-bots',
            owner_name: 'googleapis',
            owner_type: 'org',
          },
          event_type: 'IssueCommentEvent',
          timestamp: 1595948383000,
          actor: 'tbpg',
        },
        {
          payload_hash: 'efd2dd423f968d55874cb681b018b286',
          repository: {
            repo_name: 'repo-automation-bots',
            owner_name: 'googleapis',
            owner_type: 'org',
          },
          event_type: 'IssuesEvent',
          timestamp: 1595948233000,
          actor: 'tbpg',
        },
      ];
      middleware.setMockResponse(
        {
          type: GitHubActionType.REPO_LIST_EVENTS,
          repoName: 'repo-automation-bots',
          repoOwner: 'googleapis',
        },
        {type: 'resolve', value: mockGitHubEventsPayload}
      );
      return processor['listPublicEventsForRepository']({
        repo_name: 'repo-automation-bots',
        owner_name: 'googleapis',
      }).then(events => assert.deepEqual(events, expectedEvents));
    });

    it('returns empty array when no repository events exist', () => {
      const mockGitHubEventsPayload: [] = [];
      const expectedEvents: [] = [];
      middleware.setMockResponse(
        {
          type: GitHubActionType.REPO_LIST_EVENTS,
          repoName: 'repo-automation-bots',
          repoOwner: 'googleapis',
        },
        {type: 'resolve', value: mockGitHubEventsPayload}
      );
      return processor['listPublicEventsForRepository']({
        repo_name: 'repo-automation-bots',
        owner_name: 'googleapis',
      }).then(events => assert.deepEqual(events, expectedEvents));
    });

    it('returns events with default value if data is missing from GitHub', () => {
      const mockGitHubEventsPayload = loadFixture(
        'mock-github-events-data-2.json'
      );
      const expectedEvents = [
        {
          payload_hash: '321819b7d55c424881dad753e7aa753d',
          repository: {
            repo_name: 'repo-automation-bots',
            owner_name: 'googleapis',
            owner_type: 'org',
          },
          event_type: 'IssueCommentEvent',
          timestamp: 1595948777000,
          actor: 'Unknown',
        },
      ];
      middleware.setMockResponse(
        {
          type: GitHubActionType.REPO_LIST_EVENTS,
          repoName: 'repo-automation-bots',
          repoOwner: 'googleapis',
        },
        {type: 'resolve', value: mockGitHubEventsPayload}
      );
      return processor['listPublicEventsForRepository']({
        repo_name: 'repo-automation-bots',
        owner_name: 'googleapis',
      }).then(events => assert.deepEqual(events, expectedEvents));
    });

    it('throws an error if there is an error from Octokit', () => {
      middleware.rejectOnAction({
        type: GitHubActionType.REPO_LIST_EVENTS,
        repoName: 'repo-automation-bots',
        repoOwner: 'googleapis',
      });
      let thrown = false;
      return processor['listPublicEventsForRepository']({
        repo_name: 'repo-automation-bots',
        owner_name: 'googleapis',
      })
        .catch(() => (thrown = true))
        .finally(() => assert(thrown, 'Expected error to be thrown'));
    });

    afterEach(() => {
      middleware.resetResponses();
    });
  });

  describe('storeEventsData()', () => {
    let mockFirestore: MockFirestore;

    beforeEach(() => {
      mockFirestore = new MockFirestore();
      processor = new GitHubProcessor({firestore: mockFirestore});
    });

    it('stores the given events data in the correct format in Firestore', () => {
      mockFirestore.setMockData({
        GitHub_Event: {},
      });

      const mockEventsData: GitHubEvent[] = [
        {
          payload_hash: 'hash1',
          repository: {
            repo_name: 'repo1',
            owner_name: 'owner1',
            owner_type: 'user',
          },
          event_type: 'event_type1',
          timestamp: 12345678,
          actor: 'actor1',
        },
      ];

      const expectedData = {
        hash1: {
          payload_hash: 'hash1',
          repository: 'repo1_owner1_user',
          event_type: 'event_type1',
          timestamp: 12345678,
          actor: 'actor1',
        },
      };

      return processor['storeEventsData'](mockEventsData).then(() => {
        const writtenData = mockFirestore.getMockData().GitHub_Event;
        assert.deepEqual(writtenData, expectedData);
      });
    });

    it('does not store anything in Firestore if given events is empty', () => {
      mockFirestore.setMockData({
        GitHub_Event: {},
      });
      const mockEventsData: GitHubEvent[] = [];
      const expectedData = {};

      return processor['storeEventsData'](mockEventsData).then(() => {
        const writtenData = mockFirestore.getMockData().GitHub_Event;
        assert.deepEqual(writtenData, expectedData);
      });
    });

    it('throws an error if Firestore throws an error', () => {
      mockFirestore.throwOnSet();

      const mockEventsData: GitHubEvent[] = [
        {
          payload_hash: 'hash1',
          repository: {
            repo_name: 'repo1',
            owner_name: 'owner1',
            owner_type: 'user',
          },
          event_type: 'event_type1',
          timestamp: 12345678,
          actor: 'actor1',
        },
      ];

      let thrown = false;
      return processor['storeEventsData'](mockEventsData)
        .catch(() => (thrown = true))
        .finally(() => assert(thrown, 'Expected error to be thrown'));
    });
  });
});
