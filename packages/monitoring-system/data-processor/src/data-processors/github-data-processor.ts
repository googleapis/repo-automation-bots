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
import {DataProcessor, ProcessorOptions} from './data-processor-abstract';
import {Octokit} from '@octokit/rest';
import {WriteResult} from '@google-cloud/firestore';
import crypto from 'crypto';
import {
  GitHubRepositoryDocument,
  OwnerType,
  getPrimaryKey,
  GitHubEventDocument,
  UNKNOWN_FIRESTORE_VALUE,
  FirestoreCollection,
} from '../types/firestore-schema';
import {OctokitResponse} from '@octokit/types';
const {ORG, USER, UNKNOWN} = OwnerType;

export interface GitHubProcessorOptions extends ProcessorOptions {
  octokit?: Octokit;
}

interface GitHubEventResponse {
  type: string;
  repo: {
    name: string;
  };
  actor: {
    login: string;
  };
  payload: {};
  created_at: string;
  org?: {};
  user?: {};
}

/**
 * Collects and processes Events data from GitHub
 */
export class GitHubProcessor extends DataProcessor {
  private octokit: Octokit;

  constructor(options?: GitHubProcessorOptions) {
    super(options);
    this.octokit = options?.octokit || new Octokit();
  }

  /**
   * Collect and process GitHub Events data
   */
  public async collectAndProcess(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.listRepositories()
        .then(repos => {
          const eventPromises = repos.map(repo =>
            this.listPublicEventsForRepository(repo)
          );
          /**
           * TODO: replace Promise.all with Promise.allSettled to ensure
           * any rejections don't block successful calls down the line.
           * Currently, Promise.allSettled is not yet available in TS.
           */
          return Promise.all(eventPromises);
        })
        .then((allRepoEvents: GitHubEventDocument[][]) => {
          const allRepoEventsFlattened = ([] as GitHubEventDocument[]).concat(
            ...allRepoEvents
          );
          return this.storeEventsData(allRepoEventsFlattened);
        })
        .then(() => resolve())
        .catch(error => {
          this.logger.error(`Failed to process GitHub Events data: ${error}`);
          reject(new Error(`Failed to process GitHub Events data: ${error}`));
        });
    });
  }

  /**
   * List the GitHub repositories that have triggered
   * bot executions in the past and are not marked as private
   */
  private async listRepositories(): Promise<GitHubRepositoryDocument[]> {
    return this.firestore
      .collection(FirestoreCollection.GitHubRepository)
      .get()
      .then(repositoryCollection => {
        const firestoreDocs = repositoryCollection.docs;
        const repositoryDocs = firestoreDocs.map(
          repoDoc => repoDoc.data() as GitHubRepositoryDocument
        );
        const nonPrivateRepos = repositoryDocs.filter(
          repoDoc => repoDoc.private === undefined || repoDoc.private === false
        );
        return nonPrivateRepos;
      });
  }

  /**
   * Get recent 100 publicly visible Events on the given repository
   * @param repository repository for which to get events
   * @returns A Promise with a list of GitHubEventDocuments. Promise
   * will always resolve - if there is an error, it will resolve with
   * an empty array and error will be logged.
   *
   * NOTE: We only fetch the first page (last 100) events given
   * that this process will run at most every 5 mins. However,
   * this should be reconsidered if the rate of new events
   * increases in the future.
   */
  private listPublicEventsForRepository(
    repository: GitHubRepositoryDocument
  ): Promise<GitHubEventDocument[]> {
    const listRepoOptions = {
      repo: repository.repo_name,
      owner: repository.owner_name,
    };

    const gitHubEventsPromise = this.octokit.activity
      .listRepoEvents(listRepoOptions)
      .then(eventsPayload => {
        this.validateEventsPayload(eventsPayload);
        const events: object[] = eventsPayload.data;
        const gitHubEvents = events.map((event: object) => {
          return this.githubEventResponseToEvent(
            (event as unknown) as GitHubEventResponse
          );
        });
        return gitHubEvents;
      });

    return gitHubEventsPromise
      .then(events => {
        this.markRepositoryAccessibility(repository, false);
        return events;
      })
      .catch(error => {
        if (error.HttpError && error.HttpError === 'Not Found') {
          // We assume that this repository is private,
          // but it could be non-existant too
          this.markRepositoryAccessibility(repository, true);
          return [];
        }
        throw error;
      });
  }

  /**
   * Marks the given repository as private or public
   * @param repository a GitHubRepositoryDocument
   * @param isPrivate if true, repository will be marked as private. Else marked as public
   */
  private markRepositoryAccessibility(
    repository: GitHubRepositoryDocument,
    isPrivate: boolean
  ): Promise<WriteResult> {
    /**
     * TODO: Add a job to Data Processor to 'refresh' the accessibility status
     * of repositories on a regular basis. This is to cover the case where a repository
     * switches from private --> public again.
     */
    const fullname = `${repository.owner_name}/${repository.repo_name}`;
    this.logger.debug(
      `Marking ${fullname} as ${isPrivate ? 'private' : 'public'}`
    );
    return this.updateFirestore({
      doc: {...repository, private: isPrivate},
      collection: FirestoreCollection.GitHubRepository,
    });
  }

  /**
   * Validates the given GitHub events playload. Throws an error for
   * invalid payloads.
   * @param eventsPayload list events payload from GitHub
   */
  /* eslint-disable @typescript-eslint/no-explicit-any */
  private validateEventsPayload(eventsPayload: OctokitResponse<any>) {
    if (!(eventsPayload.data instanceof Array)) {
      throw new Error(
        `Unexpected payload from Octokit: ${JSON.stringify(eventsPayload)}`
      );
    }
  }

  /**
   * Converts GitHub's list event response to a GitHubEventDocument
   * @param eventResponse list event response from GitHub
   */
  private githubEventResponseToEvent(
    eventResponse: GitHubEventResponse
  ): GitHubEventDocument {
    if (!eventResponse.payload) {
      this.logger.error(`Invalid event response from GitHub: ${eventResponse}`);
      throw new Error(`Invalid event response from GitHub: ${eventResponse}`);
    }

    /**
     * We include a payload hash for GitHub webhook triggers
     * to be able to map the webhook to the GitHub Event
     * since they share the same payload
     */
    const payloadHash = this.hashObject(eventResponse.payload);

    const [ownerName, repoName] = eventResponse.repo?.name?.split('/');
    const ownerType: OwnerType = eventResponse.org
      ? ORG
      : eventResponse.user
      ? USER
      : UNKNOWN;
    const unixTimestamp = new Date(eventResponse.created_at).getTime();

    return {
      payload_hash: payloadHash,
      repository: getPrimaryKey(
        {
          repo_name: repoName,
          owner_name: ownerName,
          owner_type: ownerType,
        },
        FirestoreCollection.GitHubRepository
      ),
      event_type: eventResponse.type || UNKNOWN_FIRESTORE_VALUE,
      timestamp: unixTimestamp,
      actor: eventResponse.actor?.login || UNKNOWN_FIRESTORE_VALUE,
    };
  }

  /**
   * Returns an MD5 hash of the object after stringifying it
   */
  private hashObject(obj: object) {
    return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex');
  }

  /**
   * Store the given events data into Firestore. Existing events with the same payload
   * hash will be overwritten
   * @param events events data to store
   */
  private async storeEventsData(
    events: GitHubEventDocument[]
  ): Promise<WriteResult[]> {
    const updates = events.map(event =>
      this.updateFirestore({
        doc: event,
        collection: FirestoreCollection.GitHubEvent,
      })
    );
    return Promise.all(updates);
  }
}
