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
import {GitHubProcessor} from '../../../src/data-processors/github-data-processor';
import {MockFirestore, FirestoreData} from './mocks/mock-firestore';
import {loadFixture} from './util/test-util';
import {
  GitHubEventDocument,
  GitHubRepositoryDocument,
} from '../../../src/types/firestore-schema';

interface GitHubProcessorTestFixture {
  preTestFirestoreData: {};
  githubEventsResponse: [];
  githubEventsObjects: [];
  postTestFirestoreData: {};
}

let fixture1: GitHubProcessorTestFixture;
let fixture2: GitHubProcessorTestFixture;
let mockFirestoreData1: FirestoreData;

function resetMockData() {
  fixture1 = loadFixture(
    ['github-processor', 'github-processor-fixture-1.json'],
    true
  ) as GitHubProcessorTestFixture;
  fixture2 = loadFixture(
    ['github-processor', 'github-processor-fixture-2.json'],
    true
  ) as GitHubProcessorTestFixture;
  mockFirestoreData1 = loadFixture(
    ['firestore', 'mock-firestore-data-1.json'],
    true
  );
}

const LIST_REPO_EVENTS_ACTION = {
  type: GitHubActionType.REPO_LIST_EVENTS,
  repoName: 'repo-automation-bots',
  repoOwner: 'googleapis',
};

describe('GitHub Data Processor', () => {
  let processor: GitHubProcessor;
  let middleware: OctokitMiddleware;
  let mockOctokit: Octokit;
  let mockFirestore: MockFirestore;

  beforeEach(() => {
    resetMockData();
    middleware = new OctokitMiddleware();
    mockOctokit = middleware.getMockOctokit();
  });

  describe('collectAndProcess()', () => {
    beforeEach(() => {
      mockFirestore = new MockFirestore();
      processor = new GitHubProcessor({
        firestore: mockFirestore,
        octokit: mockOctokit,
      });
    });

    it('collects GitHub Events data and stores it in Firestore', () => {
      mockFirestore.setMockData(fixture1.preTestFirestoreData);
      middleware.setMockResponse(LIST_REPO_EVENTS_ACTION, {
        type: 'resolve',
        value: fixture1.githubEventsResponse,
      });
      return processor.collectAndProcess().then(() => {
        assert.deepEqual(
          mockFirestore.getMockData(),
          fixture1.postTestFirestoreData
        );
      });
    });

    it('throws an error if there is an error with GitHub', () => {
      mockFirestore.setMockData(fixture1.preTestFirestoreData);
      middleware.rejectOnAction(LIST_REPO_EVENTS_ACTION);

      let thrown = false;
      return processor
        .collectAndProcess()
        .catch(() => (thrown = true))
        .finally(() => assert(thrown, 'Expected an error to be thrown'));
    });

    it('throws an error if there is an error with Firestore', () => {
      mockFirestore.throwOnCollection();
      middleware.setMockResponse(LIST_REPO_EVENTS_ACTION, {
        type: 'resolve',
        value: fixture1.githubEventsResponse,
      });

      let thrown = false;
      return processor
        .collectAndProcess()
        .catch(() => (thrown = true))
        .finally(() => assert(thrown, 'Expected an error to be thrown'));
    });
  });

  describe('listRepositories()', () => {
    beforeEach(() => {
      mockFirestore = new MockFirestore();
      processor = new GitHubProcessor({firestore: mockFirestore});
    });

    it('returns the repositories from Firestore in the correct format', () => {
      mockFirestore.setMockData(mockFirestoreData1);

      const expectedRepos = [
        {repo_name: 'repo1', owner_name: 'owner1', owner_type: 'User'},
        {repo_name: 'repo2', owner_name: 'owner1', owner_type: 'User'},
        {repo_name: 'repo1', owner_name: 'owner2', owner_type: 'Org'},
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
    const repository = {
      repo_name: 'repo-automation-bots',
      owner_name: 'googleapis',
      owner_type: 'Organization',
    } as GitHubRepositoryDocument;

    beforeEach(() => {
      processor = new GitHubProcessor({octokit: mockOctokit});
    });

    it('returns events for repository when events exist', () => {
      middleware.setMockResponse(LIST_REPO_EVENTS_ACTION, {
        type: 'resolve',
        value: fixture1.githubEventsResponse,
      });
      return processor['listPublicEventsForRepository'](
        repository
      ).then(events => assert.deepEqual(events, fixture1.githubEventsObjects));
    });

    it('returns empty array when no repository events exist', () => {
      middleware.setMockResponse(LIST_REPO_EVENTS_ACTION, {
        type: 'resolve',
        value: {data: []},
      });
      return processor['listPublicEventsForRepository'](
        repository
      ).then(events => assert.deepEqual(events, []));
    });

    it('returns events with default value if data is missing from GitHub', () => {
      middleware.setMockResponse(LIST_REPO_EVENTS_ACTION, {
        type: 'resolve',
        value: fixture2.githubEventsResponse,
      });
      return processor['listPublicEventsForRepository'](
        repository
      ).then(events => assert.deepEqual(events, fixture2.githubEventsObjects));
    });

    it('throws an error if there is an error from Octokit', () => {
      middleware.rejectOnAction(LIST_REPO_EVENTS_ACTION);
      let thrown = false;
      return processor['listPublicEventsForRepository'](repository)
        .catch(() => (thrown = true))
        .finally(() => assert(thrown, 'Expected error to be thrown'));
    });

    it('throws an error if Octokit returns a non-200 response', () => {
      // TODO
    });
  });

  describe('storeEventsData()', () => {
    beforeEach(() => {
      mockFirestore = new MockFirestore();
      processor = new GitHubProcessor({firestore: mockFirestore});
    });

    it('stores the given events data in the correct format in Firestore', () => {
      mockFirestore.setMockData(fixture1.preTestFirestoreData);
      return processor['storeEventsData'](fixture1.githubEventsObjects).then(
        () => {
          const writtenData = mockFirestore.getMockData();
          assert.deepEqual(writtenData, fixture1.postTestFirestoreData);
        }
      );
    });

    it('does not store anything in Firestore if given events is empty', () => {
      mockFirestore.setMockData({
        GitHub_Event: {},
      });
      const mockEventsData: GitHubEventDocument[] = [];
      const expectedData = {};

      return processor['storeEventsData'](mockEventsData).then(() => {
        const writtenData = mockFirestore.getMockData().GitHub_Event;
        assert.deepEqual(writtenData, expectedData);
      });
    });

    it('throws an error if Firestore throws an error', () => {
      mockFirestore.throwOnSet();

      let thrown = false;
      return processor['storeEventsData'](fixture1.githubEventsObjects)
        .catch(() => (thrown = true))
        .finally(() => assert(thrown, 'Expected error to be thrown'));
    });
  });
});
