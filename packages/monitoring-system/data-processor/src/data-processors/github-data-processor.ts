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
          return Promise.all(
            repos.map(repo => {
              return this.listPublicEventsForRepository(repo);
            })
          );
        })
        .then((allRepoEvents: GitHubEventDocument[][]) => {
          const allRepoEventsFlattened = ([] as GitHubEventDocument[]).concat(
            ...allRepoEvents
          );
          return this.storeEventsData(allRepoEventsFlattened);
        })
        .then(() => resolve())
        .catch(error => {
          console.error(`Failed to process GitHub Events data: ${error}`);
          reject(new Error(`Failed to process GitHub Events data: ${error}`));
        });
    });
  }

  /**
   * List the GitHub repositories that have triggered
   * bot executions in the past
   */
  private async listRepositories(): Promise<GitHubRepositoryDocument[]> {
    return this.firestore
      .collection(FirestoreCollection.GitHubRepository)
      .get()
      .then(repositoryCollection => {
        const repositoryDocs = repositoryCollection.docs;
        return repositoryDocs.map(
          repoDoc => repoDoc.data() as GitHubRepositoryDocument
        );
      });
  }

  /**
   * Get all the publicly visible Events on the given repository
   * @param repository repository for which to get events
   */
  private async listPublicEventsForRepository(
    repository: GitHubRepositoryDocument
  ): Promise<GitHubEventDocument[]> {
    return (
      this.octokit.activity
        /**
         * We only fetch the first page (last 100) events given
         * that this process will run at most every 5 mins. However,
         * this should be reconsidered if the rate of new events
         * increases in the future.
         */
        .listRepoEvents({
          repo: repository.repo_name,
          owner: repository.owner_name,
        })
        .then(eventsPayload => {
          if (!(eventsPayload.data instanceof Array)) {
            throw new Error(
              `Unexpected payload from Octokit: ${JSON.stringify(
                eventsPayload
              )}`
            );
          }
          const gitHubEvents: GitHubEventDocument[] = [];
          for (const event of eventsPayload.data) {
            gitHubEvents.push(
              this.githubEventResponseToEvent(
                (event as unknown) as GitHubEventResponse
              )
            );
          }
          return gitHubEvents;
        })
    );
  }

  /**
   * Converts GitHub's list event response to a GitHubEventDocument
   * @param eventResponse list event response from GitHub
   */
  private githubEventResponseToEvent(
    eventResponse: GitHubEventResponse
  ): GitHubEventDocument {
    if (!eventResponse.payload) {
      console.error(`Invalid event response from GitHub: ${eventResponse}`);
      throw new Error(`Invalid event response from GitHub: ${eventResponse}`);
    }

    /**
     * We include a payload hash for GitHub webhook triggers
     * to be able to map the webhook to the GitHub Event
     * since they share the same payload
     */
    const payloadHash = crypto
      .createHash('md5')
      .update(JSON.stringify(eventResponse.payload))
      .digest('hex');

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
   * Store the given events data into Firestore. Existing events with the same payload
   * hash will be overwritten
   * @param events events data to store
   */
  private async storeEventsData(
    events: GitHubEventDocument[]
  ): Promise<WriteResult[]> {
    const collection = this.firestore.collection(
      FirestoreCollection.GitHubEvent
    );
    return Promise.all(
      events.map(event => {
        const docKey = getPrimaryKey(event, FirestoreCollection.GitHubEvent);
        return collection.doc(docKey).set(event);
      })
    );
  }
}
